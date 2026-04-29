import type * as SQLite from 'expo-sqlite';

import type { LearningEvent, QueuedEvent } from './types';

/**
 * Thin repository wrapping the `sync_queue` table.
 *
 * Kept tiny and explicit so the same interface can be faked in tests
 * without pulling in expo-sqlite. Every method takes the db handle
 * explicitly (passed from SyncService) to avoid a hidden global.
 */

const MAX_RETRIES = 3;

export const SyncQueueRepository = {
  async enqueue(db: SQLite.SQLiteDatabase, event: LearningEvent): Promise<void> {
    await db.runAsync(
      `INSERT INTO sync_queue (op, table_name, payload_json, enqueued_at, retry_count)
       VALUES (?, ?, ?, ?, 0);`,
      event.op,
      event.table,
      JSON.stringify(event.payload),
      Date.now(),
    );
  },

  async peek(db: SQLite.SQLiteDatabase, limit: number): Promise<QueuedEvent[]> {
    const rows = await db.getAllAsync<{
      id: number;
      op: LearningEvent['op'];
      table_name: LearningEvent['table'];
      payload_json: string;
      enqueued_at: number;
      retry_count: number;
      last_error: string | null;
    }>(
      `SELECT id, op, table_name, payload_json, enqueued_at, retry_count, last_error
       FROM sync_queue
       WHERE retry_count < ?
       ORDER BY enqueued_at ASC
       LIMIT ?;`,
      MAX_RETRIES,
      limit,
    );
    return rows.map((r) => ({
      id: r.id,
      op: r.op,
      table: r.table_name,
      payload: JSON.parse(r.payload_json) as Record<string, unknown>,
      enqueuedAt: r.enqueued_at,
      retryCount: r.retry_count,
      lastError: r.last_error,
    }));
  },

  async markSuccess(db: SQLite.SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync(`DELETE FROM sync_queue WHERE id = ?;`, id);
  },

  async markFailure(
    db: SQLite.SQLiteDatabase,
    id: number,
    error: string,
  ): Promise<void> {
    await db.runAsync(
      `UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ? WHERE id = ?;`,
      error,
      id,
    );
  },

  async count(db: SQLite.SQLiteDatabase): Promise<number> {
    const row = await db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) AS c FROM sync_queue;`,
    );
    return row?.c ?? 0;
  },

  MAX_RETRIES,
};
