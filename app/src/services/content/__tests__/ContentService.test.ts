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
    cefr_level: 'A2',
    situation: 'food',
    source: 'tatoeba',
    license: 'CC-BY-2.0-FR',
  };

  it('passes level + hot words + excludes into the RPC', async () => {
    const { db } = createFakeDb();
    const { client, rpc } = createFakeSupabase([row]);
    const svc = new ContentService(db, client);

    await svc.getNextSentence('A', 'B1', {
      hotWords: ['Passport', 'LATTE'],
      excludeIds: ['abc'],
    });

    expect(rpc).toHaveBeenCalledWith('pick_next_sentence', {
      p_track: 'A',
      p_cefr: 'B1',
      p_hot_words: ['passport', 'latte'],
      p_exclude_ids: ['abc'],
    });
  });

  it('maps the RPC row into a Sentence and caches it', async () => {
    const { db, cache } = createFakeDb();
    const { client } = createFakeSupabase([row]);
    const svc = new ContentService(db, client);

    const sentence = await svc.getNextSentence('A', 'A2');

    expect(sentence?.id).toBe('s1');
    expect(sentence?.textEn).toBe('I want to eat pizza.');
    expect(cache.find((c) => c.kind === 'sentence' && c.key === 's1')).toBeDefined();
  });

  it('returns null when the RPC yields no rows', async () => {
    const { db } = createFakeDb();
    const { client } = createFakeSupabase([]);
    const svc = new ContentService(db, client);
    expect(await svc.getNextSentence('A', 'A2')).toBeNull();
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
