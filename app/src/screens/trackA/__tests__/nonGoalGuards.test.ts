/**
 * Non-Goal guards for Track A (Task 7.5, Req 1.5).
 *
 * The product contract says we never record or evaluate user speech.
 * This test scans the Track A source files for forbidden symbols so a
 * refactor that adds STT/mic/score accidentally fails CI instead of
 * shipping to users.
 *
 * It is a crude grep-level check on purpose — we want it to trip on any
 * accidental import or mention of these APIs, including strings. If a
 * future feature legitimately needs one of these, add an allowlist entry
 * with a clear justification.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN_PATTERNS: { pattern: RegExp; why: string }[] = [
  { pattern: /expo-av\b.*Recording\b/, why: 'Audio recording pulls us toward STT' },
  { pattern: /\brequestPermissionsAsync\b.*microphone/i, why: 'Microphone permission implies STT' },
  { pattern: /@react-native-community\/voice/i, why: 'React Native STT library' },
  { pattern: /\bSpeechRecognition\b/, why: 'Web Speech API recognition' },
  // "whisper" is also a natural English verb; narrow to STT-engine
  // identifiers to avoid false positives on product copy.
  { pattern: /\bopenai[-_]?whisper\b/i, why: 'OpenAI Whisper STT reference' },
  { pattern: /\bwhisper\.cpp\b/i, why: 'whisper.cpp STT binding' },
  {
    pattern: /\bwhisper[-_]?(stt|asr|api|transcribe|transcription|client)\b/i,
    why: 'Whisper STT integration',
  },
  { pattern: /\b(?:use|call|invoke|load)Whisper\w*\b/, why: 'Whisper STT call site' },
];

const ROOT = join(__dirname, '..');

/**
 * Strip single-line (//), multi-line, and leading-asterisk JSDoc content
 * so the lint patterns don't trip on documentation explicitly describing
 * what we forbid.
 */
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
      if (entry === '__tests__' || entry === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('Track A Non-Goal guards', () => {
  const files = walk(ROOT);

  it('finds at least one Track A source file to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  FORBIDDEN_PATTERNS.forEach(({ pattern, why }) => {
    it(`no file references ${pattern} (${why})`, () => {
      const hits = files
        .map((f) => ({ f, body: stripComments(readFileSync(f, 'utf8')) }))
        .filter(({ body }) => pattern.test(body));
      if (hits.length > 0) {
        const rendered = hits.map((h) => h.f).join(', ');
        throw new Error(`Forbidden pattern ${pattern} found in: ${rendered}`);
      }
    });
  });
});
