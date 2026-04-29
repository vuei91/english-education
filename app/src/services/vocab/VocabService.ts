import type * as SQLite from 'expo-sqlite';

import type { ContentService, VocabEntry } from '../content';

/**
 * VocabService — thin read-through wrapper around ContentService for the
 * Vocab Helper sheet (Task 10.x).
 *
 * Responsibilities split:
 *   - Entry lookup goes through ContentService so the 7-day cache layer
 *     applies uniformly.
 *   - Tap logging is local (SQLite `word_tap_events`, Req 12.1) and must
 *     tolerate a missing db (web target).
 *
 * This service intentionally has NO "practice word" / "flashcard" API:
 *   - Req 12.3 + product-context Non-Goals forbid a standalone SRS for
 *     words. Word Unresolved Score (Task 11) reads tap history and feeds
 *     next-sentence ranking instead.
 */

export type TapRecord = {
  word: string;
  tappedAt: number;
  sourceSentenceId: string | null;
};

export class VocabService {
  constructor(
    private readonly content: ContentService,
    private readonly db: SQLite.SQLiteDatabase | null,
  ) {}

  async getEntry(word: string): Promise<VocabEntry | null> {
    return this.content.getVocabEntry(word);
  }

  /**
   * Records a Vocab Helper tap. Returns quietly when the db is absent
   * (web) so call sites don't need Platform.OS branching.
   */
  async recordTap(record: TapRecord): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      `INSERT INTO word_tap_events (word, tapped_at, source_sentence_id)
       VALUES (?, ?, ?);`,
      record.word.toLowerCase(),
      record.tappedAt,
      record.sourceSentenceId,
    );
  }
}
