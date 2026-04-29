import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from './env';
import { supabaseSessionStorage } from '../services/auth/sessionStorage';

/**
 * Shared Supabase client for the app. Created lazily so tests that don't
 * touch Supabase never trip the env assertion in `env.ts`.
 *
 * Key model: we pass the publishable key (sb_publishable_...) as the
 * second argument. @supabase/supabase-js accepts both the new
 * publishable key format and the legacy anon JWT transparently.
 *
 * Auth options:
 *  - `storage` points at AsyncStorage via our adapter so sessions survive
 *    app restarts on both iOS and Android. Without it Supabase falls back
 *    to in-memory storage on React Native, losing the session every time.
 *  - `autoRefreshToken: true` refreshes JWTs as they near expiry.
 *  - `persistSession: true` writes the session via the storage adapter.
 *  - `detectSessionInUrl: false` is correct on React Native where there
 *    is no browser URL to inspect after OAuth redirects.
 */
let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: supabaseSessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/** Test helper only. Do not call from application code. */
export function __resetSupabaseClientForTests(): void {
  client = null;
}
