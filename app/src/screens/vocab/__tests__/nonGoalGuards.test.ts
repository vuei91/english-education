/**
 * Non-Goal guards for Vocab (Task 10.11, product-context Non-Goals).
 *
 * The Vocab Helper must stay a modal bottom sheet. Every other Vocab UI
 * (Recent Words) is a secondary screen reachable from Me, never a tab.
 * This test scans the Vocab source tree for any syntactic mention of
 * rejected concepts so a future contributor can't accidentally graduate
 * the helper into a standalone learning course.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN_PATTERNS: { pattern: RegExp; why: string }[] = [
  { pattern: /\bflashcard/i, why: 'Standalone flashcard SRS is a non-goal' },
  { pattern: /\bSRS\b/i, why: 'Spaced Repetition as a standalone system for words is a non-goal' },
  { pattern: /createBottomTabNavigator\b/, why: 'Vocab screens must not register their own tab bar' },
  { pattern: /\bTab\.Screen\b.*VocabHelper/, why: 'VocabHelper must never become a tab' },
  { pattern: /\bTab\.Screen\b.*RecentWords/, why: 'RecentWords must never become a tab' },
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

describe('Vocab Non-Goal guards', () => {
  const files = walk(ROOT);

  it('finds at least one Vocab source file to scan', () => {
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
