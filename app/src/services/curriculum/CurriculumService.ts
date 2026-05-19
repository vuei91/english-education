import type * as SQLite from 'expo-sqlite';
import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  CurriculumDay,
  CurriculumStep,
  CurriculumStepType,
  CurriculumUnit,
  GrammarTrack,
  UnitOpens,
  VocabPack,
  VocabPackEntry,
  VocabPackPos,
} from '../../types/domain';

/**
 * CurriculumService — single entry point for curriculum catalog queries.
 *
 * Reads are layered memory → SQLite → Supabase. The catalog is static, so
 * we deliberately do *not* apply a TTL on disk (unlike `ContentService`,
 * which serves mutable sentence/vocab data); `fetched_at` is written only
 * so the existing `content_cache` schema stays happy. Invalidation is
 * manual via {@link CurriculumService.invalidateCache}.
 *
 * Offline detection is ambient: if a Supabase call rejects with a network
 * error AND the on-disk cache is also empty, we surface a
 * {@link CurriculumUnavailableError} so UI layers can render a retry state.
 *
 * Requirements mapping: 7.1~7.6, 8.1~8.4.
 */

/** Thrown when catalog data cannot be served from any layer. (Req 7.6) */
export class CurriculumUnavailableError extends Error {
  constructor(message = '커리큘럼 데이터를 불러오지 못했어요.') {
    super(message);
    this.name = 'CurriculumUnavailableError';
  }
}

/**
 * Thrown when catalog data violates invariants declared in the data model
 * (e.g. a unit with fewer than three steps, or `getNextStep` called before
 * the unit was loaded).
 */
export class CurriculumIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CurriculumIntegrityError';
  }
}

type CacheKind = 'curriculum_catalog' | 'curriculum_unit' | 'vocab_pack' | 'curriculum_days';

type UnitWithSteps = {
  unit: CurriculumUnit;
  steps: CurriculumStep[];
  pack: VocabPack;
};

/** Row shape returned by the `curriculum_day` Supabase table (30-day). */
type DayRow = {
  id: string;
  day_number: number;
  chapter: number;
  title_ko: string;
  subtitle_ko: string | null;
  description_ko: string | null;
  is_review: boolean;
  intro_phrases: Array<{ en: string; ko: string }> | null;
  curriculum_day_unit?: Array<{ unit_id: string; order_index: number }> | null;
};

/** Shape returned by the `curriculum_unit` + prerequisite join. */
type UnitRow = {
  id: string;
  order_index: number;
  title_ko: string;
  opens_track: GrammarTrack | null;
  opens_point: string | null;
  vocab_pack_id: string;
  theme: string;
  curriculum_unit_prerequisite?: Array<{ prerequisite_id: string }> | null;
};

type StepRow = {
  id: string;
  unit_id: string;
  step_type: CurriculumStepType;
  order_index: number;
};

type VocabPackRow = {
  id: string;
  title_ko: string;
  size: number;
  vocab_pack_entry?: VocabPackEntryRow[] | null;
};

type VocabPackEntryRow = {
  word: string;
  is_chunk: boolean;
  pos: VocabPackPos;
  role: 'new' | 'review';
  phrasal_of: string | null;
  collocates: string[] | null;
};

export class CurriculumService {
  /** In-memory catalog cache keyed by cache key (`'all'`). */
  private readonly catalogMemo = new Map<string, CurriculumUnit[]>();
  /** In-memory per-unit cache — fuels the sync `getNextStep`/`isUnitUnlocked`. */
  private readonly unitMemo = new Map<string, UnitWithSteps>();
  /** In-memory 30-day list cache keyed by chapter (`'all' | '1' | '2' | '3'`). */
  private readonly daysMemo = new Map<string, CurriculumDay[]>();

  constructor(
    private readonly db: SQLite.SQLiteDatabase | null,
    private readonly supabase: SupabaseClient,
  ) {}

  /**
   * List all curriculum units.
   * Results are sorted by `order_index` ascending. (Req 7.1, 7.2)
   */
  async listUnits(): Promise<CurriculumUnit[]> {
    const cacheKey = 'all';

    const memoHit = this.catalogMemo.get(cacheKey);
    if (memoHit) return memoHit;

    // Try the network first so new seeds propagate without a manual
    // invalidate; fall back to SQLite only when Supabase is unreachable.
    try {
      const query = this.supabase
        .from('curriculum_unit')
        .select(
          '*, curriculum_unit_prerequisite!curriculum_unit_prerequisite_unit_id_fkey(prerequisite_id)',
        )
        .order('order_index', { ascending: true });
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const units = (data ?? []).map(mapUnitRow);
      this.catalogMemo.set(cacheKey, units);
      await this.writeCache('curriculum_catalog', cacheKey, units);
      return units;
    } catch (err) {
      const diskHit = await this.readCache<CurriculumUnit[]>('curriculum_catalog', cacheKey);
      if (diskHit) {
        this.catalogMemo.set(cacheKey, diskHit);
        return diskHit;
      }
      throw toUnavailable(err);
    }
  }

  /**
   * Load a single unit together with its three steps and vocab pack in one
   * round-trip. Throws {@link CurriculumIntegrityError} when fewer than
   * three steps are found — that would mean the server data is broken and
   * we must surface the problem rather than silently skip a step. (Req 7.3)
   */
  async getUnitWithSteps(unitId: string): Promise<UnitWithSteps> {
    const memoHit = this.unitMemo.get(unitId);
    if (memoHit) return memoHit;

    try {
      const bundle = await this.fetchUnitBundle(unitId);
      if (bundle.steps.length < 3) {
        throw new CurriculumIntegrityError(
          `Curriculum unit ${unitId} is missing steps (expected 3, got ${bundle.steps.length}).`,
        );
      }
      this.unitMemo.set(unitId, bundle);
      await this.writeCache('curriculum_unit', unitId, bundle);
      return bundle;
    } catch (err) {
      // Integrity errors are not an "offline" condition — rethrow as-is.
      if (err instanceof CurriculumIntegrityError) throw err;
      const diskHit = await this.readCache<UnitWithSteps>('curriculum_unit', unitId);
      if (diskHit) {
        this.unitMemo.set(unitId, diskHit);
        return diskHit;
      }
      throw toUnavailable(err);
    }
  }

  /**
   * Return the next step to run inside a unit, enforcing the strict
   * `phrase → conjugation → substitution` order. Returns `null` when all
   * three steps are already in `completedStepIds`.
   *
   * The signature is synchronous by design (Req 7.4) — callers must have
   * pre-loaded the unit via {@link CurriculumService.getUnitWithSteps}.
   * Calling this without a warm cache is a programming error, surfaced as
   * {@link CurriculumIntegrityError}.
   */
  getNextStep(unitId: string, completedStepIds: ReadonlySet<string>): CurriculumStep | null {
    const bundle = this.unitMemo.get(unitId);
    if (!bundle) {
      throw new CurriculumIntegrityError(
        `getUnitWithSteps must be called before getNextStep for unit ${unitId}.`,
      );
    }
    // Sort defensively — the server should already order by order_index,
    // but we re-sort to make the invariant local to this method.
    const ordered = [...bundle.steps].sort((a, b) => a.orderIndex - b.orderIndex);
    for (const step of ordered) {
      if (!completedStepIds.has(step.id)) return step;
    }
    return null;
  }

  /**
   * Check whether a unit's prerequisites are satisfied.
   *
   * `options.enforce` defaults to `false` per Req 8.3 — MVP only surfaces
   * warnings in the UI, never blocks entry. Flipping `enforce: true` lets a
   * future A/B test gate progression with a single flag flip.
   *
   * Requires the unit to be warm in the in-memory cache when enforcing; a
   * cold cache under enforcement is a programming error and throws
   * {@link CurriculumIntegrityError}.
   */
  isUnitUnlocked(
    unitId: string,
    completedUnitIds: ReadonlySet<string>,
    options?: { enforce?: boolean },
  ): boolean {
    if (options?.enforce !== true) return true;
    const bundle = this.unitMemo.get(unitId);
    if (!bundle) {
      throw new CurriculumIntegrityError(
        `getUnitWithSteps must be called before isUnitUnlocked({ enforce: true }) for unit ${unitId}.`,
      );
    }
    return bundle.unit.prerequisiteIds.every((id) => completedUnitIds.has(id));
  }

  /** Drop every cached catalog/unit/day entry — both memory and SQLite. */
  invalidateCache(): void {
    this.catalogMemo.clear();
    this.unitMemo.clear();
    this.daysMemo.clear();
    if (!this.db) return;
    void this.db
      .runAsync(
        `DELETE FROM content_cache WHERE kind IN ('curriculum_catalog', 'curriculum_unit', 'vocab_pack', 'curriculum_days');`,
      )
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[CurriculumService] invalidateCache disk sweep failed', err);
      });
  }

  // --------------------------------------------------------------------
  // 30-day curriculum methods
  // --------------------------------------------------------------------

  /**
   * List all 30 days, optionally filtered by chapter (1/2/3).
   * Results are sorted by `day_number` ascending.
   * Each day includes `unitIds` from the `curriculum_day_unit` bridge table.
   */
  async listDays(chapter?: 1 | 2 | 3): Promise<CurriculumDay[]> {
    const cacheKey = chapter != null ? String(chapter) : 'all';

    const memoHit = this.daysMemo.get(cacheKey);
    if (memoHit) return memoHit;

    try {
      let query = this.supabase
        .from('curriculum_day')
        .select('*, curriculum_day_unit(unit_id, order_index)')
        .order('day_number', { ascending: true });
      if (chapter != null) {
        query = query.eq('chapter', chapter);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const days = (data ?? []).map(mapDayRow);
      this.daysMemo.set(cacheKey, days);
      await this.writeCache('curriculum_days', cacheKey, days);
      return days;
    } catch (err) {
      const diskHit = await this.readCache<CurriculumDay[]>('curriculum_days', cacheKey);
      if (diskHit) {
        this.daysMemo.set(cacheKey, diskHit);
        return diskHit;
      }
      throw toUnavailable(err);
    }
  }

  /**
   * Get a single Day by its number (1–30).
   * Returns `null` if the day doesn't exist.
   */
  async getDayByNumber(dayNumber: number): Promise<CurriculumDay | null> {
    // Try to find it in the full list cache first.
    const allDays = this.daysMemo.get('all');
    if (allDays) {
      return allDays.find((d) => d.dayNumber === dayNumber) ?? null;
    }

    try {
      const { data, error } = await this.supabase
        .from('curriculum_day')
        .select('*, curriculum_day_unit(unit_id, order_index)')
        .eq('day_number', dayNumber)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return mapDayRow(data as DayRow);
    } catch (err) {
      // Try disk cache of the full list.
      const diskHit = await this.readCache<CurriculumDay[]>('curriculum_days', 'all');
      if (diskHit) {
        return diskHit.find((d) => d.dayNumber === dayNumber) ?? null;
      }
      throw toUnavailable(err);
    }
  }

  /**
   * Determine the current Day the user should work on.
   * Returns the first Day whose ALL units are not in `completedUnitIds`.
   * If all 30 days are completed, returns `null` (curriculum finished).
   */
  async getCurrentDay(completedUnitIds: ReadonlySet<string>): Promise<CurriculumDay | null> {
    const days = await this.listDays();
    for (const day of days) {
      const allDone = day.unitIds.every((id) => completedUnitIds.has(id));
      if (!allDone) return day;
    }
    return null;
  }

  // --------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------

  private async fetchUnitBundle(unitId: string): Promise<UnitWithSteps> {
    const unitPromise = this.supabase
      .from('curriculum_unit')
      .select(
        '*, curriculum_unit_prerequisite!curriculum_unit_prerequisite_unit_id_fkey(prerequisite_id)',
      )
      .eq('id', unitId)
      .maybeSingle();
    const stepsPromise = this.supabase
      .from('curriculum_step')
      .select('*')
      .eq('unit_id', unitId)
      .order('order_index', { ascending: true });

    const [unitRes, stepsRes] = await Promise.all([unitPromise, stepsPromise]);

    if (unitRes.error) throw new Error(unitRes.error.message);
    if (!unitRes.data) {
      throw new CurriculumIntegrityError(`Curriculum unit ${unitId} was not found.`);
    }
    if (stepsRes.error) throw new Error(stepsRes.error.message);

    const unit = mapUnitRow(unitRes.data as UnitRow);
    const steps = ((stepsRes.data as StepRow[] | null) ?? []).map(mapStepRow);

    // Pack fetch is second-stage so we can key it off the unit row we just
    // received. Worst-case this is two sequential round-trips instead of
    // three — still cheap for a catalog read.
    const { data: packData, error: packError } = await this.supabase
      .from('vocab_pack')
      .select('*, vocab_pack_entry(*)')
      .eq('id', unit.vocabPackId)
      .maybeSingle();
    if (packError) throw new Error(packError.message);
    if (!packData) {
      throw new CurriculumIntegrityError(
        `Vocab pack ${unit.vocabPackId} referenced by unit ${unitId} was not found.`,
      );
    }
    const pack = mapVocabPackRow(packData as VocabPackRow);

    return { unit, steps, pack };
  }

  private async readCache<T>(kind: CacheKind, key: string): Promise<T | null> {
    if (!this.db) return null;
    // TTL intentionally omitted: the curriculum catalog is static between
    // Supabase migrations, so we trust the cache until `invalidateCache()`
    // clears it. `fetched_at` is still written to satisfy NOT NULL.
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

// --------------------------------------------------------------------
// Row mappers — pure functions so they can be unit-tested directly.
// --------------------------------------------------------------------

function mapUnitRow(row: UnitRow): CurriculumUnit {
  const opens: UnitOpens =
    row.opens_track && row.opens_point ? { track: row.opens_track, point: row.opens_point } : null;
  const prerequisiteIds = (row.curriculum_unit_prerequisite ?? []).map((p) => p.prerequisite_id);
  return {
    id: row.id,
    orderIndex: row.order_index,
    titleKo: row.title_ko,
    opens,
    vocabPackId: row.vocab_pack_id,
    theme: row.theme,
    prerequisiteIds,
  };
}

function mapDayRow(row: DayRow): CurriculumDay {
  const bridgeRows = (row.curriculum_day_unit ?? [])
    .slice()
    .sort((a, b) => a.order_index - b.order_index);
  const unitIds = bridgeRows.map((r) => r.unit_id);
  return {
    id: row.id,
    dayNumber: row.day_number,
    chapter: row.chapter as 1 | 2 | 3,
    titleKo: row.title_ko,
    subtitleKo: row.subtitle_ko,
    descriptionKo: row.description_ko,
    isReview: row.is_review,
    unitId: unitIds[0] ?? '',
    unitIds,
    introPhrases: (row.intro_phrases ?? []).map((p) => ({ en: p.en, ko: p.ko })),
  };
}

function mapStepRow(row: StepRow): CurriculumStep {
  // `order_index` is CHECK-constrained to 1/2/3 server-side; we cast
  // after the fact instead of validating here because the DB is the
  // source of truth for that invariant.
  return {
    id: row.id,
    unitId: row.unit_id,
    stepType: row.step_type,
    orderIndex: row.order_index as 1 | 2 | 3,
  };
}

function mapVocabPackRow(row: VocabPackRow): VocabPack {
  const entries: VocabPackEntry[] = (row.vocab_pack_entry ?? []).map((e) => ({
    word: e.word,
    isChunk: e.is_chunk,
    pos: e.pos,
    role: e.role,
    phrasalOf: e.phrasal_of,
    collocates: e.collocates,
  }));
  return {
    id: row.id,
    titleKo: row.title_ko,
    size: row.size,
    entries,
  };
}

/**
 * Normalise any thrown value from the Supabase layer into a
 * {@link CurriculumUnavailableError}. Network failures in `@supabase/*`
 * surface as plain `Error` / `TypeError` instances, so we just wrap the
 * message while preserving the original as `cause` for logs.
 */
function toUnavailable(err: unknown): CurriculumUnavailableError {
  const message = err instanceof Error ? err.message : 'Unknown curriculum fetch failure';
  const wrapped = new CurriculumUnavailableError(
    `커리큘럼 데이터를 불러오지 못했어요. (${message})`,
  );
  if (err instanceof Error) {
    (wrapped as { cause?: unknown }).cause = err;
  }
  return wrapped;
}
