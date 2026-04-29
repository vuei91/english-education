/**
 * Pure request validator for the `get-signed-audio-url` Edge Function.
 *
 * Factored out into its own module so it can be unit-tested from the
 * app's Jest suite without standing up the Deno test runner. The
 * Edge Function handler (see `index.ts`) is a thin shell over this
 * validator plus a Supabase Storage call — the interesting logic is
 * here.
 *
 * Contract (Req 7.2, tasks.md 2.5):
 *
 *   Request body:  { kind: 'sentence' | 'chunk' | 'vocab', id: string }
 *   Storage path:  sentences/{id}.m4a | chunks/{id}.m4a | vocab/{id}.m4a
 *   Bucket:        'audio' (see supabase/README.md and design.md §Interfaces)
 *
 * The client side of this contract lives in
 * `app/src/services/audio/AudioService.ts`. Both sides agree on the
 * same three kinds so that the `AudioCacheKind` type and the storage
 * directory layout stay in sync.
 */

export type AudioKind = 'sentence' | 'chunk' | 'vocab';

export type ValidatedRequest = {
  kind: AudioKind;
  id: string;
};

export type ValidationResult =
  | { ok: true; value: ValidatedRequest }
  | { ok: false; error: string };

const KINDS: readonly AudioKind[] = ['sentence', 'chunk', 'vocab'] as const;
const MAX_ID_LENGTH = 256;

function isAudioKind(value: unknown): value is AudioKind {
  return typeof value === 'string' && (KINDS as readonly string[]).includes(value);
}

/**
 * Validate a raw parsed JSON body. Returns a discriminated union so
 * callers can pattern-match without try/catch.
 *
 * Rules:
 *  - `kind` must be one of the three supported values.
 *  - `id` must be a non-empty string no longer than 256 chars.
 *  - `id` must not contain path separators or traversal sequences; the
 *    storage path is built by interpolation and we don't want a client
 *    to be able to escape the per-kind directory.
 */
export function validateRequest(body: unknown): ValidationResult {
  if (body === null || typeof body !== 'object') {
    return { ok: false, error: 'Body must be a JSON object.' };
  }
  const record = body as Record<string, unknown>;
  const kind = record.kind;
  const id = record.id;

  if (!isAudioKind(kind)) {
    return {
      ok: false,
      error: "'kind' must be one of: sentence | chunk | vocab.",
    };
  }
  if (typeof id !== 'string' || id.length === 0) {
    return { ok: false, error: "'id' must be a non-empty string." };
  }
  if (id.length > MAX_ID_LENGTH) {
    return { ok: false, error: `'id' must be ≤ ${MAX_ID_LENGTH} chars.` };
  }
  if (id.includes('..') || id.includes('/') || id.includes('\\')) {
    return { ok: false, error: "'id' must not contain path separators." };
  }

  return { ok: true, value: { kind, id } };
}

/**
 * Build the Storage object path for a validated request. Kept here
 * (rather than inline in the handler) so the `index.ts` handler has
 * no branching logic left to test beyond the Supabase call itself.
 *
 * Singular directory for `vocab` matches Task 2.5 and the bucket
 * layout documented in `supabase/README.md`.
 */
export function pathFor({ kind, id }: ValidatedRequest): string {
  switch (kind) {
    case 'sentence':
      return `sentences/${id}.m4a`;
    case 'chunk':
      return `chunks/${id}.m4a`;
    case 'vocab':
      return `vocab/${id}.m4a`;
  }
}
