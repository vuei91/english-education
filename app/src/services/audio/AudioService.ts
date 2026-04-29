import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';

import { getSupabaseClient } from '../../lib/supabase';
import {
  AudioCache,
  audioCache as sharedAudioCache,
  type AudioCacheKey,
  type AudioCacheKind,
} from './AudioCache';

/**
 * AudioService — Req 7.
 *
 * Listening is the app's #1 experience (product-context.md), so we
 * strongly prefer pre-generated natural audio from Supabase Storage over
 * device TTS. Order of operations for `speak(text, options)`:
 *
 *   1. If the cache already has a blob for this `{kind, id}`, play the
 *      cached URI (Req 7.1).
 *   2. Otherwise, ask the `get-signed-audio-url` Edge Function; on
 *      success, record the entry in the LRU via `AudioCache.put` and
 *      play the signed URL (Req 7.2).
 *   3. On any failure (Storage miss, network offline, Edge Function
 *      error) fall back to `expo-speech` device TTS (Req 7.3).
 *
 * Playback rate is controlled via `setPlaybackRate` on the native
 * player (Req 7.4). We only keep one player alive at a time — calling
 * `speak` again or `stop()` releases the previous one so rapid taps
 * don't stack simultaneous streams.
 *
 * Non-Goal anchor (Req 7.5): this module must never import a recorder,
 * microphone permission, or speech-to-text API. The only inputs are
 * text (for TTS fallback) and a signed URL.
 */

export type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.25;

/**
 * Default BCP 47 tag for the device TTS fallback. The MVP content is
 * English; callers that eventually feed non-English text (e.g. Korean
 * translations) must pass `options.language` explicitly.
 */
export const DEFAULT_TTS_LANGUAGE = 'en-US';

export type SpeakOptions = {
  /** Optional identifier used as cache key and Edge Function slug. */
  sentenceId?: string;
  /** Kind of content — defaults to 'sentence'. Chunk/vocab share the
   *  same Edge Function contract but live under separate cache keys. */
  kind?: AudioCacheKind;
  /** Playback rate. Defaults to 1. */
  rate?: PlaybackSpeed;
  /** BCP 47 language for TTS fallback. Defaults to DEFAULT_TTS_LANGUAGE. */
  language?: string;
};

/**
 * We don't know the real byte size of an MP3/M4A without downloading
 * it, and the memory driver is URL-only anyway. Charge a small
 * synthetic cost so the LRU has a notion of "size" even before the
 * on-device file driver lands. At 64 KB per entry the 200 MB cap maps
 * to ~3,200 tracked entries — well above the MVP's pre-seed count.
 */
const SYNTHETIC_BLOB_BYTES = 64 * 1024;

type ResolvedEntry = {
  url: string;
  expiresAt: number;
};

const SIGNED_URL_TTL_MS = 55 * 60 * 1000; // stay safely inside the 60-min default

export class AudioService {
  private player: AudioPlayer | null = null;
  private readonly cache: AudioCache;
  /** Short-lived URL cache keyed by the canonical `${kind}/${id}`.
   *  The on-disk cache can outlive a signed URL, so we track expiry
   *  here and refetch when it lapses. */
  private readonly resolvedUrls = new Map<string, ResolvedEntry>();
  private audioModeConfigured = false;
  /**
   * Monotonic interrupt token (Req 7.6).
   *
   * Every `stop()` — including the one embedded at the top of
   * `speak()` — bumps this counter. Any `speak()` in flight captures
   * its own generation right after it finishes tearing down the
   * previous playback; if that captured value no longer matches
   * `this.generation` at an await resume point, a newer stop/speak
   * has since invalidated the in-flight call and it must bail before
   * creating a native player.
   *
   * Without this token there was a real race: if `speak()` was
   * awaiting the Edge Function and `stop()` ran during the await,
   * `stop()` would find `this.player === null` (not yet assigned) and
   * exit cleanly, after which `speak()` would resume, create a
   * player, and start playback — defeating the user-visible
   * interruption. Same race applied to two concurrent `speak()` calls
   * (both could create a player and leak one). Kept strictly private
   * so the public API shape stays `speak(...)` / `stop()`.
   */
  private generation = 0;

  constructor(cache: AudioCache = sharedAudioCache) {
    this.cache = cache;
  }

  async speak(text: string, options: SpeakOptions = {}): Promise<void> {
    // `stopInternal` atomically bumps the generation and returns the
    // new value, so our captured `myGen` is guaranteed not to race
    // with a second `speak()` whose own `stopInternal` runs after
    // ours. Calling `this.stop()` here would also work, but we'd have
    // to read `this.generation` in a separate statement — and if a
    // second `speak()` snuck its `stopInternal` in between, we'd read
    // a value that already belongs to the newer call.
    const myGen = await this.stopInternal();
    const rate = options.rate ?? 1;
    const kind: AudioCacheKind = options.kind ?? 'sentence';

    let url: string | null = null;
    if (options.sentenceId) {
      url = await this.resolvePlayableUrl({ kind, id: options.sentenceId });
    }
    // A newer stop/speak fired while we were awaiting the Edge
    // Function — bail before touching the player.
    if (myGen !== this.generation) return;

    if (url) {
      try {
        await this.playUrl(url, rate, myGen);
        return;
      } catch {
        // Fall through to TTS.
      }
    }

    // Device TTS fallback (Req 7.3).
    //
    // `await this.stopInternal()` at the top of `speak` already called
    // `Speech.stop()`, but we call it again defensively in case a
    // concurrent caller queued a TTS utterance between the two
    // awaits. Check the generation each time we resume so a late
    // `stop()` cannot be overwritten by our TTS call.
    //
    // Rate note: expo-speech's `rate` is a multiplier and platforms
    // clamp it differently (iOS clamps to ~0.5–2.0, Android to
    // platform-specific bounds). Our allowed PlaybackSpeed values
    // (0.5 / 0.75 / 1 / 1.25) all sit inside the safe clamp window on
    // both platforms, so we pass `rate` through without our own
    // re-clamping.
    if (myGen !== this.generation) return;
    await Speech.stop();
    if (myGen !== this.generation) return;
    Speech.speak(text, {
      language: options.language ?? DEFAULT_TTS_LANGUAGE,
      rate,
      pitch: 1,
    });
  }

  async stop(): Promise<void> {
    await this.stopInternal();
  }

  /**
   * Tear down the current player, stop any TTS utterance, bump the
   * interrupt generation, and return the new generation value.
   * Private on purpose — the generation token must not appear in the
   * public API (Req 7.6 constraint).
   */
  private async stopInternal(): Promise<number> {
    const myGen = ++this.generation;
    if (this.player) {
      try {
        this.player.pause();
        this.player.remove();
      } catch {
        // Player already torn down.
      }
      this.player = null;
    }
    await Speech.stop();
    return myGen;
  }

  /** Primarily for tests — clears short-lived URL memo. */
  clearCache(): void {
    this.resolvedUrls.clear();
  }

  private async playUrl(
    url: string,
    rate: PlaybackSpeed,
    gen: number,
  ): Promise<void> {
    await this.configureAudioMode();
    // A newer stop/speak invalidated us while we were awaiting the
    // first-run audio-mode setup. Don't create a player the user has
    // already told us to tear down (Req 7.6).
    if (gen !== this.generation) return;
    const player = createAudioPlayer({ uri: url });
    this.player = player;
    try {
      player.setPlaybackRate(rate);
    } catch {
      // setPlaybackRate is best-effort — some platforms may not honour
      // arbitrary rates. Playback still works at 1x.
    }
    player.play();
  }

  private async configureAudioMode(): Promise<void> {
    if (this.audioModeConfigured) return;
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
      this.audioModeConfigured = true;
    } catch {
      // Web / unsupported platforms — carry on without the native mode call.
      this.audioModeConfigured = true;
    }
  }

  /**
   * Resolve a playable URL for a cache key. If the LRU has a cached
   * entry with a URI, return that (Req 7.1). Otherwise hit the Edge
   * Function, record the resolution through the cache for LRU tracking
   * (Req 7.2), and return the freshly-signed URL.
   */
  private async resolvePlayableUrl(
    key: AudioCacheKey,
  ): Promise<string | null> {
    const cacheKeyStr = `${key.kind}/${key.id}`;

    // Short-lived URL memo — avoids a round-trip while the URL is still
    // valid even if the on-disk blob is absent.
    const resolved = this.resolvedUrls.get(cacheKeyStr);
    if (resolved && resolved.expiresAt > Date.now()) {
      // Touch the LRU so repeat plays stay "recent".
      await this.cache.get(key).catch(() => null);
      return resolved.url;
    }

    // Try the cache for a blob with a native URI (future on-disk
    // driver will hit this path).
    const cached = await this.cache.get(key).catch(() => null);
    if (cached?.uri) {
      return cached.uri;
    }

    try {
      const client = getSupabaseClient();
      const { data, error } = await client.functions.invoke<{ url: string }>(
        'get-signed-audio-url',
        { body: { kind: key.kind, id: key.id } },
      );
      if (error || !data?.url) return null;

      this.resolvedUrls.set(cacheKeyStr, {
        url: data.url,
        expiresAt: Date.now() + SIGNED_URL_TTL_MS,
      });
      // Record the resolution in the LRU. When a real on-device
      // downloader is wired into the native driver, `cache.put` will
      // trigger a download under the hood and `cache.get` will return
      // the local URI on the next call. Until then the memory driver
      // just stores `{uri: signedUrl}` and we fall through to the
      // signed URL below.
      await this.cache.put(key, {
        uri: data.url,
        bytes: SYNTHETIC_BLOB_BYTES,
      }).catch(() => undefined);

      // If the driver transformed the blob into a local URI (i.e. a
      // real downloader is present), prefer that over the signed URL
      // so playback uses on-disk bytes — this is the Req 7.2 "…재생
      // 후 로컬에 캐시" path once the follow-up lands. The memory
      // driver returns the same URI it was given, which is equivalent
      // to returning `data.url`.
      const postPut = await this.cache.get(key).catch(() => null);
      if (postPut?.uri) {
        return postPut.uri;
      }
      return data.url;
    } catch {
      return null;
    }
  }
}

// Single shared instance — keeps the one-player-at-a-time guarantee
// across every screen that calls `audioService.speak(...)`.
export const audioService = new AudioService();
