/**
 * AuthService tests.
 *
 * We mock the Supabase client so we don't hit the real API from Jest.
 * The interesting behaviour verified here:
 *   - getCurrentIdentity falls back to anonymous when there is no session
 *   - signInWithEmail surfaces Supabase errors as { ok: false, error }
 *   - Apple and Google sign-in return "not configured" stubs until Task 14
 *   - signOut delegates to supabase.auth.signOut
 *
 * Jest hoists jest.mock() to the top of the file, so variables referenced
 * inside the factory must be `mock`-prefixed (Jest allows those) or
 * declared inline. We use mock-prefixed names.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthService } from '../AuthService';

const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockSignOut = jest.fn();
const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();

jest.mock('../../../lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signOut: mockSignOut,
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'anon-uuid'),
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('AuthService.getCurrentIdentity', () => {
  it('returns anonymous when no session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const identity = await AuthService.getCurrentIdentity();

    expect(identity.kind).toBe('anonymous');
    if (identity.kind === 'anonymous') {
      expect(identity.anonymousId).toBe('anon-uuid');
    }
  });

  it('returns authenticated when a session exists', async () => {
    const fakeUser = { id: 'u1', email: 'a@b.c' };
    const fakeSession = { user: fakeUser, access_token: 't' };
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } });

    const identity = await AuthService.getCurrentIdentity();

    expect(identity.kind).toBe('authenticated');
    if (identity.kind === 'authenticated') {
      expect(identity.user).toBe(fakeUser);
    }
  });
});

describe('AuthService.signInWithEmail', () => {
  it('returns ok:true on success', async () => {
    const user = { id: 'u1' };
    const session = { user, access_token: 't' };
    mockSignInWithPassword.mockResolvedValue({
      data: { user, session },
      error: null,
    });

    const result = await AuthService.signInWithEmail('a@b.c', 'pw');

    expect(result).toEqual({ ok: true, user, session });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.c',
      password: 'pw',
    });
  });

  it('returns ok:false when Supabase reports an error', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid credentials' },
    });

    const result = await AuthService.signInWithEmail('a@b.c', 'bad');

    expect(result).toEqual({ ok: false, error: 'Invalid credentials' });
  });
});

describe('AuthService provider stubs', () => {
  it('signInWithApple is intentionally unconfigured', async () => {
    const result = await AuthService.signInWithApple('token', 'nonce');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Apple sign-in/);
  });

  it('signInWithGoogle is intentionally unconfigured', async () => {
    const result = await AuthService.signInWithGoogle('token');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Google sign-in/);
  });
});

describe('AuthService.signOut', () => {
  it('delegates to supabase.auth.signOut', async () => {
    mockSignOut.mockResolvedValue({ error: null });
    await AuthService.signOut();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});

describe('AuthService.signInAnonymouslyLocal', () => {
  it('returns the persisted anonymous id', async () => {
    const id = await AuthService.signInAnonymouslyLocal();
    expect(id).toBe('anon-uuid');
    expect(await AsyncStorage.getItem('sentenceflow.anonymous_id')).toBe(
      'anon-uuid',
    );
  });
});
