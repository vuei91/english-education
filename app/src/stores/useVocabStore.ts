import { create } from 'zustand';

/**
 * Tracks recently tapped words so Recent Words screen and Word Unresolved
 * Score calculations have a fast in-memory source.
 * Real score computation + 30-day window logic land in tasks 10.9 and 12.2.
 * For now we just keep an append-only log of tap events.
 */

const MAX_RECENT_TAPS = 500;

export type WordTap = {
  word: string;
  tappedAt: number;
  sourceSentenceId: string | null;
};

export type VocabState = {
  recentTaps: WordTap[];
};

export type VocabActions = {
  recordTap: (tap: WordTap) => void;
  clearTaps: () => void;
};

const initialState: VocabState = {
  recentTaps: [],
};

export const useVocabStore = create<VocabState & VocabActions>((set) => ({
  ...initialState,
  recordTap: (tap) =>
    set((state) => {
      const next = [tap, ...state.recentTaps];
      if (next.length > MAX_RECENT_TAPS) {
        next.length = MAX_RECENT_TAPS;
      }
      return { recentTaps: next };
    }),
  clearTaps: () => set({ recentTaps: [] }),
}));
