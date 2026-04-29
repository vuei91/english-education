/**
 * Non-Goal guards for Track B (Task 9.7, Req 5.5).
 *
 * Shadowing step MUST NOT record or evaluate user speech. This lint-style
 * test scans the Track B source tree so accidental STT/mic references
 * break CI instead of shipping.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN_PATTERNS: { pattern: RegExp; why: string }[] = [
  { pattern: /expo-av\b.*Recording\b/, why: 'Audio recording implies STT' },
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

describe('Track B Non-Goal guards', () => {
  const files = walk(ROOT);

  it('finds at least one Track B source file to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  FORBIDDEN_PATTERNS.forEach(({ pattern, why }) => {
    it(`no file references ${pattern} (${why})`, () => {
      const hits = files
        .map((f) => ({ f, body: stripComments(readFileSync(f, 'utf8')) }))
        .filter(({ body }) => pattern.test(body));
      if (hits.length > 0) {
        throw new Error(`Forbidden pattern ${pattern} found in: ${hits.map((h) => h.f).join(', ')}`);
      }
    });
  });
});
