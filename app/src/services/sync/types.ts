/**
 * Events the app enqueues for eventual upload to Supabase.
 *
 * Each event is a pure data description of what changed, with enough
 * context that SyncService can POST it to the right table without having
 * to re-read the client state. `updated_at` is always carried so the
 * server-side conflict resolution (latest wins, design D7) works.
 */

export type SyncOp = 'upsert' | 'delete';

export type ServerTable =
  | 'user_sentence_progress'
  | 'user_word_tap'
  | 'user_daily_progress'
  | 'user_streak'
  | 'user_rewards_log';

export type LearningEvent = {
  op: SyncOp;
  table: ServerTable;
  /**
   * JSON-serialisable payload. Typed as unknown + validated per-table by
   * the uploader; keeping this wide lets us add new tables without a
   * sweeping refactor.
   */
  payload: Record<string, unknown>;
};

export type QueuedEvent = LearningEvent & {
  /** Auto-increment primary key assigned by SQLite. */
  id: number;
  enqueuedAt: number;
  retryCount: number;
  lastError: string | null;
};
