import { AudioCache, type AudioCacheKey, keyToString } from './AudioCache';

/**
 * PrefetchQueue — bounded-concurrency warmer for the audio cache.
 *
 * Rationale: when the user opens Track B, we know the next chunk ids in
 * advance and want their audio ready before the user taps play (Req
 * 7.1, 7.2). Firing ten parallel network requests is wasteful and can
 * saturate a slow connection, so we cap in-flight fetches to
 * `concurrency` (default 2) and de-dup by cache key so a screen that
 * re-renders doesn't re-enqueue the same id.
 *
 * `prefetch(ids)` resolves once every id has either landed in the cache
 * or the fetcher has failed. Failures are *logged* (well, swallowed —
 * the app's logging is intentionally minimal) and never reject the
 * outer promise. A warmer that throws would be a worse UX than a
 * warmer that simply leaves a miss for the on-demand path to handle.
 */

/**
 * Fetcher contract: given a cache key, return the blob to store, or
 * `null` to signal "nothing to cache" (e.g. the server has no audio
 * for this key yet). Fetchers may throw; the queue will treat that as
 * a failure and move on.
 */
export type AudioFetcher = (key: AudioCacheKey) => Promise<{
  uri?: string;
  bytes: number;
} | null>;

export type PrefetchQueueOptions = {
  concurrency?: number;
};

type QueueItem = {
  key: AudioCacheKey;
  keyStr: string;
  resolvers: Array<() => void>;
};

export class PrefetchQueue {
  private readonly cache: AudioCache;
  private readonly fetcher: AudioFetcher;
  private readonly concurrency: number;

  private readonly waiting: QueueItem[] = [];
  private readonly inFlight = new Map<string, QueueItem>();
  /** De-dup guard: same key is never queued twice concurrently. */
  private readonly enqueued = new Set<string>();

  constructor(
    cache: AudioCache,
    fetcher: AudioFetcher,
    options: PrefetchQueueOptions = {},
  ) {
    this.cache = cache;
    this.fetcher = fetcher;
    this.concurrency = Math.max(1, options.concurrency ?? 2);
  }

  /**
   * Enqueue every id for its kind. Returns a promise that resolves
   * when *all* ids have either landed in the cache or failed. Never
   * rejects — prefetch is best-effort.
   */
  async prefetch(
    ids: string[],
    kind: AudioCacheKey['kind'] = 'sentence',
  ): Promise<void> {
    if (ids.length === 0) return;
    const promises = ids.map((id) => this.enqueueOne({ kind, id }));
    await Promise.all(promises);
  }

  /** Number of items currently being fetched. Exposed for tests. */
  activeCount(): number {
    return this.inFlight.size;
  }

  /** Number of items waiting for a slot. Exposed for tests. */
  pendingCount(): number {
    return this.waiting.length;
  }

  private enqueueOne(key: AudioCacheKey): Promise<void> {
    const keyStr = keyToString(key);

    // Already cached? Nothing to do — resolve synchronously.
    if (this.cache.has(key)) {
      return Promise.resolve();
    }

    // Already queued / in-flight for this exact key? Piggy-back on
    // that item's resolver list so the second caller waits for the
    // first fetch to finish.
    const inFlight = this.inFlight.get(keyStr);
    if (inFlight) {
      return new Promise<void>((resolve) => {
        inFlight.resolvers.push(resolve);
      });
    }
    const waiting = this.waiting.find((w) => w.keyStr === keyStr);
    if (waiting) {
      return new Promise<void>((resolve) => {
        waiting.resolvers.push(resolve);
      });
    }

    const item: QueueItem = { key, keyStr, resolvers: [] };
    const promise = new Promise<void>((resolve) => {
      item.resolvers.push(resolve);
    });
    this.waiting.push(item);
    this.enqueued.add(keyStr);
    this.pump();
    return promise;
  }

  private pump(): void {
    while (this.inFlight.size < this.concurrency && this.waiting.length > 0) {
      const item = this.waiting.shift();
      if (!item) break;
      this.inFlight.set(item.keyStr, item);
      void this.run(item);
    }
  }

  private async run(item: QueueItem): Promise<void> {
    try {
      const blob = await this.fetcher(item.key);
      if (blob) {
        await this.cache.put(item.key, blob);
      }
    } catch {
      // Best-effort warmer: swallow.
    } finally {
      this.inFlight.delete(item.keyStr);
      this.enqueued.delete(item.keyStr);
      for (const resolve of item.resolvers) {
        resolve();
      }
      this.pump();
    }
  }
}
