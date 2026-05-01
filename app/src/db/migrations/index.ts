/**
 * Ordered list of schema migrations.
 *
 * Conventions:
 *  - `version` strictly increases by 1 starting at 1. Never reuse or
 *    reorder a version; add new ones at the end.
 *  - `up` is idempotent when possible (CREATE TABLE IF NOT EXISTS, etc.)
 *    so a half-applied migration can resume.
 *  - No destructive schema change without a follow-up migration. Dropping
 *    columns loses sync state.
 *
 * Real table DDL (`sentence_progress`, `word_tap_events`, `sync_queue`,
 * etc.) lands in Task 4.1. Migration 1 just bootstraps an empty DB so the
 * runner can be exercised and tested now.
 */

export type Migration = {
  version: number;
  name: string;
  up: string;
};

export const migrations: readonly Migration[] = [
  {
    version: 1,
    name: 'initial_bootstrap',
    up: `
      -- Bootstrap migration. Schema tables arrive in Task 4.1.
      -- Creating a sentinel table keeps the runner verifiable.
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `,
  },
  {
    version: 2,
    name: 'learning_tables',
    up: `
      -- Read-only mirror of server content for offline-first rendering.
      CREATE TABLE IF NOT EXISTS content_cache (
        kind TEXT NOT NULL,
        key TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        PRIMARY KEY (kind, key)
      );

      -- Sentence completion + two-grade feedback (Req 1.7, 3.5).
      CREATE TABLE IF NOT EXISTS sentence_progress (
        sentence_id TEXT NOT NULL PRIMARY KEY,
        completed_at INTEGER NOT NULL,
        feedback TEXT,               -- 'known' | 'hard' | NULL
        updated_at INTEGER NOT NULL
      );

      -- Every Vocab Helper tap. Powers Word Unresolved Score (Req 12).
      CREATE TABLE IF NOT EXISTS word_tap_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL,
        tapped_at INTEGER NOT NULL,
        source_sentence_id TEXT
      );
      CREATE INDEX IF NOT EXISTS word_tap_events_word_idx
        ON word_tap_events (word, tapped_at DESC);

      -- Daily counter + goal-met flag (Req 13).
      CREATE TABLE IF NOT EXISTS daily_progress (
        date TEXT PRIMARY KEY,       -- YYYY-MM-DD (local)
        sentences_completed INTEGER NOT NULL DEFAULT 0,
        goal_met INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );

      -- Singleton row tracking streak state.
      CREATE TABLE IF NOT EXISTS streak (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        current_streak INTEGER NOT NULL DEFAULT 0,
        best_streak INTEGER NOT NULL DEFAULT 0,
        last_goal_met_date TEXT,
        updated_at INTEGER NOT NULL
      );
      INSERT OR IGNORE INTO streak (id, current_streak, best_streak, updated_at)
        VALUES (1, 0, 0, 0);

      -- Rewarded ad grants (Req 15).
      CREATE TABLE IF NOT EXISTS rewards_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reward_type TEXT NOT NULL,   -- 'heart' | 'unlock' | 'drill-retry'
        granted_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS rewards_log_granted_idx
        ON rewards_log (granted_at DESC);

      -- Outbound sync queue. SyncService drains this to Supabase (Req 17).
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        op TEXT NOT NULL,            -- 'upsert' | 'delete'
        table_name TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        enqueued_at INTEGER NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      );
      CREATE INDEX IF NOT EXISTS sync_queue_enqueued_idx
        ON sync_queue (enqueued_at ASC);
    `,
  },
  {
    version: 3,
    name: 'day_progress',
    up: `
      -- 100-day curriculum: per-day completion tracking.
      -- day_number is 1–100 and maps 1:1 to a curriculum_unit.
      CREATE TABLE IF NOT EXISTS day_progress (
        day_number  INTEGER NOT NULL PRIMARY KEY,
        started_at  INTEGER,          -- epoch ms, NULL = not started
        completed_at INTEGER,         -- epoch ms, NULL = not completed
        updated_at  INTEGER NOT NULL
      );
    `,
  },
];
