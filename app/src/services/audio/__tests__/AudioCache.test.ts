/**
 * AudioCache + PrefetchQueue tests.
 *
 * These tests exercise the bookkeeping half of Req 7.1 / 7.2 — the
 * part that is deterministic and driver-agnostic. The actual on-disk
 * blob driver is stubbed today (see NativeFileSystemBlobDriver); when
 * it's wired up in a follow-up task the same tests will keep passing
 * because they speak to the driver contract, not the implementation.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  AudioCache,
  MemoryBlobDriver,
  type AudioBlob,
  type AudioCacheKey,
} from '../AudioCache';
import { PrefetchQueue, type AudioFetcher } from '../PrefetchQueue';

const kSentence = (id: string): AudioCacheKey => ({ kind: 'sentence', id });

/**
 * Seeded linear congruential generator. No fast-check in devDeps (see
 * tech-stack.md — new deps need a paper trail), so we roll a tiny
 * deterministic PRNG for the randomized property-style test below.
 * Same seed → same sequence across runs. Validates: Req 7.1, 7.2.
 */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('AudioCache — LRU eviction', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('evicts the least-recently-used entry when the cap is exceeded', async () => {
    const cache = new AudioCache({
      maxBytes: 300,
      driver: new MemoryBlobDriver(),
      persistKey: '@test/lru1',
    });

    await cache.put(kSentence('a'), { bytes: 100 });
    await cache.put(kSentence('b'), { bytes: 100 });
    await cache.put(kSentence('c'), { bytes: 100 });
    // At cap, nothing evicted yet.
    expect(cache.has(kSentence('a'))).toBe(true);
    expect(cache.size()).toBe(300);

    // Push over cap → oldest ('a') is evicted.
    await cache.put(kSentence('d'), { bytes: 100 });
    expect(cache.has(kSentence('a'))).toBe(false);
    expect(cache.has(kSentence('b'))).toBe(true);
    expect(cache.has(kSentence('c'))).toBe(true);
    expect(cache.has(kSentence('d'))).toBe(true);
    expect(cache.size()).toBe(300);
  });

  it('refreshes LRU position on get()', async () => {
    const cache = new AudioCache({
      maxBytes: 300,
      driver: new MemoryBlobDriver(),
      persistKey: '@test/lru2',
    });
    await cache.put(kSentence('a'), { bytes: 100 });
    await cache.put(kSentence('b'), { bytes: 100 });
    await cache.put(kSentence('c'), { bytes: 100 });

    // Touch 'a' → it becomes most recently used; 'b' is now the oldest.
    await cache.get(kSentence('a'));
    await cache.put(kSentence('d'), { bytes: 100 });

    expect(cache.has(kSentence('a'))).toBe(true);
    expect(cache.has(kSentence('b'))).toBe(false);
    expect(cache.has(kSentence('c'))).toBe(true);
    expect(cache.has(kSentence('d'))).toBe(true);
  });

  it('evicts multiple entries in one put if the new blob is large', async () => {
    const cache = new AudioCache({
      maxBytes: 300,
      driver: new MemoryBlobDriver(),
      persistKey: '@test/lru3',
    });
    await cache.put(kSentence('a'), { bytes: 100 });
    await cache.put(kSentence('b'), { bytes: 100 });
    await cache.put(kSentence('c'), { bytes: 100 });

    // One fat blob → evict everything older to make room.
    await cache.put(kSentence('big'), { bytes: 300 });
    expect(cache.has(kSentence('a'))).toBe(false);
    expect(cache.has(kSentence('b'))).toBe(false);
    expect(cache.has(kSentence('c'))).toBe(false);
    expect(cache.has(kSentence('big'))).toBe(true);
    expect(cache.size()).toBe(300);
  });

  /**
   * Randomized sanity check with a seeded RNG. For any sequence of
   * puts, the cache should never exceed the byte cap once
   * enforceCap has run.
   *
   * Validates: Requirements 7.1, 7.2 (cap is a product invariant for
   * the "local cached audio preferred" guarantee — if the cap leaks
   * we'd evict the OS cache ourselves on a real device).
   */
  it('never exceeds the byte cap across 100 random puts (seeded)', async () => {
    const rand = lcg(0xC0FFEE);
    const cache = new AudioCache({
      maxBytes: 1_000,
      driver: new MemoryBlobDriver(),
      persistKey: '@test/lru-prop',
    });
    for (let i = 0; i < 100; i += 1) {
      const id = `s${Math.floor(rand() * 50)}`; // 50 distinct keys
      const bytes = 50 + Math.floor(rand() * 300); // 50..349
      await cache.put(kSentence(id), { bytes });
      expect(cache.size()).toBeLessThanOrEqual(1_000);
    }
  });
});

describe('AudioCache — metadata persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('serialises the index to AsyncStorage after put()', async () => {
    const setItem = jest.spyOn(AsyncStorage, 'setItem');
    const cache = new AudioCache({
      maxBytes: 1_000,
      driver: new MemoryBlobDriver(),
      persistKey: '@test/persist1',
    });
    await cache.put(kSentence('a'), { bytes: 100 });

    expect(setItem).toHaveBeenCalled();
    const raw = await AsyncStorage.getItem('@test/persist1');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toContainEqual(
      expect.arrayContaining(['sentence/a', expect.objectContaining({ bytes: 100 })]),
    );
  });

  it('rehydrates has() after re-creating the cache with the same persistKey', async () => {
    const driver = new MemoryBlobDriver();
    const cacheA = new AudioCache({
      maxBytes: 1_000,
      driver,
      persistKey: '@test/persist2',
    });
    await cacheA.put(kSentence('a'), { bytes: 100 });
    await cacheA.put(kSentence('b'), { bytes: 100 });

    // New instance, same persist key — simulate app restart.
    const cacheB = new AudioCache({
      maxBytes: 1_000,
      driver,
      persistKey: '@test/persist2',
    });
    await cacheB.hydrate();
    expect(cacheB.has(kSentence('a'))).toBe(true);
    expect(cacheB.has(kSentence('b'))).toBe(true);
    expect(cacheB.size()).toBe(200);
  });

  it('clear() wipes both the driver and the persisted index', async () => {
    const cache = new AudioCache({
      maxBytes: 1_000,
      driver: new MemoryBlobDriver(),
      persistKey: '@test/persist3',
    });
    await cache.put(kSentence('a'), { bytes: 100 });
    await cache.clear();

    expect(cache.has(kSentence('a'))).toBe(false);
    expect(cache.size()).toBe(0);
    expect(await AsyncStorage.getItem('@test/persist3')).toBeNull();
  });
});

describe('PrefetchQueue', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('de-dupes repeat enqueues for the same id', async () => {
    const cache = new AudioCache({
      maxBytes: 10_000,
      driver: new MemoryBlobDriver(),
      persistKey: '@test/prefetch1',
    });
    const fetcher = jest.fn<
      ReturnType<AudioFetcher>,
      Parameters<AudioFetcher>
    >(async () => ({ uri: 'https://x/y.m4a', bytes: 1_000 }));

    const queue = new PrefetchQueue(cache, fetcher, { concurrency: 2 });
    // Enqueue same id five times.
    await queue.prefetch(['s1', 's1', 's1', 's1', 's1']);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.has(kSentence('s1'))).toBe(true);
  });

  it('respects the concurrency cap', async () => {
    const cache = new AudioCache({
      maxBytes: 100_000,
      driver: new MemoryBlobDriver(),
      persistKey: '@test/prefetch2',
    });

    let active = 0;
    let maxActive = 0;
    const pending: Array<(value: { bytes: number }) => void> = [];
    let observedActive = 0;

    const fetcher: AudioFetcher = () => {
      active += 1;
      observedActive += 1;
      maxActive = Math.max(maxActive, active);
      return new Promise<{ bytes: number }>((resolve) => {
        pending.push((v) => {
          active -= 1;
          resolve(v);
        });
      });
    };

    const queue = new PrefetchQueue(cache, fetcher, { concurrency: 2 });
    const ids = Array.from({ length: 10 }, (_, i) => `s${i}`);
    const done = queue.prefetch(ids);

    /** Yield long enough for the queue's post-fetch await chain (driver
     *  write + AsyncStorage persist) to settle. A handful of task ticks
     *  is enough — we keep looping until either a new fetcher has been
     *  scheduled or we exhaust the budget. */
    const tick = async (rounds = 10): Promise<void> => {
      for (let i = 0; i < rounds; i += 1) {
        await Promise.resolve();
      }
    };

    await tick();
    expect(queue.activeCount()).toBeLessThanOrEqual(2);
    expect(maxActive).toBeLessThanOrEqual(2);

    // Drain pending fetches one at a time; each resolution unlocks a
    // slot, and the next fetcher should be scheduled within a few
    // microtasks.
    let drained = 0;
    while (drained < ids.length) {
      // Wait for a fetcher to be scheduled (if one isn't yet).
      let spins = 0;
      while (pending.length === 0 && spins < 50) {
        await tick();
        spins += 1;
      }
      if (pending.length === 0) break;
      const resolve = pending.shift();
      resolve?.({ bytes: 100 });
      drained += 1;
      await tick();
      expect(maxActive).toBeLessThanOrEqual(2);
    }

    await done;
    expect(maxActive).toBeLessThanOrEqual(2);
    // Fetcher was called once per unique id — proves the cap was the
    // throttle, not a bug that dropped ids on the floor.
    expect(observedActive).toBe(ids.length);
    for (const id of ids) {
      expect(cache.has(kSentence(id))).toBe(true);
    }
  });

  it('swallows fetcher errors so one failure does not poison the batch', async () => {
    const cache = new AudioCache({
      maxBytes: 10_000,
      driver: new MemoryBlobDriver(),
      persistKey: '@test/prefetch3',
    });
    const fetcher: AudioFetcher = async (key) => {
      if (key.id === 'bad') throw new Error('boom');
      return { bytes: 100 };
    };

    const queue = new PrefetchQueue(cache, fetcher, { concurrency: 2 });
    await expect(
      queue.prefetch(['ok1', 'bad', 'ok2']),
    ).resolves.toBeUndefined();

    expect(cache.has(kSentence('ok1'))).toBe(true);
    expect(cache.has(kSentence('ok2'))).toBe(true);
    expect(cache.has(kSentence('bad'))).toBe(false);
  });

  it('skips ids that are already cached', async () => {
    const cache = new AudioCache({
      maxBytes: 10_000,
      driver: new MemoryBlobDriver(),
      persistKey: '@test/prefetch4',
    });
    await cache.put(kSentence('warm'), { bytes: 100 });

    const fetcher = jest.fn<
      ReturnType<AudioFetcher>,
      Parameters<AudioFetcher>
    >(async () => ({ bytes: 100 } as AudioBlob));

    const queue = new PrefetchQueue(cache, fetcher, { concurrency: 2 });
    await queue.prefetch(['warm', 'cold']);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(kSentence('cold'));
  });
});
