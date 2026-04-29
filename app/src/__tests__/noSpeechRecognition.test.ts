/**
 * No Speech Recognition / No Microphone — repo-wide smoke guard (Req 7.5).
 *
 * The ESLint rule in `app/eslint.config.js` is the primary enforcement for
 * this contract. This test is the backstop: if someone disables the lint
 * rule locally or removes it in a PR, a grep-level scan over the entire
 * `app/src` tree still fails CI.
 *
 * Scope:
 *   - Walks `app/src/**` recursively, plus `app/App.tsx` and `app/index.ts`.
 *   - Skips `__tests__` directories (this file and the per-screen guards
 *     legitimately reference the forbidden tokens as string literals).
 *   - Strips comments so the Non-Goal documentation inside source files
 *     can mention these tokens without tripping the guard.
 *
 * Why narrower than the lint rule?
 *   The lint rule trips on real import / call-site usage. This smoke test
 *   trips on any occurrence — including string literals, dynamic import
 *   paths, and `require(...)` calls — which is the right level of paranoia
 *   for a Non-Goal we never want to re-litigate. The cost of a false
 *   positive is adding the occurrence to `stripComments` or inside a
 *   __tests__ dir, both of which are obviously the right move.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const FORBIDDEN_PATTERNS: { pattern: RegExp; why: string }[] = [
  {
    pattern: /@react-native-voice\/voice/,
    why: 'STT library — Req 7.5 Non-Goal',
  },
  { pattern: /\breact-native-voice\b/, why: 'STT library — Req 7.5 Non-Goal' },
  {
    pattern: /\bexpo-speech-recognition\b/,
    why: 'STT library — Req 7.5 Non-Goal',
  },
  {
    pattern: /\breact-native-recordio\b/,
    why: 'Audio recording library — Req 7.5 Non-Goal',
  },
  {
    pattern: /\bAudio\.Recording\b/,
    why: 'expo-av microphone entry point — Req 7.5 Non-Goal',
  },
  {
    pattern: /\buseAudioRecorder\b/,
    why: 'expo-audio recorder hook — Req 7.5 Non-Goal',
  },
  {
    pattern: /\bAudioRecorder\b/,
    why: 'expo-audio recorder class — Req 7.5 Non-Goal',
  },
  {
    pattern: /\bgetUserMedia\b/,
    why: 'Web/RNW microphone API — Req 7.5 Non-Goal',
  },
  {
    pattern: /\bSpeechRecognizer\b/,
    why: 'Native STT API — Req 7.5 Non-Goal',
  },
  {
    pattern: /\bSpeechRecognition\b/,
    why: 'Web Speech API recognition — Req 7.5 Non-Goal',
  },
  // "whisper" is a common English verb (e.g. onboarding copy: "whisper
  // along"), so a bare /\bwhisper\b/i would fire on natural language.
  // Narrow the guard to STT-engine references: the OpenAI Whisper API,
  // the whisper.cpp binding, and compound identifiers like `whisperSTT`
  // or `openaiWhisper`. Adjust this list if a real STT library surfaces
  // a new naming convention.
  {
    pattern: /\bopenai[-_]?whisper\b/i,
    why: 'OpenAI Whisper STT reference — Req 7.5 Non-Goal',
  },
  {
    pattern: /\bwhisper\.cpp\b/i,
    why: 'whisper.cpp STT binding — Req 7.5 Non-Goal',
  },
  {
    pattern: /\bwhisper[-_]?(stt|asr|api|transcribe|transcription|client)\b/i,
    why: 'Whisper STT integration — Req 7.5 Non-Goal',
  },
  {
    pattern: /\b(?:use|call|invoke|load)Whisper\w*\b/,
    why: 'Whisper STT call site — Req 7.5 Non-Goal',
  },
];

// Resolve roots relative to the app/ package so `jest` from any cwd works.
const APP_ROOT = resolve(__dirname, '..', '..');
const SRC_ROOT = join(APP_ROOT, 'src');
const EXTRA_FILES = [join(APP_ROOT, 'App.tsx'), join(APP_ROOT, 'index.ts')];

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      // Skip test directories — they legitimately reference these
      // tokens as regex / string literals for guard purposes.
      if (entry === '__tests__' || entry === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('Repo-wide No-Microphone guard (Req 7.5)', () => {
  const files = [
    ...walk(SRC_ROOT),
    ...EXTRA_FILES.filter((f) => existsSync(f)),
  ];

  it('finds a non-trivial source surface to scan', () => {
    // Sanity check — if globbing breaks, surface it before the per-pattern
    // assertions silently pass against an empty file list.
    expect(files.length).toBeGreaterThan(10);
  });

  FORBIDDEN_PATTERNS.forEach(({ pattern, why }) => {
    it(`no source file references ${pattern} (${why})`, () => {
      const hits = files
        .map((f) => ({ f, body: stripComments(readFileSync(f, 'utf8')) }))
        .filter(({ body }) => pattern.test(body));
      if (hits.length > 0) {
        const rendered = hits.map((h) => h.f).join('\n  ');
        throw new Error(
          `Forbidden pattern ${pattern} found in:\n  ${rendered}\n` +
            `Reason: ${why}. See product-context.md Non-Goals and ` +
            `requirements.md Req 7.5.`,
        );
      }
    });
  });
});
