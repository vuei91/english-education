/**
 * ContentService tests (updated for RPC-based pick_next_sentence).
 *
 * We fake SQLite and Supabase; the service is a thin adapter so the
 * interesting behaviour is argument shaping and post-processing.
 */

import { ContentService } from '../ContentService';

type CacheRow = { kind: string; key: string; payload_json: string; fetched_at: number };

function createFakeDb(initialTaps: { word: string; tapped_at: number }[] = []) {
  const cache: CacheRow[] = [];
  const taps = [...initialTaps];

  const db = {
    runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.startsWith('INSERT OR REPLACE INTO content_cache')) {
        const [kind, key, payload_json, fetched_at] = params as [string, string, string, number];
        const idx = cache.findIndex((c) => c.kind === kind && c.key === key);
        const row: CacheRow = { kind, key, payload_json, fetched_at };
        if (idx === -1) cache.push(row);
        else cache[idx] = row;
      }
    }),
    getFirstAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.startsWith('SELECT payload_json, fetched_at FROM content_cache')) {
        const [kind, key] = params as [string, string];
        const hit = cache.find((c) => c.kind === kind && c.key === key);
        return hit ? { payload_json: hit.payload_json, fetched_at: hit.fetched_at } : null;
      }
      return null;
    }),
    getAllAsync: jest.fn(async () => {
      const grouped = new Map<string, { word: string; last_tapped_at: number; tap_count: number }>();
      for (const t of taps) {
        const prev = grouped.get(t.word);
        if (!prev) grouped.set(t.word, { word: t.word, last_tapped_at: t.tapped_at, tap_count: 1 });
        else
          grouped.set(t.word, {
            word: t.word,
            last_tapped_at: Math.max(prev.last_tapped_at, t.tapped_at),
            tap_count: prev.tap_count + 1,
          });
      }
      return [...grouped.values()].sort((a, b) => b.last_tapped_at - a.last_tapped_at);
    }),
  };

  return { db: db as unknown as ConstructorParameters<typeof ContentService>[0], cache };
}

function createFakeSupabase(rpcRows: Record<string, unknown>[]) {
  const rpc = jest.fn(async () => ({ data: rpcRows, error: null }));
  const client = { rpc } as unknown as ConstructorParameters<typeof ContentService>[1];
  return { client, rpc };
}

describe('ContentService.getNextSentence', () => {
  const row = {
    id: 's1',
    track: 'A',
    text_en: 'I want to eat pizza.',
    text_ko: '나는 피자가 먹고 싶어.',
    situation: 'food',
    source: 'tatoeba',
    license: 'CC-BY-2.0-FR',
  };

  it('passes hot words + excludes into the RPC', async () => {
    const { db } = createFakeDb();
    const { client, rpc } = createFakeSupabase([row]);
    const svc = new ContentService(db, client);

    await svc.getNextSentence('A', {
      hotWords: ['Passport', 'LATTE'],
      excludeIds: ['abc'],
    });

    expect(rpc).toHaveBeenCalledWith('pick_next_sentence', {
      p_track: 'A',
      p_hot_words: ['passport', 'latte'],
      p_exclude_ids: ['abc'],
      p_curriculum_step_id: null,
    });
  });

  it('maps the RPC row into a Sentence and caches it', async () => {
    const { db, cache } = createFakeDb();
    const { client } = createFakeSupabase([row]);
    const svc = new ContentService(db, client);

    const sentence = await svc.getNextSentence('A');

    expect(sentence?.id).toBe('s1');
    expect(sentence?.textEn).toBe('I want to eat pizza.');
    expect(cache.find((c) => c.kind === 'sentence' && c.key === 's1')).toBeDefined();
  });

  it('returns null when the RPC yields no rows', async () => {
    const { db } = createFakeDb();
    const { client } = createFakeSupabase([]);
    const svc = new ContentService(db, client);
    expect(await svc.getNextSentence('A')).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  Curriculum step filtering (Tasks 15.1 – 15.3)                     */
/* ------------------------------------------------------------------ */

describe('ContentService.getNextSentence — curriculum step filtering', () => {
  const stepId = 'step-phrase-001';

  const curriculumRow = {
    id: 's-cur-1',
    track: 'A',
    text_en: 'I like apples.',
    text_ko: '나는 사과를 좋아해.',
    situation: 'food',
    source: 'custom',
    license: 'CC0',
    curriculum_step_id: stepId,
    is_phrase: false,
  };

  const phraseRow = {
    ...curriculumRow,
    id: 's-cur-2',
    text_en: 'a red apple',
    text_ko: null,
    curriculum_step_id: stepId,
    is_phrase: true,
  };

  // Task 15.1 — Req 5.1, 5.2: curriculumStepId is forwarded to the RPC
  it('passes p_curriculum_step_id to the RPC when curriculumStepId is provided (Req 5.1, 5.2)', async () => {
    const { db } = createFakeDb();
    const { client, rpc } = createFakeSupabase([curriculumRow]);
    const svc = new ContentService(db, client);

    await svc.getNextSentence('A', { curriculumStepId: stepId });

    expect(rpc).toHaveBeenCalledWith('pick_next_sentence', {
      p_track: 'A',
      p_hot_words: [],
      p_exclude_ids: [],
      p_curriculum_step_id: stepId,
    });
  });

  // Task 15.1 — Req 5.5: is_phrase sentences mapped identically
  it('maps curriculum_step_id and is_phrase fields into the Sentence (Req 5.5)', async () => {
    const { db } = createFakeDb();
    const { client } = createFakeSupabase([curriculumRow]);
    const svc = new ContentService(db, client);

    const sentence = await svc.getNextSentence('A', { curriculumStepId: stepId });

    expect(sentence).not.toBeNull();
    expect(sentence!.curriculumStepId).toBe(stepId);
    expect(sentence!.isPhrase).toBe(false);
  });

  it('maps is_phrase: true for phrase-type sentences (Req 5.5)', async () => {
    const { db } = createFakeDb();
    const { client } = createFakeSupabase([phraseRow]);
    const svc = new ContentService(db, client);

    const sentence = await svc.getNextSentence('A', { curriculumStepId: stepId });

    expect(sentence).not.toBeNull();
    expect(sentence!.isPhrase).toBe(true);
    expect(sentence!.curriculumStepId).toBe(stepId);
  });

  // Task 15.2 — Req 5.3: backward compatibility regression test
  it('passes p_curriculum_step_id as null when curriculumStepId is omitted (Req 5.3)', async () => {
    const { db } = createFakeDb();
    const { client, rpc } = createFakeSupabase([curriculumRow]);
    const svc = new ContentService(db, client);

    await svc.getNextSentence('A');

    expect(rpc).toHaveBeenCalledWith(
      'pick_next_sentence',
      expect.objectContaining({ p_curriculum_step_id: null }),
    );
  });

  // Task 15.3 — Req 5.4: no fallback when curriculumStepId yields empty
  it('returns null when curriculumStepId is provided but RPC yields no rows (Req 5.4)', async () => {
    const { db } = createFakeDb();
    const { client } = createFakeSupabase([]);  // empty result
    const svc = new ContentService(db, client);

    const result = await svc.getNextSentence('A', { curriculumStepId: stepId });

    expect(result).toBeNull();
  });
});

describe('ContentService.getRecentTappedWords', () => {
  it('aggregates taps most-recent-first', async () => {
    const { db } = createFakeDb([
      { word: 'inspect', tapped_at: 1 },
      { word: 'abandon', tapped_at: 3 },
      { word: 'inspect', tapped_at: 5 },
    ]);
    const { client } = createFakeSupabase([]);
    const svc = new ContentService(db, client);

    const words = await svc.getRecentTappedWords(10);

    expect(words.map((w) => w.word)).toEqual(['inspect', 'abandon']);
    expect(words[0]?.tapCount).toBe(2);
    expect(words[0]?.lastTappedAt).toBe(5);
  });
});
