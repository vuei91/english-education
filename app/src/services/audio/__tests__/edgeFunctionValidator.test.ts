/**
 * Unit tests for the `get-signed-audio-url` Edge Function validator.
 *
 * The validator lives at `supabase/functions/get-signed-audio-url/validateRequest.ts`
 * — a pure module with no Deno or Supabase dependencies — precisely so
 * Jest can exercise it from the app workspace without standing up the
 * Deno test runner. That was the lower-friction choice because:
 *
 *   - The repo has no existing Deno test harness; adding one just for
 *     a ~70-line validator would pull in its own CI story and is out
 *     of scope for Task 6.3.
 *   - The validator is where the request-shape contract between the
 *     client (AudioService.resolvePlayableUrl) and the Edge Function
 *     lives, so covering it from the same Jest suite that already
 *     exercises the client gives a single failure locus when the
 *     contract drifts.
 *
 * Req coverage: 7.2 (audio fetch contract).
 */

import {
  pathFor,
  validateRequest,
  type ValidatedRequest,
} from '../../../../../supabase/functions/get-signed-audio-url/validateRequest';

describe('validateRequest', () => {
  it('accepts the three supported kinds and a plain id', () => {
    for (const kind of ['sentence', 'chunk', 'vocab'] as const) {
      const result = validateRequest({ kind, id: 'abc-123' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual<ValidatedRequest>({ kind, id: 'abc-123' });
      }
    }
  });

  it('rejects unknown kinds', () => {
    // `word` used to be a valid kind before 6.3 aligned the contract
    // with AudioCacheKind; this test locks in the rename.
    const result = validateRequest({ kind: 'word', id: 'hello' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/kind/);
    }
  });

  it('rejects a missing id', () => {
    const result = validateRequest({ kind: 'sentence' });
    expect(result.ok).toBe(false);
  });

  it('rejects an empty id', () => {
    const result = validateRequest({ kind: 'sentence', id: '' });
    expect(result.ok).toBe(false);
  });

  it('rejects non-string id', () => {
    const result = validateRequest({ kind: 'sentence', id: 42 });
    expect(result.ok).toBe(false);
  });

  it('rejects an oversized id (> 256 chars)', () => {
    const id = 'a'.repeat(257);
    const result = validateRequest({ kind: 'sentence', id });
    expect(result.ok).toBe(false);
  });

  it.each(['../etc/passwd', 'folder/file', 'folder\\file', '..'])(
    'rejects path-traversal attempts: %s',
    (id) => {
      const result = validateRequest({ kind: 'sentence', id });
      expect(result.ok).toBe(false);
    },
  );

  it('rejects non-object bodies (null, array, primitive, undefined)', () => {
    expect(validateRequest(null).ok).toBe(false);
    expect(validateRequest([]).ok).toBe(false);
    expect(validateRequest('sentence').ok).toBe(false);
    expect(validateRequest(undefined).ok).toBe(false);
  });
});

describe('pathFor', () => {
  it('builds sentence paths under sentences/', () => {
    expect(pathFor({ kind: 'sentence', id: 's-1' })).toBe('sentences/s-1.m4a');
  });

  it('builds chunk paths under chunks/', () => {
    expect(pathFor({ kind: 'chunk', id: 'c-9' })).toBe('chunks/c-9.m4a');
  });

  it('builds vocab paths under vocab/ (singular, matches bucket layout)', () => {
    // The design doc and Task 2.5 fix the bucket layout at
    // audio/{sentences,chunks,vocab} — not 'vocabs'. The validator +
    // pathFor split keeps this invariant enforced in one place.
    expect(pathFor({ kind: 'vocab', id: 'serendipity' })).toBe(
      'vocab/serendipity.m4a',
    );
  });
});
