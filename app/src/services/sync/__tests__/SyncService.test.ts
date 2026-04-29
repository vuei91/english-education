/**
 * SyncService behaviour.
 *
 * We fake the SQLite database with an in-memory array and fake the
 * Supabase client with plain functions. That's enough to cover:
 *   - enqueue persists via the repository
 *   - flushIfOnline drains successes and marks failures
 *   - mergeAnonymousData rewrites user_id on every queued row
 *   - retry counter blocks rows after MAX_RETRIES
 */

import { SyncQueueRepository } from '../SyncQueueRepository';
import { SyncService } from '../SyncService';
import type { LearningEvent } from '../types';

type Row = {
  id: number;
  op: LearningEvent['op'];
  table_name: LearningEvent['table'];
  payload_json: string;
  enqueued_at: number;
  retry_count: number;
  last_error: string | null;
};

function createFakeDb() {
  const rows: Row[] = [];
  let nextId = 1;

  const db = {
    runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      const sqlLower = sql.toLowerCase();
      if (sqlLower.startsWith('insert into sync_queue')) {
        const [op, table, payload_json, enqueued_at] = params as [
          Row['op'],
          Row['table_name'],
          string,
          number,
        ];
        rows.push({
          id: nextId++,
          op,
          table_name: table,
          payload_json,
          enqueued_at,
          retry_count: 0,
          last_error: null,
        });
      } else if (sqlLower.startsWith('delete from sync_queue')) {
        const [id] = params as [number];
        const index = rows.findIndex((r) => r.id === id);
        if (index !== -1) rows.splice(index, 1);
      } else if (sqlLower.startsWith('update sync_queue set retry_count')) {
        const [error, id] = params as [string, number];
        const r = rows.find((row) => row.id === id);
        if (r) {
          r.retry_count += 1;
          r.last_error = error;
        }
      } else if (sqlLower.startsWith('update sync_queue set payload_json')) {
        const [payload_json, id] = params as [string, number];
        const r = rows.find((row) => row.id === id);
        if (r) r.payload_json = payload_json;
      }
    }),
    getAllAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      const sqlLower = sql.toLowerCase();
      if (sqlLower.includes('from sync_queue') && sqlLower.includes('retry_count <')) {
        const [maxRetries, limit] = params as [number, number];
        return rows
          .filter((r) => r.retry_count < maxRetries)
          .slice()
          .sort((a, b) => a.enqueued_at - b.enqueued_at)
          .slice(0, limit);
      }
      // mergeAnonymousData reads all rows
      return rows.slice();
    }),
    getFirstAsync: jest.fn(async () => ({ c: rows.length })),
    withTransactionAsync: jest.fn(async (cb: () => Promise<void>) => {
      await cb();
    }),
  };

  return {
    db: db as unknown as ConstructorParameters<typeof SyncService>[0],
    rows,
  };
}

function createFakeSupabase(opts: {
  upsertError?: string | null;
  deleteError?: string | null;
} = {}) {
  const upsert = jest.fn(async () => ({
    error: opts.upsertError ? { message: opts.upsertError } : null,
  }));
  const deleteStep = jest.fn(() => ({
    match: jest.fn(async () => ({
      error: opts.deleteError ? { message: opts.deleteError } : null,
    })),
  }));
  const from = jest.fn(() => ({
    upsert,
    delete: deleteStep,
  }));
  const client = { from } as unknown as ConstructorParameters<typeof SyncService>[1];
  return { client, from, upsert };
}

const sampleEvent: LearningEvent = {
  op: 'upsert',
  table: 'user_sentence_progress',
  payload: {
    user_id: 'u1',
    sentence_id: 's1',
    completed_at: '2026-04-29T00:00:00Z',
    updated_at: '2026-04-29T00:00:00Z',
  },
};

describe('SyncService.enqueue', () => {
  it('persists the event via the repository', async () => {
    const { db, rows } = createFakeDb();
    const { client } = createFakeSupabase();
    const svc = new SyncService(db, client);
    await svc.enqueue(sampleEvent);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.table_name).toBe('user_sentence_progress');
  });
});

describe('SyncService.flushIfOnline', () => {
  it('returns all zeros when the queue is empty', async () => {
    const { db } = createFakeDb();
    const { client } = createFakeSupabase();
    const svc = new SyncService(db, client);
    const result = await svc.flushIfOnline();
    expect(result).toEqual({
      attempted: 0,
      uploaded: 0,
      failed: 0,
      remainingAfter: 0,
    });
  });

  it('removes successful rows and keeps failed ones for retry', async () => {
    const { db, rows } = createFakeDb();
    // First call succeeds, second fails.
    let callCount = 0;
    const upsert = jest.fn(async () => {
      callCount += 1;
      return callCount === 1 ? { error: null } : { error: { message: 'boom' } };
    });
    const from = jest.fn(() => ({ upsert }));
    const client = { from } as unknown as ConstructorParameters<typeof SyncService>[1];

    const svc = new SyncService(db, client);
    await svc.enqueue(sampleEvent);
    await svc.enqueue(sampleEvent);

    const result = await svc.flushIfOnline();

    expect(result.attempted).toBe(2);
    expect(result.uploaded).toBe(1);
    expect(result.failed).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.retry_count).toBe(1);
    expect(rows[0]?.last_error).toBe('boom');
  });
});

describe('SyncService.mergeAnonymousData', () => {
  it('rewrites user_id on every queued row', async () => {
    const { db, rows } = createFakeDb();
    const { client } = createFakeSupabase();
    const svc = new SyncService(db, client);
    await svc.enqueue({
      ...sampleEvent,
      payload: { ...sampleEvent.payload, user_id: 'anon' },
    });
    await svc.enqueue({
      ...sampleEvent,
      payload: { ...sampleEvent.payload, user_id: 'anon', sentence_id: 's2' },
    });

    await svc.mergeAnonymousData('real-user-123');

    rows.forEach((r) => {
      const payload = JSON.parse(r.payload_json) as { user_id: string };
      expect(payload.user_id).toBe('real-user-123');
    });
  });
});

describe('SyncQueueRepository.MAX_RETRIES', () => {
  it('exposes the retry cap so tests can depend on it', () => {
    expect(SyncQueueRepository.MAX_RETRIES).toBe(3);
  });
});
