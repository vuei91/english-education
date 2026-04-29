/**
 * Covers the env guards in Task 2.1.
 * We mutate process.env per-test and clear the module cache so the
 * `env` proxy re-reads the current values on each access.
 */

describe('env', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws with a useful message when EXPO_PUBLIC_SUPABASE_URL is missing', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_x';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { env } = require('../env');
    expect(() => env.SUPABASE_URL).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
  });

  it('throws when EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { env } = require('../env');
    expect(() => env.SUPABASE_PUBLISHABLE_KEY).toThrow(
      /EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  });

  it('returns the configured values when both are present', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_abc';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { env, isSupabaseConfigured } = require('../env');
    expect(env.SUPABASE_URL).toBe('https://example.supabase.co');
    expect(env.SUPABASE_PUBLISHABLE_KEY).toBe('sb_publishable_abc');
    expect(isSupabaseConfigured()).toBe(true);
  });

  it('isSupabaseConfigured returns false without throwing when env is absent', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isSupabaseConfigured } = require('../env');
    expect(isSupabaseConfigured()).toBe(false);
  });
});
