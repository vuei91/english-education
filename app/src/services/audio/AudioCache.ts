import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * AudioCache — bounded LRU cache for pre-generated audio (Req 7.1, 7.2).
 *
 * The listening experience is the app's #1 product pillar (see
 * product-context.md), so we want to hit local storage on every repeat
 * tap rather than re-resolving the Supabase signed URL and re-streaming
 * the blob. This class is the bookkeeping half of that story:
 *
 *   - A bounded LRU over `{kind, id}` keys, capped by *total bytes*
 *     (default 200 MB, per tasks.md 6.2).
 *   - A metadata index (bytes + lastUsedAt) persisted to AsyncStorage
 *     so LRU order survives app restarts.
 *   - A pluggable blob driver that hides *where* the bytes actually
 *     live. Today we ship a memory driver (tests, web, graceful
 *     fallback) and a stubbed native driver. The on-disk driver backed
 *     by `expo-file-system` is a follow-up: see `NativeFileSystemBlobDriver`
 *     below for the exact file-system calls a subsequent task needs to
 *     wire in before this cache yields a true playable URI on device.
 *
 * Integration note for `AudioService.speak`:
 *   Because the memory driver cannot produce a native-playable URI from
 *   an in-memory Uint8Array, we currently use the cache as a *resolution
 *   record*. The playable source remains the signed URL returned by the
 *   Edge Function, but every resolved URL is accounted for through
 *   `AudioCache.put(...)` so the LRU metric exists and the metadata
 *   index is already being exercised. When the on-device file driver
 *   lands, the driver swap is the only code change required.
 *
 * Non-Goal anchor (Req 7.5): this file must never import a microphone,
 * STT, or recording API. Audio flows in only — never out.
 */

export type AudioCacheKind = 'sentence' | 'chunk' | 'vocab';

export type AudioCacheKey = {
  kind: AudioCacheKind;
  id: string;
};

export function keyToString({ kind, id }: AudioCacheKey): string {
  return `${kind}/${id}`;
}

/**
 * The blob the cache owns. `uri` is what the audio player should load;
 * on the memory driver it may be undefined (record-only). `bytes` is
 * the serialized size used for LRU accounting — for URL-only entries we
 * charge a small synthetic cost so the LRU still has a notion of
 * "least recently used".
 */
export type AudioBlob = {
  uri?: string;
  bytes: number;
};

/**
 * Low-level storage contract. A driver is responsible for the actual
 * blob bytes (if any); the LRU bookkeeping lives in `AudioCache`.
 */
export interface AudioCacheBlobDriver {
  read(key: string): Promise<AudioBlob | null>;
  write(key: string, blob: AudioBlob): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Memory driver. Stores blobs in a Map keyed by the canonical
 * `${kind}/${id}` string. Used in tests, on web, and as a safe fallback
 * when the native driver cannot be initialised.
 */
export class MemoryBlobDriver implements AudioCacheBlobDriver {
  private readonly blobs = new Map<string, AudioBlob>();

  async read(key: string): Promise<AudioBlob | null> {
    return this.blobs.get(key) ?? null;
  }

  async write(key: string, blob: AudioBlob): Promise<void> {
    this.blobs.set(key, blob);
  }

  async remove(key: string): Promise<void> {
    this.blobs.delete(key);
  }

  async clear(): Promise<void> {
    this.blobs.clear();
  }
}

/**
 * Downloader contract for the on-disk audio cache.
 *
 * The driver itself stays agnostic of the native file-system API —
 * whatever is provided at construction time does the actual byte
 * transfer. A future task will implement this interface on top of
 * `expo-file-system` and inject it at app boot; until that happens the
 * driver runs with `downloader === undefined` and behaves as a no-op
 * (memory-only path keeps the service working via the signed URL).
 *
 * Shape choice (kept minimal on purpose):
 *
 *   - `download(remoteUrl, localKey)` — fetch the bytes for `remoteUrl`
 *     and persist them under a driver-internal mapping of `localKey`.
 *     Returns the playable local URI plus actual byte count (used for
 *     LRU accounting so synthetic sizes can be replaced).
 *   - `has(localKey)` — cheap existence check; driver `read` uses this
 *     to decide whether a cache lookup should return a blob with `uri`.
 *   - `resolve(localKey)` — return the local URI for an already-cached
 *     key without touching the network. Split from `has` so drivers
 *     that store URI separately (e.g. keyed AsyncStorage) don't have to
 *     reconstruct it.
 *   - `remove(localKey)` — delete the cached bytes. Called by LRU
 *     eviction and by `clear()`.
 *
 * All methods are async because most native file-system APIs are, and
 * forcing them to be sync in the stub would prevent a clean swap.
 */
export interface AudioDownloader {
  download(remoteUrl: string, localKey: string): Promise<{ uri: string; bytes: number }>;
  has(localKey: string): Promise<boolean>;
  resolve(localKey: string): Promise<string | null>;
  remove(localKey: string): Promise<void>;
  clear?(): Promise<void>;
}

/**
 * Native driver for the on-disk audio cache.
 *
 * This driver holds no file-system logic of its own; it delegates
 * every byte operation to an injected `AudioDownloader`. That split
 * lets the cache contract (blob read/write/remove) stay decoupled
 * from the native implementation, and lets tests exercise the driver
 * with a fake downloader instead of mocking `expo-file-system`.
 *
 * Behaviour matrix:
 *
 *   | downloader | read()                          | write(key, blob)              |
 *   |------------|---------------------------------|-------------------------------|
 *   | undefined  | always null (memory-only path)  | no-op                         |
 *   | provided   | uri from `resolve` if `has`     | download(blob.uri, key)       |
 *
 * When `downloader` is undefined the `AudioService` still works: the
 * LRU tracks resolved URLs and playback falls through to the signed
 * URL path (see `AudioService.resolvePlayableUrl`). That's the
 * intentional state for Task 6.3 — the follow-up wiring flip is:
 *
 *   const driver = new NativeFileSystemBlobDriver({
 *     downloader: createExpoFileSystemDownloader(),
 *   });
 *
 * JSDoc note for the follow-up task:
 *   The app will construct `createExpoFileSystemDownloader` once
 *   `expo-file-system` is approved for the dependency manifest
 *   (see tasks.md §6.3 follow-ups). The shape above is the only
 *   integration surface, so the wiring is a one-liner.
 */
export class NativeFileSystemBlobDriver implements AudioCacheBlobDriver {
  private readonly downloader?: AudioDownloader;

  constructor(options: { downloader?: AudioDownloader } = {}) {
    this.downloader = options.downloader;
  }

  async read(key: string): Promise<AudioBlob | null> {
    if (!this.downloader) return null;
    const exists = await this.downloader.has(key);
    if (!exists) return null;
    const uri = await this.downloader.resolve(key);
    if (!uri) return null;
    // We don't know the stored byte count without stat-ing; callers
    // that need it read it from the LRU index. Reporting 0 here is
    // fine because the index entry is already accounted for.
    return { uri, bytes: 0 };
  }

  async write(key: string, blob: AudioBlob): Promise<void> {
    if (!this.downloader) return;
    if (!blob.uri) return; // nothing to download
    await this.downloader.download(blob.uri, key);
  }

  async remove(key: string): Promise<void> {
    if (!this.downloader) return;
    await this.downloader.remove(key);
  }

  async clear(): Promise<void> {
    if (!this.downloader) return;
    if (this.downloader.clear) {
      await this.downloader.clear();
    }
  }
}

type IndexEntry = {
  bytes: number;
  lastUsedAt: number;
};

export type AudioCacheOptions = {
  /** Max total bytes. Defaults to 200 * 1024 * 1024 (200 MB). */
  maxBytes?: number;
  /** Storage driver. Defaults to `MemoryBlobDriver`. */
  driver?: AudioCacheBlobDriver;
  /** AsyncStorage key for the persisted LRU index. */
  persistKey?: string;
  /** Monotonic clock (ms). Overridable for tests. */
  now?: () => number;
};

const DEFAULT_MAX_BYTES = 200 * 1024 * 1024;
const DEFAULT_PERSIST_KEY = '@sentenceflow/audio-cache-index/v1';

export class AudioCache {
  private readonly driver: AudioCacheBlobDriver;
  private readonly maxBytes: number;
  private readonly persistKey: string;
  private readonly now: () => number;

  /** Insertion order = LRU order (oldest first, newest last). */
  private readonly index = new Map<string, IndexEntry>();
  private totalBytes = 0;

  /**
   * Single-threaded JS doesn't need a real mutex, but async driver
   * writes interleave; chaining awaited operations on one Promise
   * serialises `put`/`evict` so the index never observes a partial
   * update.
   */
  private mutex: Promise<void> = Promise.resolve();

  private hydrated = false;

  constructor(options: AudioCacheOptions = {}) {
    this.driver = options.driver ?? new MemoryBlobDriver();
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.persistKey = options.persistKey ?? DEFAULT_PERSIST_KEY;
    this.now = options.now ?? Date.now;
  }

  /**
   * Rehydrate the LRU index from AsyncStorage. Safe to call many times;
   * only the first load actually touches storage.
   */
  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(this.persistKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Array<[string, IndexEntry]>;
        if (Array.isArray(parsed)) {
          this.index.clear();
          this.totalBytes = 0;
          // Re-insert in stored order → LRU order survives restart.
          for (const entry of parsed) {
            if (!Array.isArray(entry) || entry.length !== 2) continue;
            const [k, v] = entry;
            if (typeof k !== 'string' || !v || typeof v.bytes !== 'number') continue;
            this.index.set(k, v);
            this.totalBytes += v.bytes;
          }
        }
      }
    } catch {
      // Corrupt / missing index → start empty. Not a fatal error.
    }
    this.hydrated = true;
  }

  /** Total tracked bytes. */
  size(): number {
    return this.totalBytes;
  }

  /** Number of tracked keys. */
  entryCount(): number {
    return this.index.size;
  }

  has(key: AudioCacheKey): boolean {
    return this.index.has(keyToString(key));
  }

  /**
   * Read a blob, refreshing its LRU position as a side effect. Callers
   * that only want to probe presence should use `has`.
   */
  async get(key: AudioCacheKey): Promise<AudioBlob | null> {
    await this.hydrate();
    const k = keyToString(key);
    const entry = this.index.get(k);
    if (!entry) return null;
    // Refresh LRU position: delete + re-set pushes to the "newest" end.
    this.index.delete(k);
    entry.lastUsedAt = this.now();
    this.index.set(k, entry);
    await this.persist();
    return this.driver.read(k);
  }

  /**
   * Record a blob. Serialised via the mutex so concurrent `put`s never
   * corrupt the LRU index. After writing, evicts the oldest entries
   * until `totalBytes <= maxBytes`.
   */
  async put(key: AudioCacheKey, blob: AudioBlob): Promise<void> {
    const run = async () => {
      await this.hydrate();
      const k = keyToString(key);
      const existing = this.index.get(k);
      if (existing) {
        this.totalBytes -= existing.bytes;
        this.index.delete(k);
      }
      const entry: IndexEntry = {
        bytes: Math.max(0, Math.floor(blob.bytes)),
        lastUsedAt: this.now(),
      };
      this.index.set(k, entry);
      this.totalBytes += entry.bytes;
      await this.driver.write(k, blob);
      await this.enforceCap();
      await this.persist();
    };
    this.mutex = this.mutex.then(run, run);
    return this.mutex;
  }

  /** Drop a key unconditionally. Used by the LRU and by `clear`. */
  async evict(key: AudioCacheKey): Promise<void> {
    const run = async () => {
      const k = keyToString(key);
      const entry = this.index.get(k);
      if (!entry) return;
      this.index.delete(k);
      this.totalBytes -= entry.bytes;
      await this.driver.remove(k);
      await this.persist();
    };
    this.mutex = this.mutex.then(run, run);
    return this.mutex;
  }

  /** Wipe everything, including persisted index. */
  async clear(): Promise<void> {
    const run = async () => {
      this.index.clear();
      this.totalBytes = 0;
      await this.driver.clear();
      await AsyncStorage.removeItem(this.persistKey).catch(() => undefined);
    };
    this.mutex = this.mutex.then(run, run);
    return this.mutex;
  }

  /**
   * Evict oldest entries until under the byte cap. The Map keeps
   * insertion order, so the first iterator entry *is* the LRU entry.
   */
  private async enforceCap(): Promise<void> {
    if (this.totalBytes <= this.maxBytes) return;
    const iterator = this.index.entries();
    while (this.totalBytes > this.maxBytes) {
      const next = iterator.next();
      if (next.done) break;
      const [k, entry] = next.value;
      this.index.delete(k);
      this.totalBytes -= entry.bytes;
      try {
        await this.driver.remove(k);
      } catch {
        // Driver failure shouldn't leak an eviction — index is the
        // source of truth the app cares about.
      }
    }
  }

  private async persist(): Promise<void> {
    try {
      const snapshot: Array<[string, IndexEntry]> = Array.from(this.index.entries());
      await AsyncStorage.setItem(this.persistKey, JSON.stringify(snapshot));
    } catch {
      // Persistence is best-effort; losing the index only costs us LRU
      // ordering on next launch.
    }
  }
}

/**
 * Default cache instance shared across the app. Screens should not new
 * their own — use this one so every play-through contributes to the
 * same LRU window.
 */
export const audioCache = new AudioCache();
