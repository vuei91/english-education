/**
 * AudioService tests.
 *
 * Verifies:
 *   - Cache-first path: when a signed URL resolves, `speak` plays it via
 *     expo-audio and never calls TTS (Req 7.1, 7.2).
 *   - TTS fallback: on Edge Function failure or when no sentenceId is
 *     supplied, `speak` delegates to expo-speech (Req 7.3).
 *   - LRU wiring: resolved URLs are recorded through the AudioCache so
 *     the LRU metric exists today even before the on-disk driver lands.
 *   - Non-Goal guard (Req 7.5): the module does not reference any
 *     microphone / STT / recording API.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { createAudioPlayer } from 'expo-audio';

import { getSupabaseClient } from '../../../lib/supabase';
import { AudioService } from '../AudioService';
import { AudioCache, MemoryBlobDriver } from '../AudioCache';

jest.mock('../../../lib/supabase', () => ({
  getSupabaseClient: jest.fn(),
}));

function makeIsolatedCache(): AudioCache {
  return new AudioCache({
    maxBytes: 1_000_000,
    driver: new MemoryBlobDriver(),
    persistKey: `@test/audio-service-${Math.random()}`,
  });
}

describe('AudioService', () => {
  const mockPlayer = {
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    setPlaybackRate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    (createAudioPlayer as jest.Mock).mockReturnValue(mockPlayer);
  });

  it('plays the signed URL when the Edge Function returns one', async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({
      functions: {
        invoke: jest.fn().mockResolvedValue({
          data: { url: 'https://cdn.example.com/hello.m4a' },
          error: null,
        }),
      },
    });
    const svc = new AudioService(makeIsolatedCache());
    await svc.speak('Hello.', { sentenceId: 's1', rate: 1 });

    expect(createAudioPlayer).toHaveBeenCalledWith({
      uri: 'https://cdn.example.com/hello.m4a',
    });
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(Speech.speak).not.toHaveBeenCalled();
  });

  it('falls back to device TTS when the Edge Function errors', async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({
      functions: {
        invoke: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('storage miss'),
        }),
      },
    });
    const svc = new AudioService(makeIsolatedCache());
    await svc.speak('Hello.', { sentenceId: 's1' });

    expect(createAudioPlayer).not.toHaveBeenCalled();
    expect(Speech.speak).toHaveBeenCalledWith(
      'Hello.',
      expect.objectContaining({ language: 'en-US', rate: 1 }),
    );
  });

  it('uses TTS directly when no sentenceId is supplied', async () => {
    const svc = new AudioService(makeIsolatedCache());
    await svc.speak('Goodbye.');

    expect(createAudioPlayer).not.toHaveBeenCalled();
    expect(Speech.speak).toHaveBeenCalledTimes(1);
  });

  it('stop() tears down the native player and stops TTS', async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({
      functions: {
        invoke: jest.fn().mockResolvedValue({
          data: { url: 'https://cdn.example.com/x.m4a' },
          error: null,
        }),
      },
    });
    const svc = new AudioService(makeIsolatedCache());
    await svc.speak('x', { sentenceId: 's1' });
    await svc.stop();

    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(mockPlayer.remove).toHaveBeenCalled();
    expect(Speech.stop).toHaveBeenCalled();
  });

  it('memoises signed URLs so repeat plays skip the Edge Function', async () => {
    const invoke = jest.fn().mockResolvedValue({
      data: { url: 'https://cdn.example.com/s1.m4a' },
      error: null,
    });
    (getSupabaseClient as jest.Mock).mockReturnValue({ functions: { invoke } });

    const svc = new AudioService(makeIsolatedCache());
    await svc.speak('first', { sentenceId: 's1' });
    await svc.speak('second', { sentenceId: 's1' });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).toHaveBeenCalledTimes(2);
  });

  it('records resolved entries in the injected AudioCache (Req 7.1, 7.2)', async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({
      functions: {
        invoke: jest.fn().mockResolvedValue({
          data: { url: 'https://cdn.example.com/tracked.m4a' },
          error: null,
        }),
      },
    });
    const cache = makeIsolatedCache();
    const svc = new AudioService(cache);
    await svc.speak('trackme', { sentenceId: 't1' });

    expect(cache.has({ kind: 'sentence', id: 't1' })).toBe(true);
    expect(cache.size()).toBeGreaterThan(0);
  });

  it('defaults kind to "sentence" in the Edge Function body (Req 7.2)', async () => {
    const invoke = jest.fn().mockResolvedValue({
      data: { url: 'https://cdn.example.com/default.m4a' },
      error: null,
    });
    (getSupabaseClient as jest.Mock).mockReturnValue({ functions: { invoke } });
    const svc = new AudioService(makeIsolatedCache());
    await svc.speak('Hello.', { sentenceId: 's-default' });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(
      'get-signed-audio-url',
      { body: { kind: 'sentence', id: 's-default' } },
    );
  });

  it('forwards kind: "chunk" to the Edge Function when requested (Req 7.2)', async () => {
    const invoke = jest.fn().mockResolvedValue({
      data: { url: 'https://cdn.example.com/chunk.m4a' },
      error: null,
    });
    (getSupabaseClient as jest.Mock).mockReturnValue({ functions: { invoke } });
    const svc = new AudioService(makeIsolatedCache());
    await svc.speak('a chunk', { sentenceId: 'c-42', kind: 'chunk' });

    expect(invoke).toHaveBeenCalledWith(
      'get-signed-audio-url',
      { body: { kind: 'chunk', id: 'c-42' } },
    );
  });

  it('prefers a cached local URI produced by the driver over the signed URL (Req 7.2)', async () => {
    // Fake driver that rewrites the stored URI to a "local" file URI on
    // write — simulates the on-disk downloader the follow-up task will
    // wire in. If AudioService picks this up correctly, createAudioPlayer
    // receives the local URI, not the signed URL.
    const storage = new Map<string, { uri: string; bytes: number }>();
    const localDriver = {
      read: jest.fn(async (key: string) => storage.get(key) ?? null),
      write: jest.fn(async (key: string, blob: { uri?: string; bytes: number }) => {
        // The downloader in the real integration returns a local URI;
        // model that by rewriting the incoming signed URL to a fake
        // file:// path before storing.
        storage.set(key, { uri: `file:///cache/${key}.m4a`, bytes: blob.bytes });
      }),
      remove: jest.fn(async (key: string) => {
        storage.delete(key);
      }),
      clear: jest.fn(async () => {
        storage.clear();
      }),
    };
    const cache = new AudioCache({
      maxBytes: 1_000_000,
      driver: localDriver,
      persistKey: `@test/local-${Math.random()}`,
    });

    (getSupabaseClient as jest.Mock).mockReturnValue({
      functions: {
        invoke: jest.fn().mockResolvedValue({
          data: { url: 'https://cdn.example.com/signed.m4a' },
          error: null,
        }),
      },
    });
    const svc = new AudioService(cache);
    await svc.speak('local', { sentenceId: 'local-1' });

    // createAudioPlayer was invoked exactly once, with the local URI.
    expect(createAudioPlayer).toHaveBeenCalledTimes(1);
    expect(createAudioPlayer).toHaveBeenCalledWith({
      uri: 'file:///cache/sentence/local-1.m4a',
    });
  });

  it.each<0.5 | 0.75 | 1 | 1.25>([0.5, 0.75, 1, 1.25])(
    'forwards PlaybackSpeed %p to setPlaybackRate on the native player (Req 7.4)',
    async (rate) => {
      (getSupabaseClient as jest.Mock).mockReturnValue({
        functions: {
          invoke: jest.fn().mockResolvedValue({
            data: { url: `https://cdn.example.com/s-${rate}.m4a` },
            error: null,
          }),
        },
      });
      const svc = new AudioService(makeIsolatedCache());
      await svc.speak('Hello.', { sentenceId: `s-${rate}`, rate });

      expect(mockPlayer.setPlaybackRate).toHaveBeenCalledWith(rate);
      expect(mockPlayer.play).toHaveBeenCalledTimes(1);
      expect(Speech.speak).not.toHaveBeenCalled();
    },
  );

  it('does not reference any microphone / STT / recording API (Req 7.5)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'AudioService.ts'),
      'utf8',
    );
    // Explicit forbid list for the listening-first contract.
    const forbidden = [
      'Recording',
      'requestPermissionsAsync',
      'expo-speech-recognition',
      '@react-native-voice/voice',
      'SpeechRecognizer',
      'getUserMedia',
    ];
    for (const token of forbidden) {
      expect(src).not.toContain(token);
    }
  });

  // Validates: Req 7.3
  it('falls back to device TTS when functions.invoke throws (offline)', async () => {
    // `fetch` in RN rejects with a TypeError when the network is
    // genuinely offline. The Edge Function client surfaces that as a
    // thrown promise rather than a returned `{ error }` object, so the
    // TTS fallback has to cover the throw path as well.
    (getSupabaseClient as jest.Mock).mockReturnValue({
      functions: {
        invoke: jest
          .fn()
          .mockRejectedValue(new TypeError('Network request failed')),
      },
    });
    const svc = new AudioService(makeIsolatedCache());
    await svc.speak('Offline hello.', { sentenceId: 's-offline' });

    expect(createAudioPlayer).not.toHaveBeenCalled();
    expect(Speech.speak).toHaveBeenCalledTimes(1);
    expect(Speech.speak).toHaveBeenCalledWith(
      'Offline hello.',
      expect.objectContaining({ language: 'en-US', rate: 1 }),
    );
  });

  // Validates: Req 7.3
  it('falls back to device TTS when createAudioPlayer throws at play time', async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({
      functions: {
        invoke: jest.fn().mockResolvedValue({
          data: { url: 'https://cdn.example.com/broken.m4a' },
          error: null,
        }),
      },
    });
    // Simulate a native-side failure (MIME mismatch, stream drop, etc.)
    // during createAudioPlayer. The same `speak` call must produce a
    // TTS utterance so the listener still hears something.
    (createAudioPlayer as jest.Mock).mockImplementationOnce(() => {
      throw new Error('native player exploded');
    });
    const svc = new AudioService(makeIsolatedCache());
    await svc.speak('Broken stream.', { sentenceId: 's-broken' });

    expect(createAudioPlayer).toHaveBeenCalledTimes(1);
    expect(Speech.speak).toHaveBeenCalledTimes(1);
    expect(Speech.speak).toHaveBeenCalledWith(
      'Broken stream.',
      expect.objectContaining({ language: 'en-US', rate: 1 }),
    );
  });

  // Validates: Req 7.3
  it('stops a previous TTS utterance before starting the next one', async () => {
    // Both calls go through the TTS path (no sentenceId). `Speech.stop`
    // must be invoked before the second `Speech.speak` so rapid taps
    // don't overlap. The `await this.stop()` at the top of `speak` and
    // the defensive `Speech.stop()` inside the TTS branch both
    // contribute to the call count; what we really care about is the
    // ordering.
    const svc = new AudioService(makeIsolatedCache());
    await svc.speak('first');
    const stopCallsAfterFirst = (Speech.stop as jest.Mock).mock.calls.length;

    await svc.speak('second');

    const speakOrder = (Speech.speak as jest.Mock).mock.invocationCallOrder;
    const stopOrder = (Speech.stop as jest.Mock).mock.invocationCallOrder;
    // Second Speech.speak comes after at least one Speech.stop that
    // was not counted before the second call started.
    expect((Speech.stop as jest.Mock).mock.calls.length).toBeGreaterThan(
      stopCallsAfterFirst,
    );
    expect(speakOrder[1]).toBeGreaterThan(
      stopOrder[stopOrder.length - 1] ?? 0,
    );
    expect(Speech.speak).toHaveBeenNthCalledWith(
      2,
      'second',
      expect.objectContaining({ rate: 1 }),
    );
  });

  // Validates: Req 7.3
  it.each<0.5 | 0.75 | 1 | 1.25>([0.5, 0.75, 1, 1.25])(
    'forwards PlaybackSpeed %p to Speech.speak when TTS fallback triggers',
    async (rate) => {
      (getSupabaseClient as jest.Mock).mockReturnValue({
        functions: {
          invoke: jest.fn().mockResolvedValue({
            data: null,
            error: new Error('storage miss'),
          }),
        },
      });
      const svc = new AudioService(makeIsolatedCache());
      await svc.speak('Rate test.', { sentenceId: `s-rate-${rate}`, rate });

      expect(createAudioPlayer).not.toHaveBeenCalled();
      expect(Speech.speak).toHaveBeenCalledWith(
        'Rate test.',
        expect.objectContaining({ rate }),
      );
    },
  );

  // Validates: Req 7.3
  it('passes options.language through to Speech.speak when supplied', async () => {
    const svc = new AudioService(makeIsolatedCache());
    await svc.speak('안녕하세요.', { language: 'ko-KR' });

    expect(Speech.speak).toHaveBeenCalledWith(
      '안녕하세요.',
      expect.objectContaining({ language: 'ko-KR' }),
    );
  });

  // --- Req 7.6: stop() / interruption coverage ------------------------
  //
  // The cases below back up the "중단 API" contract: the service must
  // honour an explicit stop, an implicit stop triggered by a new
  // speak(), and a stop that races with an in-flight Edge Function
  // call. `createAudioPlayer` is re-mocked per test where we need to
  // tell the first player from the second; the shared `mockPlayer`
  // from the top-level describe is fine when only one player's
  // lifecycle is under inspection.

  // Helper: build a fresh fake player whose methods we can inspect per
  // instance. Each call to createAudioPlayer returns a new one so we
  // can assert ordering across two plays.
  function makePlayerMock() {
    return {
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      setPlaybackRate: jest.fn(),
    };
  }

  // Validates: Req 7.6
  it('stop() tears down the exact player instance that speak() created', async () => {
    const playerA = makePlayerMock();
    (createAudioPlayer as jest.Mock).mockReset();
    (createAudioPlayer as jest.Mock).mockReturnValueOnce(playerA);
    (getSupabaseClient as jest.Mock).mockReturnValue({
      functions: {
        invoke: jest.fn().mockResolvedValue({
          data: { url: 'https://cdn.example.com/interrupt.m4a' },
          error: null,
        }),
      },
    });

    const svc = new AudioService(makeIsolatedCache());
    await svc.speak('interruptible', { sentenceId: 's-int' });
    // The speak() resolved with playerA live. A user-triggered stop
    // must pause + remove THAT instance, not a brand-new one.
    await svc.stop();

    expect(playerA.pause).toHaveBeenCalledTimes(1);
    expect(playerA.remove).toHaveBeenCalledTimes(1);
    expect(Speech.stop).toHaveBeenCalled();
  });

  // Validates: Req 7.6
  it('back-to-back speak() tears down the first player before creating the second', async () => {
    const playerA = makePlayerMock();
    const playerB = makePlayerMock();
    (createAudioPlayer as jest.Mock).mockReset();
    (createAudioPlayer as jest.Mock)
      .mockReturnValueOnce(playerA)
      .mockReturnValueOnce(playerB);
    (getSupabaseClient as jest.Mock).mockReturnValue({
      functions: {
        invoke: jest
          .fn()
          .mockResolvedValueOnce({
            data: { url: 'https://cdn.example.com/a.m4a' },
            error: null,
          })
          .mockResolvedValueOnce({
            data: { url: 'https://cdn.example.com/b.m4a' },
            error: null,
          }),
      },
    });

    const svc = new AudioService(makeIsolatedCache());
    await svc.speak('a', { sentenceId: 'a' });
    await svc.speak('b', { sentenceId: 'b' });

    // Invocation ordering: playerA.remove must precede playerB's
    // creation. Jest records a monotonic counter per mock function —
    // comparing the two locks the ordering in.
    const aRemoveOrder = playerA.remove.mock.invocationCallOrder[0] ?? 0;
    const bCreateOrder =
      (createAudioPlayer as jest.Mock).mock.invocationCallOrder[1] ?? 0;
    expect(aRemoveOrder).toBeGreaterThan(0);
    expect(bCreateOrder).toBeGreaterThan(0);
    expect(aRemoveOrder).toBeLessThan(bCreateOrder);

    expect(playerA.pause).toHaveBeenCalledTimes(1);
    expect(playerA.remove).toHaveBeenCalledTimes(1);
    expect(playerB.play).toHaveBeenCalledTimes(1);
    // playerB must not be torn down — it's the active player.
    expect(playerB.remove).not.toHaveBeenCalled();
  });

  // Validates: Req 7.6
  it('stop() is idempotent — a second stop() does not double-call remove', async () => {
    const player = makePlayerMock();
    (createAudioPlayer as jest.Mock).mockReset();
    (createAudioPlayer as jest.Mock).mockReturnValueOnce(player);
    (getSupabaseClient as jest.Mock).mockReturnValue({
      functions: {
        invoke: jest.fn().mockResolvedValue({
          data: { url: 'https://cdn.example.com/once.m4a' },
          error: null,
        }),
      },
    });

    const svc = new AudioService(makeIsolatedCache());
    await svc.speak('once', { sentenceId: 'once' });

    await svc.stop();
    // Second stop() hits the cleared-player branch — must be a no-op
    // w.r.t. the native player, and must not throw.
    await expect(svc.stop()).resolves.toBeUndefined();

    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(player.remove).toHaveBeenCalledTimes(1);
  });

  // Validates: Req 7.6
  it('stop() during TTS-only playback stops TTS without touching the native player', async () => {
    (createAudioPlayer as jest.Mock).mockReset();
    const svc = new AudioService(makeIsolatedCache());

    // No sentenceId → pure TTS path. No player is ever created.
    await svc.speak('hello');
    expect(createAudioPlayer).not.toHaveBeenCalled();

    await svc.stop();

    expect(Speech.stop).toHaveBeenCalled();
    // Shared `mockPlayer` from the outer scope: its pause/remove must
    // not be touched because no play() hit the native path.
    expect(mockPlayer.pause).not.toHaveBeenCalled();
    expect(mockPlayer.remove).not.toHaveBeenCalled();
  });

  // Validates: Req 7.6
  it('stop() on a fresh service (nothing has played yet) is a silent no-op', async () => {
    (createAudioPlayer as jest.Mock).mockReset();
    const svc = new AudioService(makeIsolatedCache());

    await expect(svc.stop()).resolves.toBeUndefined();

    // Defensive Speech.stop() inside stopInternal() is expected — it
    // guards against a TTS utterance queued by another caller. No
    // native player was ever created.
    expect(Speech.stop).toHaveBeenCalled();
    expect(createAudioPlayer).not.toHaveBeenCalled();
    expect(mockPlayer.pause).not.toHaveBeenCalled();
    expect(mockPlayer.remove).not.toHaveBeenCalled();
  });

  // Validates: Req 7.6
  it('two concurrent speak() calls end with exactly one active native player', async () => {
    // Goal: demonstrate that the generation token prevents both
    // concurrent speaks from creating a player. Without the token, both
    // calls would resume after the Edge Function promise resolved and
    // each would call createAudioPlayer, leaking the first player.
    const playerB = makePlayerMock();
    (createAudioPlayer as jest.Mock).mockReset();
    // If the race regresses, the SECOND createAudioPlayer call would
    // be for playerA's URL and this `mockReturnValueOnce` would run
    // out, returning undefined and crashing the test with a clear
    // message. That is the canary.
    (createAudioPlayer as jest.Mock).mockReturnValueOnce(playerB);

    // Both invocations resolve on the next microtask, so the Promise
    // ordering is deterministic: whichever speak() captured the
    // later generation wins.
    (getSupabaseClient as jest.Mock).mockReturnValue({
      functions: {
        invoke: jest
          .fn()
          .mockResolvedValueOnce({
            data: { url: 'https://cdn.example.com/race-a.m4a' },
            error: null,
          })
          .mockResolvedValueOnce({
            data: { url: 'https://cdn.example.com/race-b.m4a' },
            error: null,
          }),
      },
    });

    const svc = new AudioService(makeIsolatedCache());
    const p1 = svc.speak('a', { sentenceId: 'race-a' });
    const p2 = svc.speak('b', { sentenceId: 'race-b' });
    await Promise.all([p1, p2]);

    expect(createAudioPlayer).toHaveBeenCalledTimes(1);
    expect(createAudioPlayer).toHaveBeenCalledWith({
      uri: 'https://cdn.example.com/race-b.m4a',
    });
    expect(playerB.play).toHaveBeenCalledTimes(1);
  });

  // Validates: Req 7.6
  it('stop() called while speak() is awaiting the Edge Function prevents any player from being created', async () => {
    // This is the canonical race the generation token exists for:
    // speak() has passed `stopInternal` but has NOT yet resolved the
    // signed URL. A stop() that lands during that window must leave
    // the service quiet — no player may be created after stop()
    // returns.
    let resolveInvoke: ((value: {
      data: { url: string };
      error: null;
    }) => void) | null = null;
    const invoke = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveInvoke = resolve;
        }),
    );
    (getSupabaseClient as jest.Mock).mockReturnValue({
      functions: { invoke },
    });
    (createAudioPlayer as jest.Mock).mockReset();

    const svc = new AudioService(makeIsolatedCache());
    const speakPromise = svc.speak('racing', { sentenceId: 's-race' });

    // Flush microtasks until speak() has reached the Edge Function
    // call. `cache.get` hydrates from AsyncStorage first, so we need
    // more than one microtask; spin until invoke is observed.
    for (let i = 0; i < 50 && invoke.mock.calls.length === 0; i++) {
      await Promise.resolve();
    }
    expect(invoke).toHaveBeenCalledTimes(1);

    // Now stop() fires while speak() is parked on the invoke promise.
    await svc.stop();

    // Resolve the Edge Function AFTER stop() has returned. A correct
    // implementation must bail here instead of racing forward into
    // createAudioPlayer.
    resolveInvoke!({
      data: { url: 'https://cdn.example.com/late.m4a' },
      error: null,
    });
    await speakPromise;

    expect(createAudioPlayer).not.toHaveBeenCalled();
    expect(Speech.speak).not.toHaveBeenCalled();
    expect(Speech.stop).toHaveBeenCalled();
  });
});
