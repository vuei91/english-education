/**
 * Centralised env access.
 *
 * Why wrap process.env:
 *  - Expo only inlines variables prefixed with `EXPO_PUBLIC_`. Reaching for
 *    a non-prefixed variable at runtime silently returns undefined, which
 *    is harder to debug than a single explicit check here.
 *  - Every consumer goes through a typed getter so missing config fails
 *    loudly at boot rather than with a cryptic `fetch("undefined/...")`.
 *
 * Key model: we use Supabase's new publishable / secret key pair
 * (sb_publishable_... / sb_secret_...). The publishable key is
 * client-safe and replaces the legacy JWT `anon` key.
 */

type RequiredEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
};

function assertPresent(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing required env variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

export const env: RequiredEnv = {
  get SUPABASE_URL() {
    // Static reference so Expo/Metro can inline the value at build time.
    return assertPresent('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL);
  },
  get SUPABASE_PUBLISHABLE_KEY() {
    return assertPresent(
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
  },
};

/**
 * Returns true when the required Supabase variables exist, without throwing.
 * UI layers use this to render a friendly "set up Supabase" screen in dev.
 */
export function isSupabaseConfigured(): boolean {
  return (
    Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  );
}
