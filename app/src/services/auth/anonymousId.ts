import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const ANONYMOUS_ID_KEY = 'sentenceflow.anonymous_id';

/**
 * Returns the device's anonymous id, creating one on first call.
 *
 * Why a *local* UUID instead of Supabase's anonymous sign-in
 * (see design.md D3):
 *   - No server row is created for users who never log in, which keeps
 *     `auth.users` clean and cost-free.
 *   - On login we migrate local-only data into the new server account
 *     rather than having to reconcile an anonymous auth.user row.
 *
 * Trade-off: the id is tied to the install. Reinstalling the app loses
 * the id (and the data tied to it). Onboarding nudges users to log in
 * if they want their progress preserved.
 */
export async function getOrCreateAnonymousId(): Promise<string> {
  const existing = await AsyncStorage.getItem(ANONYMOUS_ID_KEY);
  if (existing) return existing;

  const fresh = Crypto.randomUUID();
  await AsyncStorage.setItem(ANONYMOUS_ID_KEY, fresh);
  return fresh;
}

/** Test helper. Wipes the anonymous id so the next call creates a new one. */
export async function clearAnonymousId(): Promise<void> {
  await AsyncStorage.removeItem(ANONYMOUS_ID_KEY);
}
