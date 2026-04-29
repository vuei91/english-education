import type { Session, User } from '@supabase/supabase-js';

import { getSupabaseClient } from '../../lib/supabase';
import { getOrCreateAnonymousId } from './anonymousId';

/**
 * AuthService — thin wrapper over Supabase Auth.
 *
 * Scope (Task 5.x, Req 16):
 *  - Email sign-in / sign-up (5.1)
 *  - Apple ID token sign-in stub (5.2) — returns a clear "not yet configured"
 *    error until we wire expo-apple-authentication in the onboarding screen
 *  - Google ID token sign-in stub (5.3) — same pattern
 *  - Local UUID for anonymous mode (5.4) — no server row
 *  - Sign out that keeps the offline sync queue alive (5.5)
 *
 * Firebase Auth is intentionally not used anywhere — Supabase Auth is the
 * single identity source (product-context Non-Goals).
 */

export type AuthIdentity =
  | { kind: 'anonymous'; anonymousId: string }
  | { kind: 'authenticated'; user: User; session: Session };

export type AuthChangeListener = (identity: AuthIdentity) => void;

export type SignInResult =
  | { ok: true; user: User; session: Session }
  | { ok: false; error: string };

export const AuthService = {
  /**
   * Returns the current identity. Falls back to an anonymous local UUID
   * when there is no Supabase session.
   */
  async getCurrentIdentity(): Promise<AuthIdentity> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      return {
        kind: 'authenticated',
        user: data.session.user,
        session: data.session,
      };
    }
    const anonymousId = await getOrCreateAnonymousId();
    return { kind: 'anonymous', anonymousId };
  },

  /** Req 16.1 — email / password sign-in. */
  async signInWithEmail(email: string, password: string): Promise<SignInResult> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session || !data.user) {
      return { ok: false, error: error?.message ?? 'Sign-in failed.' };
    }
    return { ok: true, user: data.user, session: data.session };
  },

  /** Req 16.1 — email sign-up. Supabase may require email confirmation. */
  async signUpWithEmail(email: string, password: string): Promise<SignInResult> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { ok: false, error: error.message };
    // When email confirmation is required, `session` is null and the caller
    // should surface "check your inbox" — report that as a non-error state.
    if (!data.session || !data.user) {
      return { ok: false, error: 'Confirmation email sent. Check your inbox.' };
    }
    return { ok: true, user: data.user, session: data.session };
  },

  /**
   * Req 16.1 — Apple sign-in.
   * The caller (onboarding screen) runs expo-apple-authentication to obtain
   * an identity token and forwards it here. Left unimplemented until the
   * Apple developer account + Sign-in-with-Apple provider are configured
   * on Supabase (planned in Task 14.x).
   */
  async signInWithApple(_identityToken: string, _nonce: string): Promise<SignInResult> {
    return {
      ok: false,
      error:
        'Apple sign-in is not configured yet. Complete the Supabase Auth provider setup first (Task 14.x).',
    };
  },

  /**
   * Req 16.1 — Google sign-in.
   * Same pattern as Apple: UI obtains the id_token via expo-auth-session,
   * then calls here. Unimplemented until the Google OAuth provider is
   * configured on Supabase (planned in Task 14.x).
   */
  async signInWithGoogle(_idToken: string): Promise<SignInResult> {
    return {
      ok: false,
      error:
        'Google sign-in is not configured yet. Complete the Supabase Auth provider setup first (Task 14.x).',
    };
  },

  /**
   * Req 16.4 — sign out. Clears the Supabase session and returns to
   * anonymous mode. The offline sync queue is NOT touched here; it is
   * cleaned up by SyncService on the next boot as the user_id changes.
   */
  async signOut(): Promise<void> {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
  },

  /**
   * Req 16.2 — returns the device's anonymous UUID, creating one lazily.
   */
  async signInAnonymouslyLocal(): Promise<string> {
    return getOrCreateAnonymousId();
  },

  /**
   * Subscribe to Supabase auth events so stores can sync user state.
   * Returns an unsubscribe function.
   */
  onAuthChange(listener: AuthChangeListener): () => void {
    const supabase = getSupabaseClient();
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        listener({ kind: 'authenticated', user: session.user, session });
      } else {
        const anonymousId = await getOrCreateAnonymousId();
        listener({ kind: 'anonymous', anonymousId });
      }
    });
    return () => data.subscription.unsubscribe();
  },
};
