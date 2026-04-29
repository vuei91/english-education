import { Platform } from 'react-native';
import type * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'sentenceflow.db';

/**
 * Single process-wide handle. expo-sqlite already keeps a per-name cache
 * internally, but exposing a helper keeps call sites uniform.
 *
 * Web note: expo-sqlite's web build depends on WASM assets that aren't
 * loaded automatically by the Metro dev server. Until we add the
 * production-worker setup (or switch to IndexedDB for web), we skip the
 * DB entirely on web targets. Call sites that tolerate a missing db
 * (ContentService, etc.) pass `null` through.
 */
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (Platform.OS === 'web') {
    return Promise.reject(
      new Error(
        'expo-sqlite is not available on web in this build. Pass null to services that accept an optional db, or gate the call on Platform.OS !== "web".',
      ),
    );
  }
  if (!dbPromise) {
    // Lazy import so the web bundle never pulls in expo-sqlite.
    // The require() form avoids static analysis picking the module up.
    dbPromise = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const SQLiteModule: typeof SQLite = require('expo-sqlite');
      const db = await SQLiteModule.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await db.execAsync('PRAGMA journal_mode = WAL;');
      return db;
    })();
  }
  return dbPromise;
}

/**
 * Returns the shared SQLite handle on native, or `null` on web.
 * Services that can run without the local cache (e.g. ContentService)
 * use this helper so one call site works everywhere.
 */
export async function getContentDatabase(): Promise<SQLite.SQLiteDatabase | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await getDatabase();
  } catch {
    return null;
  }
}

/**
 * Closes the shared connection. Tests use this to isolate migrations state.
 * Production code should not call this during the app lifecycle.
 */
export async function closeDatabase(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.closeAsync();
  dbPromise = null;
}
