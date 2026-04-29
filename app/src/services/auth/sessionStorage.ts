import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Storage adapter Supabase uses to persist the signed-in session.
 *
 * Why hand-roll this: Supabase's default storage is the browser
 * `localStorage`, which does not exist on native React Native. Passing
 * our own adapter is the official recommended path for RN apps.
 *
 * We intentionally do NOT wrap AsyncStorage in encryption here. Supabase
 * stores refresh tokens plainly, and the device's app sandbox is the
 * primary protection. Upgrade to EncryptedStorage/SecureStore if the
 * threat model changes (e.g. offline cached PII).
 */
export const supabaseSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};
