import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { create } from 'zustand';

import { AuthService } from '../services/auth';
import type { Track } from '../types/domain';

/**
 * Holds auth + preference state with a tiny hand-rolled AsyncStorage
 * persistence layer.
 *
 * Why not zustand/middleware `persist`:
 *   - zustand v5's `middleware` barrel pulls the `devtools` helper into
 *     the web bundle, and its `import.meta.env` references crash Metro's
 *     web target. We only need to store three primitives, so rolling a
 *     20-line wrapper keeps the dependency surface small.
 *
 * Persisted fields: preferredTrack, onboardingCompleted.
 * Ephemeral fields (userId, anonymousId) come from the auth layer at boot.
 */

const STORAGE_KEY = 'sentenceflow.user';

type PersistedShape = {
  preferredTrack: Track;
  onboardingCompleted: boolean;
};

export type UserState = {
  userId: string | null;
  anonymousId: string | null;
  preferredTrack: Track;
  onboardingCompleted: boolean;
  /** True once the initial AsyncStorage read has completed. */
  hydrated: boolean;
};

export type UserActions = {
  setUserId: (userId: string | null) => void;
  setAnonymousId: (id: string | null) => void;
  setPreferredTrack: (track: Track) => void;
  completeOnboarding: () => void;
  reset: () => void;
  /** Loads persisted fields from AsyncStorage. Called once at boot. */
  hydrate: () => Promise<void>;
};

const initialState: UserState = {
  userId: null,
  anonymousId: null,
  preferredTrack: 'A',
  onboardingCompleted: false,
  hydrated: false,
};

async function readPersisted(): Promise<Partial<PersistedShape> | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedShape>;
    return parsed;
  } catch {
    return null;
  }
}

async function writePersisted(state: PersistedShape): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Swallowing is fine: next launch re-reads the previous good snapshot.
  }
}

export const useUserStore = create<UserState & UserActions>((set, get) => ({
  ...initialState,
  setUserId: (userId) => set({ userId }),
  setAnonymousId: (anonymousId) => set({ anonymousId }),
  setPreferredTrack: (preferredTrack) => {
    set({ preferredTrack });
    void writePersisted(snapshot(get()));
  },
  completeOnboarding: () => {
    set({ onboardingCompleted: true });
    void writePersisted(snapshot(get()));
  },
  reset: () => {
    set(initialState);
    void AsyncStorage.removeItem(STORAGE_KEY);
  },
  hydrate: async () => {
    const persisted = await readPersisted();
    const wasOnboarded = persisted?.onboardingCompleted ?? false;

    // 인트로 없이 바로 학습 진입: 첫 실행이면 자동으로 온보딩 완료 처리
    if (!wasOnboarded) {
      const anonymousId = await AuthService.signInAnonymouslyLocal();
      set({
        preferredTrack: persisted?.preferredTrack ?? initialState.preferredTrack,
        onboardingCompleted: true,
        anonymousId,
        hydrated: true,
      });
      void writePersisted({
        preferredTrack: persisted?.preferredTrack ?? initialState.preferredTrack,
        onboardingCompleted: true,
      });
    } else {
      set({
        preferredTrack: persisted?.preferredTrack ?? initialState.preferredTrack,
        onboardingCompleted: true,
        hydrated: true,
      });
    }
  },
}));

function snapshot(state: UserState): PersistedShape {
  return {
    preferredTrack: state.preferredTrack,
    onboardingCompleted: state.onboardingCompleted,
  };
}

/**
 * Convenience hook so components can trigger hydration without knowing the
 * storage key. Call once from the app root.
 */
export function useHydrateUserStore(): boolean {
  const hydrated = useUserStore((s) => s.hydrated);
  useEffect(() => {
    if (!hydrated) void useUserStore.getState().hydrate();
  }, [hydrated]);
  return hydrated;
}
