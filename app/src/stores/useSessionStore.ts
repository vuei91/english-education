import { create } from 'zustand';

import type { Track, TrackBStep } from '../types/domain';

/**
 * Holds the in-flight learning session.
 * ContentService / Track A Player / Track B Player fill in the real flow
 * during tasks 7.x and 9.x. For now we just model which track is active
 * and which sentence/chunk the user is currently looking at.
 */

export type SessionState = {
  /** null while no session is active. */
  activeTrack: Track | null;
  /** Sentence currently shown on screen. */
  currentSentenceId: string | null;
  /** Track B only — which step (chunking / listen / shadowing / summary). */
  currentStep: TrackBStep | null;
  /** Track B only — index into the chunk list. */
  currentChunkIndex: number;
};

export type SessionActions = {
  startSession: (track: Track, firstSentenceId: string | null) => void;
  setCurrentSentenceId: (sentenceId: string | null) => void;
  setStep: (step: TrackBStep | null) => void;
  setChunkIndex: (index: number) => void;
  endSession: () => void;
};

const initialState: SessionState = {
  activeTrack: null,
  currentSentenceId: null,
  currentStep: null,
  currentChunkIndex: 0,
};

export const useSessionStore = create<SessionState & SessionActions>((set) => ({
  ...initialState,
  startSession: (track, firstSentenceId) =>
    set({
      activeTrack: track,
      currentSentenceId: firstSentenceId,
      currentStep: track === 'B' ? 'chunking' : null,
      currentChunkIndex: 0,
    }),
  setCurrentSentenceId: (currentSentenceId) => set({ currentSentenceId }),
  setStep: (currentStep) => set({ currentStep }),
  setChunkIndex: (currentChunkIndex) => set({ currentChunkIndex }),
  endSession: () => set(initialState),
}));
