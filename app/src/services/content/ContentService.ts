import type * as SQLite from 'expo-sqlite';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { CEFRLevel, Sentence, Track } from '../../types/domain';
import { parsePatternDrillVariants, type PatternDrillVariants } from './patternDrill';

/**
 * `Sentence` lives in `app/src/types/domain` as of curriculum-foundation
 * Task 3.3. We re-export the name here so existing call sites that import
 * from `'../../services/content'` keep working unchanged.
 */
export type { Sentence } from '../../types/domain';

/**
 * ContentService — Content Pool reader with an optional offline cache.
 *
 * The service accepts a nullable SQLite handle so it can run in two modes:
 *   - Native (db provided): every read goes through the local cache first
 *     and we mirror fresh server rows back into `content_cache`.
 *   - Web / tests (db === null): we skip the cache entirely and go
 *     straight to Supabase. This keeps expo-sqlite out of the web bundle
 *     (its web build depends on WASM assets not available on Expo Go web)
 *     and avoids the import.meta bundling issues surfaced during Task 7.
 *
 * Ranking by Word Unresolved Score (Req 12.3) is additive and lives in
 * Task 11.1; this service just exposes the raw data + caching seam.
 */

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type Chunk = {
  id: string;
  sentenceId: string;
  orderIndex: number;
  text: string;
  depth: number;
  role: string | null;
};

export type StructureSummary = {
  sentenceId: string;
  who: string | null;
  what: string | null;
  whereAt: string | null;
  whenAt: string | null;
};

export type VocabEntry = {
  word: string;
  pos: string | null;
  meaningKo: string | null;
  ipa: string | null;
  etymology: unknown | null;
  mnemonic: unknown | null;
  exampleSentenceIds: string[];
};

export type PatternDrill = {
  id: string;
  originSentenceId: string;
  variants: PatternDrillVariants;
};

export type RecentTappedWord = {
  word: string;
  lastTappedAt: number;
  tapCount: number;
};

type CacheKind = 'sentence' | 'chunks' | 'summary' | 'vocab' | 'drill';

export class ContentService {
  constructor(
    private readonly db: SQLite.SQLiteDatabase | null,
    private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Picks the next sentence via the `pick_next_sentence` Postgres RPC.
   *
   * The RPC gives us random selection + Word Unresolved Score boost +
   * session-level exclusion in a single round-trip. See
   * supabase/migrations/*_pick_next_sentence_rpc.sql for the full logic.
   */
  async getNextSentence(
    track: Track,
    cefr: CEFRLevel,
    options: {
      /** Words the caller wants boosted, lowercase. */
      hotWords?: string[];
      /** Sentence ids already consumed this session. */
      excludeIds?: string[];
      /**
       * When set, restricts candidates to sentences whose
       * `curriculum_step_id` matches. Added in curriculum-foundation
       * Task 8.1 (Req 5.1, 5.2). The RPC falls back to `NULL` when the
       * option is omitted, preserving the pre-curriculum behaviour for
       * existing callers (Req 5.3). When the filter yields no rows the
       * service returns `null` — there is no fallback to the broader
       * pool (Req 5.4).
       */
      curriculumStepId?: string;
    } = {},
  ): Promise<Sentence | null> {
    const hotWords = (options.hotWords ?? []).map((w) => w.toLowerCase());
    const { data, error } = await this.supabase.rpc('pick_next_sentence', {
      p_track: track,
      p_cefr: cefr,
      p_hot_words: hotWords,
      p_exclude_ids: options.excludeIds ?? [],
      p_curriculum_step_id: options.curriculumStepId ?? null,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return null;
    const sentence: Sentence = {
      id: row.id as string,
      track: row.track as Track,
      textEn: row.text_en as string,
      textKo: (row.text_ko as string | null) ?? null,
      cefrLevel: row.cefr_level as CEFRLevel,
      situation: (row.situation as string | null) ?? null,
      source: row.source as string,
      license: row.license as string,
      // `curriculum_step_id` + `is_phrase` were added to the RPC shape in
      // curriculum-foundation Tasks 2.1~2.3 and the filter option in
      // Task 8.1. Defensive fallbacks keep us safe if the server is ever
      // rolled back or the row predates the migration.
      curriculumStepId: (row.curriculum_step_id as string | null | undefined) ?? null,
      isPhrase: (row.is_phrase as boolean | undefined) ?? false,
    };
    await this.writeCache('sentence', sentence.id, sentence);
    return sentence;
  }

  /** Fetch a single sentence by its ID. Used by session resume to
   *  rebuild history from `seenSentenceIds`. */
  async getSentenceById(id: string): Promise<Sentence | null> {
    const cached = await this.readCache<Sentence>('sentence', id);
    if (cached) return cached;
    const { data, error } = await this.supabase
      .from('sentences')
      .select(
        'id, track, text_en, text_ko, cefr_level, situation, source, license, curriculum_step_id, is_phrase',
      )
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const sentence: Sentence = {
      id: data.id as string,
      track: data.track as Track,
      textEn: data.text_en as string,
      textKo: (data.text_ko as string | null) ?? null,
      cefrLevel: data.cefr_level as CEFRLevel,
      situation: (data.situation as string | null) ?? null,
      source: data.source as string,
      license: data.license as string,
      curriculumStepId: (data.curriculum_step_id as string | null | undefined) ?? null,
      isPhrase: (data.is_phrase as boolean | undefined) ?? false,
    };
    await this.writeCache('sentence', sentence.id, sentence);
    return sentence;
  }

  /** Fetch multiple sentences by IDs, sorted by created_at ASC so resume
   *  history reflects the learning order (not Set insertion order). */
  async getSentencesByIds(ids: readonly string[]): Promise<Sentence[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.supabase
      .from('sentences')
      .select(
        'id, track, text_en, text_ko, cefr_level, situation, source, license, curriculum_step_id, is_phrase, created_at',
      )
      .in('id', ids as string[])
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id as string,
      track: row.track as Track,
      textEn: row.text_en as string,
      textKo: (row.text_ko as string | null) ?? null,
      cefrLevel: row.cefr_level as CEFRLevel,
      situation: (row.situation as string | null) ?? null,
      source: row.source as string,
      license: row.license as string,
      curriculumStepId: (row.curriculum_step_id as string | null | undefined) ?? null,
      isPhrase: (row.is_phrase as boolean | undefined) ?? false,
    }));
  }

  /**
   * Fetch all production sentences for the given curriculum steps,
   * filtered by CEFR level (≤ maxCefrLevel), ordered by step → created_at.
   * Used by TrackASessionScreen to preload the full Day in one shot.
   */
  async getSentencesForSteps(
    stepIds: readonly string[],
    maxCefrLevel?: CEFRLevel,
  ): Promise<Sentence[]> {
    if (stepIds.length === 0) return [];

    let query = this.supabase
      .from('sentences')
      .select(
        'id, track, text_en, text_ko, cefr_level, situation, source, license, curriculum_step_id, is_phrase, created_at',
      )
      .in('curriculum_step_id', stepIds as string[])
      .eq('status', 'production');

    if (maxCefrLevel) {
      const cefrOrder: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
      const allowed = cefrOrder.slice(0, cefrOrder.indexOf(maxCefrLevel) + 1);
      query = query.in('cefr_level', allowed);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const stepOrder = new Map(stepIds.map((id, i) => [id, i]));
    // Sort by step order first, then by created_at within the step.
    rows.sort((a, b) => {
      const sa = stepOrder.get(a.curriculum_step_id as string) ?? 999;
      const sb = stepOrder.get(b.curriculum_step_id as string) ?? 999;
      if (sa !== sb) return sa - sb;
      const ta = new Date(a.created_at as string).getTime();
      const tb = new Date(b.created_at as string).getTime();
      return ta - tb;
    });

    return rows.map((row) => ({
      id: row.id as string,
      track: row.track as Track,
      textEn: row.text_en as string,
      textKo: (row.text_ko as string | null) ?? null,
      cefrLevel: row.cefr_level as CEFRLevel,
      situation: (row.situation as string | null) ?? null,
      source: row.source as string,
      license: row.license as string,
      curriculumStepId: (row.curriculum_step_id as string | null | undefined) ?? null,
      isPhrase: (row.is_phrase as boolean | undefined) ?? false,
    }));
  }

  async getChunks(sentenceId: string): Promise<Chunk[]> {
    const cached = await this.readCache<Chunk[]>('chunks', sentenceId);
    if (cached) return cached;
    const { data, error } = await this.supabase
      .from('chunks')
      .select('id, sentence_id, order_index, text, depth, role')
      .eq('sentence_id', sentenceId)
      .order('order_index', { ascending: true });
    if (error) throw new Error(error.message);
    const chunks: Chunk[] = (data ?? []).map((r) => ({
      id: r.id as string,
      sentenceId: r.sentence_id as string,
      orderIndex: r.order_index as number,
      text: r.text as string,
      depth: r.depth as number,
      role: (r.role as string | null) ?? null,
    }));
    await this.writeCache('chunks', sentenceId, chunks);
    return chunks;
  }

  async getSentenceSummary(sentenceId: string): Promise<StructureSummary | null> {
    const cached = await this.readCache<StructureSummary>('summary', sentenceId);
    if (cached) return cached;
    const { data, error } = await this.supabase
      .from('sentence_summary')
      .select('sentence_id, who, what, where_at, when_at')
      .eq('sentence_id', sentenceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const summary: StructureSummary = {
      sentenceId: data.sentence_id as string,
      who: (data.who as string | null) ?? null,
      what: (data.what as string | null) ?? null,
      whereAt: (data.where_at as string | null) ?? null,
      whenAt: (data.when_at as string | null) ?? null,
    };
    await this.writeCache('summary', sentenceId, summary);
    return summary;
  }

  async getVocabEntry(word: string): Promise<VocabEntry | null> {
    const key = word.toLowerCase();
    const cached = await this.readCache<VocabEntry>('vocab', key);
    if (cached) return cached;
    const { data, error } = await this.supabase
      .from('vocab_entries')
      .select('word, pos, meaning_ko, ipa, etymology, mnemonic, example_sentence_ids')
      .eq('word', key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const entry: VocabEntry = {
      word: data.word as string,
      pos: (data.pos as string | null) ?? null,
      meaningKo: (data.meaning_ko as string | null) ?? null,
      ipa: (data.ipa as string | null) ?? null,
      etymology: data.etymology ?? null,
      mnemonic: data.mnemonic ?? null,
      exampleSentenceIds: (data.example_sentence_ids as string[] | null) ?? [],
    };
    await this.writeCache('vocab', key, entry);
    return entry;
  }

  async getPatternDrillSet(originSentenceId: string): Promise<PatternDrill | null> {
    const cached = await this.readCache<PatternDrill>('drill', originSentenceId);
    if (cached) {
      // Re-validate on cache hit: the row may have been cached before we
      // tightened the schema, or the server may have served a new shape
      // since. If it no longer parses, fall through to a fresh fetch.
      const reparsed = parsePatternDrillVariants(cached.variants);
      if (reparsed) return { ...cached, variants: reparsed };
    }
    const { data, error } = await this.supabase
      .from('pattern_drills')
      .select('id, origin_sentence_id, variants')
      .eq('origin_sentence_id', originSentenceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const variants = parsePatternDrillVariants(data.variants);
    if (!variants) return null;
    const drill: PatternDrill = {
      id: data.id as string,
      originSentenceId: data.origin_sentence_id as string,
      variants,
    };
    await this.writeCache('drill', originSentenceId, drill);
    return drill;
  }

  /**
   * Count the number of production sentences for a given curriculum step.
   * Used by the session screen to show progress (e.g. "5 / 20").
   */
  /**
   * Count the number of production sentences for a given curriculum step,
   * optionally filtered by CEFR level range (matches pick_next_sentence
   * RPC behavior so totalCount reflects actually-available sentences).
   */
  async countSentencesInStep(curriculumStepId: string, maxCefrLevel?: CEFRLevel): Promise<number> {
    const cefrOrder: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
    let query = this.supabase
      .from('sentences')
      .select('id', { count: 'exact', head: true })
      .eq('curriculum_step_id', curriculumStepId)
      .eq('status', 'production');
    if (maxCefrLevel) {
      const allowed = cefrOrder.slice(0, cefrOrder.indexOf(maxCefrLevel) + 1);
      query = query.in('cefr_level', allowed);
    }
    const { count, error } = await query;
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  async getRecentTappedWords(limit: number): Promise<RecentTappedWord[]> {
    if (!this.db) return [];
    const rows = await this.db.getAllAsync<{
      word: string;
      last_tapped_at: number;
      tap_count: number;
    }>(
      `SELECT word, MAX(tapped_at) AS last_tapped_at, COUNT(*) AS tap_count
       FROM word_tap_events
       GROUP BY word
       ORDER BY last_tapped_at DESC
       LIMIT ?;`,
      limit,
    );
    return rows.map((r) => ({
      word: r.word,
      lastTappedAt: r.last_tapped_at,
      tapCount: r.tap_count,
    }));
  }

  /* RPC handles CEFR widening and ranking server-side; no helper needed here. */

  private async readCache<T>(kind: CacheKind, key: string): Promise<T | null> {
    if (!this.db) return null;
    const row = await this.db.getFirstAsync<{
      payload_json: string;
      fetched_at: number;
    }>(`SELECT payload_json, fetched_at FROM content_cache WHERE kind = ? AND key = ?;`, kind, key);
    if (!row) return null;
    if (Date.now() - row.fetched_at > CACHE_TTL_MS) return null;
    return JSON.parse(row.payload_json) as T;
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
