/**
 * Tests for the migration runner logic.
 *
 * We don't boot a real SQLite connection here — expo-sqlite requires the
 * native module which Jest can't load. Instead we inject a tiny fake
 * database that records the calls and stores the applied versions in a
 * plain array. That's enough to verify:
 *   - migrations apply in order
 *   - each migration wraps itself in a transaction
 *   - re-running skips already-applied versions
 *   - version numbers must be a contiguous 1-based sequence
 */

import { runMigrations } from '../migrator';
import type { Migration } from '../migrations';

type RunCall =
  | { kind: 'exec'; sql: string }
  | { kind: 'run'; sql: string; params: unknown[] }
  | { kind: 'txBegin' }
  | { kind: 'txEnd' };

function createFakeDb() {
  const calls: RunCall[] = [];
  const applied: { version: number; name: string; applied_at: number }[] = [];
  let inTransaction = false;

  const db = {
    execAsync: jest.fn(async (sql: string) => {
      calls.push({ kind: 'exec', sql });
    }),
    runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      calls.push({ kind: 'run', sql, params });
      const insertMatch = /INSERT INTO schema_migrations/i.test(sql);
      if (insertMatch) {
        const [version, name, applied_at] = params as [number, string, number];
        applied.push({ version, name, applied_at });
      }
    }),
    getAllAsync: jest.fn(async () => applied.map((a) => ({ version: a.version }))),
    getFirstAsync: jest.fn(async () => {
      const max = applied.length
        ? applied.reduce((m, a) => (a.version > m ? a.version : m), 0)
        : null;
      return { max_version: max };
    }),
    withTransactionAsync: jest.fn(async (cb: () => Promise<void>) => {
      inTransaction = true;
      calls.push({ kind: 'txBegin' });
      try {
        await cb();
      } finally {
        calls.push({ kind: 'txEnd' });
        inTransaction = false;
      }
    }),
  };

  return {
    db: db as unknown as Parameters<typeof runMigrations>[0],
    calls,
    applied,
    isInTransaction: () => inTransaction,
  };
}

const noop = (version: number): Migration => ({
  version,
  name: `m${version}`,
  up: `CREATE TABLE t_${version} (id INTEGER);`,
});

describe('runMigrations', () => {
  it('applies pending migrations in ascending version order', async () => {
    const { db, applied } = createFakeDb();
    const result = await runMigrations(db, [noop(1), noop(2), noop(3)]);
    expect(applied.map((a) => a.version)).toEqual([1, 2, 3]);
    expect(result.applied.map((m) => m.version)).toEqual([1, 2, 3]);
    expect(result.alreadyAtVersion).toBe(3);
  });

  it('wraps each migration in its own transaction', async () => {
    const { db, calls } = createFakeDb();
    await runMigrations(db, [noop(1), noop(2)]);
    const txEvents = calls.filter(
      (c) => c.kind === 'txBegin' || c.kind === 'txEnd',
    );
    // 2 migrations → begin/end each
    expect(txEvents.map((c) => c.kind)).toEqual(['txBegin', 'txEnd', 'txBegin', 'txEnd']);
  });

  it('skips migrations that are already recorded', async () => {
    const { db, applied } = createFakeDb();
    await runMigrations(db, [noop(1), noop(2)]);
    const result = await runMigrations(db, [noop(1), noop(2), noop(3)]);
    expect(applied.map((a) => a.version)).toEqual([1, 2, 3]);
    expect(result.applied.map((m) => m.version)).toEqual([3]);
  });

  it('throws when versions are not a 1-based contiguous sequence', async () => {
    const { db } = createFakeDb();
    await expect(runMigrations(db, [noop(1), noop(3)])).rejects.toThrow(
      /contiguous sequence/,
    );
    await expect(runMigrations(db, [noop(2)])).rejects.toThrow(
      /contiguous sequence/,
    );
  });

  it('records applied_at timestamps as epoch millis', async () => {
    const { db, applied } = createFakeDb();
    const before = Date.now();
    await runMigrations(db, [noop(1)]);
    const after = Date.now();
    expect(applied[0]?.applied_at).toBeGreaterThanOrEqual(before);
    expect(applied[0]?.applied_at).toBeLessThanOrEqual(after);
  });
});
