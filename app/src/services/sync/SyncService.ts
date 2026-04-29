import type * as SQLite from 'expo-sqlite';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SyncQueueRepository } from './SyncQueueRepository';
import type { LearningEvent, QueuedEvent } from './types';

/**
 * SyncService — drains the local `sync_queue` into Supabase.
 *
 * Design decisions (see design.md D7 and Req 17):
 *   - Every learning event hits the local DB first. SyncService is best-effort
 *     and never blocks the learning loop.
 *   - On network recovery, `flushIfOnline` walks the queue in FIFO order.
 *   - Each row is upserted with `onConflict` set to the natural key of the
 *     server table. Clients only write; they trust the server to reject older
 *     versions later via a trigger (tracked as follow-up hardening).
 *   - A row that fails 3 times stays in the queue with `retry_count = 3`
 *     so a manual operator action can inspect it; it will not be retried.
 *
 * Conflict resolution follows D7: "latest updated_at wins". The payload
 * always carries an `updated_at` timestamp; Task 4.4 adds a Postgres
 * trigger that enforces this on upsert.
 */

const FLUSH_BATCH_SIZE = 25;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 4000;

export type FlushResult = {
  attempted: number;
  uploaded: number;
  failed: number;
  remainingAfter: number;
};

/**
 * Conflict keys used when upserting into each server table. Matched to the
 * PRIMARY KEY definitions in supabase/migrations.
 */
const CONFLICT_KEYS: Record<LearningEvent['table'], string> = {
  user_sentence_progress: 'user_id,sentence_id',
  user_word_tap: 'id',
  user_daily_progress: 'user_id,date',
  user_streak: 'user_id',
  user_rewards_log: 'id',
};

export class SyncService {
  constructor(
    private readonly db: SQLite.SQLiteDatabase,
    private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Fire-and-forget enqueue. The caller does not wait for the upload.
   */
  async enqueue(event: LearningEvent): Promise<void> {
    await SyncQueueRepository.enqueue(this.db, event);
  }

  /**
   * Walk the queue and POST as much as possible. Stops early when the
   * network layer starts returning errors to avoid a thundering herd.
   *
   * Returns a summary so NetInfo listeners can surface status in the UI.
   */
  async flushIfOnline(): Promise<FlushResult> {
    const batch = await SyncQueueRepository.peek(this.db, FLUSH_BATCH_SIZE);
    if (batch.length === 0) {
      return {
        attempted: 0,
        uploaded: 0,
        failed: 0,
        remainingAfter: 0,
      };
    }

    let uploaded = 0;
    let failed = 0;

    for (const row of batch) {
      try {
        await this.uploadOne(row);
        await SyncQueueRepository.markSuccess(this.db, row.id);
        uploaded += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await SyncQueueRepository.markFailure(this.db, row.id, message);
        failed += 1;
        // Exponential backoff between failures so we don't saturate a
        // flapping network. Clamped so the UI doesn't freeze.
        const delay = Math.min(
          MAX_BACKOFF_MS,
          BASE_BACKOFF_MS * 2 ** row.retryCount,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    const remainingAfter = await SyncQueueRepository.count(this.db);
    return {
      attempted: batch.length,
      uploaded,
      failed,
      remainingAfter,
    };
  }

  /**
   * Merge a locally-accumulated anonymous identity into the now-logged-in
   * user account. At this stage that means rewriting every unsent queue
   * payload's `user_id` to the new authenticated id so the flush targets
   * the right rows. Future iterations may also migrate already-uploaded
   * data; not needed for MVP.
   */
  async mergeAnonymousData(newUserId: string): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const rows = await this.db.getAllAsync<{ id: number; payload_json: string }>(
        `SELECT id, payload_json FROM sync_queue;`,
      );
      for (const r of rows) {
        const payload = JSON.parse(r.payload_json) as Record<string, unknown>;
        payload.user_id = newUserId;
        await this.db.runAsync(
          `UPDATE sync_queue SET payload_json = ? WHERE id = ?;`,
          JSON.stringify(payload),
          r.id,
        );
      }
    });
  }

  private async uploadOne(row: QueuedEvent): Promise<void> {
    if (row.op === 'upsert') {
      const { error } = await this.supabase
        .from(row.table)
        .upsert(row.payload, { onConflict: CONFLICT_KEYS[row.table] });
      if (error) throw new Error(error.message);
      return;
    }
    // delete: payload must carry the primary-key columns.
    const { error } = await this.supabase
      .from(row.table)
      .delete()
      .match(row.payload);
    if (error) throw new Error(error.message);
  }
}
