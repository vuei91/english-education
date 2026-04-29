import type * as SQLite from 'expo-sqlite';

import { migrations, type Migration } from './migrations';

/**
 * Minimal forward-only migration runner.
 *
 * Why not a library:
 *  - expo-sqlite exposes raw SQL. A full library (e.g. drizzle) pulls in
 *    schema DSLs we don't need yet.
 *  - Our migrations are plain SQL strings managed in a TS array.
 *
 * The runner maintains a `schema_migrations` table recording applied versions.
 * On startup it applies anything newer than the max recorded version, in order.
 */

const SCHEMA_TABLE = 'schema_migrations';

async function ensureSchemaTable(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${SCHEMA_TABLE} (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);
}

async function getAppliedVersions(db: SQLite.SQLiteDatabase): Promise<Set<number>> {
  const rows = await db.getAllAsync<{ version: number }>(
    `SELECT version FROM ${SCHEMA_TABLE};`,
  );
  return new Set(rows.map((r) => r.version));
}

function sortByVersion(list: readonly Migration[]): Migration[] {
  return [...list].sort((a, b) => a.version - b.version);
}

function assertVersionInvariants(list: readonly Migration[]): void {
  for (let i = 0; i < list.length; i += 1) {
    const expected = i + 1;
    const actual = list[i]?.version;
    if (actual !== expected) {
      throw new Error(
        `Migration versions must be a 1-based contiguous sequence. Expected ${expected} at index ${i}, got ${actual}.`,
      );
    }
  }
}

export type MigrationRunResult = {
  applied: Migration[];
  alreadyAtVersion: number;
};

/**
 * Runs any pending migrations on the given db.
 *
 * Transaction strategy: each migration is wrapped in its own transaction so a
 * mid-run failure leaves the schema at the last fully-applied version rather
 * than a partial state.
 */
export async function runMigrations(
  db: SQLite.SQLiteDatabase,
  list: readonly Migration[] = migrations,
): Promise<MigrationRunResult> {
  const ordered = sortByVersion(list);
  assertVersionInvariants(ordered);

  await ensureSchemaTable(db);
  const applied = await getAppliedVersions(db);

  const toApply = ordered.filter((m) => !applied.has(m.version));
  const performed: Migration[] = [];

  for (const migration of toApply) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.up);
      await db.runAsync(
        `INSERT INTO ${SCHEMA_TABLE} (version, name, applied_at) VALUES (?, ?, ?);`,
        migration.version,
        migration.name,
        Date.now(),
      );
    });
    performed.push(migration);
  }

  const latest = ordered.at(-1)?.version ?? 0;
  return { applied: performed, alreadyAtVersion: latest };
}

/**
 * Useful for inspection / debugging. Not part of the normal app boot path.
 */
export async function getCurrentSchemaVersion(
  db: SQLite.SQLiteDatabase,
): Promise<number> {
  await ensureSchemaTable(db);
  const row = await db.getFirstAsync<{ max_version: number | null }>(
    `SELECT MAX(version) AS max_version FROM ${SCHEMA_TABLE};`,
  );
  return row?.max_version ?? 0;
}
