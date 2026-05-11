import type * as SQLite from 'expo-sqlite';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { ReadingDay } from '../../types/domain';

/**
 * ReadingCurriculumService — Track B 60-day reading curriculum.
 *
 * Each day has 3 passages (sentences). Data lives in Supabase
 * `reading_day` + `reading_day_passage` bridge table.
 * Caching strategy mirrors CurriculumService: memory → SQLite → Supabase.
 */

export class ReadingCurriculumUnavailableError extends Error {
  constructor(message = '독해 커리큘럼을 불러오지 못했어요.') {
    super(message);
    this.name = 'ReadingCurriculumUnavailableError';
  }
}

type CacheKind = 'reading_days';

/** Row shape from the `reading_day` Supabase table. */
type ReadingDayRow = {
  id: string;
  day_number: number;
  chapter: number;
  title_ko: string;
  subtitle_ko: string | null;
  reading_day_passage?: Array<{ sentence_id: string; order_index: number }> | null;
};

export class ReadingCurriculumService {
  private readonly daysMemo = new Map<string, ReadingDay[]>();

  constructor(
    private readonly db: SQLite.SQLiteDatabase | null,
    private readonly supabase: SupabaseClient,
  ) {}

  /**
   * List all 60 reading days, optionally filtered by chapter (1/2/3).
   * Results are sorted by `day_number` ascending.
   */
  async listDays(chapter?: 1 | 2 | 3): Promise<ReadingDay[]> {
    const cacheKey = chapter != null ? String(chapter) : 'all';

    const memoHit = this.daysMemo.get(cacheKey);
    if (memoHit) return memoHit;

    try {
      let query = this.supabase
        .from('reading_day')
        .select('*, reading_day_passage(sentence_id, order_index)')
        .order('day_number', { ascending: true });
      if (chapter != null) {
        query = query.eq('chapter', chapter);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const days = (data ?? []).map(mapReadingDayRow);
      this.daysMemo.set(cacheKey, days);
      await this.writeCache('reading_days', cacheKey, days);
      return days;
    } catch (err) {
      const diskHit = await this.readCache<ReadingDay[]>('reading_days', cacheKey);
      if (diskHit) {
        this.daysMemo.set(cacheKey, diskHit);
        return diskHit;
      }
      throw toUnavailable(err);
    }
  }

  /**
   * Get a single reading Day by its number (1–60).
   */
  async getDayByNumber(dayNumber: number): Promise<ReadingDay | null> {
    const allDays = this.daysMemo.get('all');
    if (allDays) {
      return allDays.find((d) => d.dayNumber === dayNumber) ?? null;
    }

    try {
      const { data, error } = await this.supabase
        .from('reading_day')
        .select('*, reading_day_passage(sentence_id, order_index)')
        .eq('day_number', dayNumber)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return mapReadingDayRow(data as ReadingDayRow);
    } catch (err) {
      const diskHit = await this.readCache<ReadingDay[]>('reading_days', 'all');
      if (diskHit) {
        return diskHit.find((d) => d.dayNumber === dayNumber) ?? null;
      }
      throw toUnavailable(err);
    }
  }

  /**
   * Determine the current reading Day the user should work on.
   * Returns the first Day with any incomplete passage.
   */
  async getCurrentDay(completedPassageIds: ReadonlySet<string>): Promise<ReadingDay | null> {
    const days = await this.listDays();
    for (const day of days) {
      const allDone = day.passageIds.every((id) => completedPassageIds.has(id));
      if (!allDone) return day;
    }
    return null;
  }

  /** Drop cached data. */
  invalidateCache(): void {
    this.daysMemo.clear();
    if (!this.db) return;
    void this.db.runAsync(`DELETE FROM content_cache WHERE kind = 'reading_days';`).catch(() => {});
  }

  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  private async readCache<T>(kind: CacheKind, key: string): Promise<T | null> {
    if (!this.db) return null;
    const row = await this.db.getFirstAsync<{
      payload_json: string;
      fetched_at: number;
    }>(`SELECT payload_json, fetched_at FROM content_cache WHERE kind = ? AND key = ?;`, kind, key);
    if (!row) return null;
    try {
      return JSON.parse(row.payload_json) as T;
    } catch {
      return null;
    }
  }

  private async writeCache<T>(kind: CacheKind, key: string, value: T): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      `INSERT OR REPLACE INTO content_cache (kind, key, payload_json, fetched_at)
       VALUES (?, ?, ?, ?);`,
      kind,
      key,
      JSON.stringify(value),
      Date.now(),
    );
  }
}

function mapReadingDayRow(row: ReadingDayRow): ReadingDay {
  const passages = (row.reading_day_passage ?? [])
    .slice()
    .sort((a, b) => a.order_index - b.order_index);
  return {
    id: row.id,
    dayNumber: row.day_number,
    chapter: row.chapter as 1 | 2 | 3,
    titleKo: row.title_ko,
    subtitleKo: row.subtitle_ko,
    passageIds: passages.map((p) => p.sentence_id),
  };
}

function toUnavailable(err: unknown): ReadingCurriculumUnavailableError {
  const message = err instanceof Error ? err.message : 'Unknown reading curriculum fetch failure';
  return new ReadingCurriculumUnavailableError(`독해 커리큘럼을 불러오지 못했어요. (${message})`);
}
