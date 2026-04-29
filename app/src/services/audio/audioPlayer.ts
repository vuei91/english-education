import { audioService, type SpeakOptions as ServiceSpeakOptions } from './AudioService';

/**
 * Thin re-export kept for backward compatibility with the screens that
 * were wired up before Task 6. `audioPlayer` now delegates directly to
 * the single shared `audioService` instance (Req 7.1–7.6).
 *
 * New code should import `audioService` from `./AudioService` and pass
 * the sentence/chunk id so the cache-first path kicks in. Call sites
 * that only have text still work via TTS fallback.
 */

export type SpeakOptions = ServiceSpeakOptions;

export const audioPlayer = {
  async speak(text: string, options: SpeakOptions = {}): Promise<void> {
    await audioService.speak(text, options);
  },
  async stop(): Promise<void> {
    await audioService.stop();
  },
};
