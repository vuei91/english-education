/**
 * Tests for the anonymous UUID helper.
 * We stub expo-crypto.randomUUID so each test gets a deterministic value
 * and rely on the AsyncStorage mock registered globally in jest.setup.ts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearAnonymousId, getOrCreateAnonymousId } from '../anonymousId';

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-fixed'),
}));

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('getOrCreateAnonymousId', () => {
  it('creates a new UUID on first call and persists it', async () => {
    const first = await getOrCreateAnonymousId();
    expect(first).toBe('test-uuid-fixed');
    expect(await AsyncStorage.getItem('sentenceflow.anonymous_id')).toBe(
      'test-uuid-fixed',
    );
  });

  it('returns the same id on subsequent calls', async () => {
    await getOrCreateAnonymousId();
    const second = await getOrCreateAnonymousId();
    expect(second).toBe('test-uuid-fixed');
  });

  it('regenerates after clearAnonymousId', async () => {
    await getOrCreateAnonymousId();
    await clearAnonymousId();
    expect(await AsyncStorage.getItem('sentenceflow.anonymous_id')).toBeNull();
    const next = await getOrCreateAnonymousId();
    expect(next).toBe('test-uuid-fixed');
  });
});
