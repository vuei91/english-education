import { create } from 'zustand';

import type { Track, TrackBStep } from '../types/domain';

/**
 * Holds the in-flight learning session.
 *
 * Curriculum fields were added in curriculum-foundation Tasks 9.1~9.3
 * (Req 6.1~6.3). They are *optional* at the startSession boundary so
 * pre-curriculum callers (TrackASessionScreen / TrackBSessionScreen) keep
 * working without changes; when the curriculum flow lands it simply
 * threads the extra `{ unitId, curriculumStepId }` argument through.
 *
 * Note the field name `currentCurriculumStepId` — we deliberately avoid
 * `currentStepId` to keep it distinct from the existing `currentStep`
 * (Track B's 4-step flow: chunking / listen / shadowing / summary), which
 * is a different concept (see design.md §D1).
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
  /** Curriculum Unit this session is anchored to, null when the session
   *  is not tied to a curriculum unit (Req 6.1). */
  currentUnitId: string | null;
  /** Curriculum Step (phrase / conjugation / substitution) this session
   *  is running, null when no curriculum is attached (Req 6.1). */
  currentCurriculumStepId: string | null;
};

export type SessionActions = {
  /**
   * Start a session. The `curriculum` argument is optional — when
   * omitted the session runs without curriculum anchoring (Req 6.2)
   * preserving the pre-curriculum-foundation call sites.
   */
  startSession: (
    track: Track,
    firstSentenceId: string | null,
    curriculum?: { unitId: string; curriculumStepId: string },
  ) => void;
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
  currentUnitId: null,
  currentCurriculumStepId: null,
};

export const useSessionStore = create<SessionState & SessionActions>((set) => ({
  ...initialState,
  startSession: (track, firstSentenceId, curriculum) =>
    set({
      activeTrack: track,
      currentSentenceId: firstSentenceId,
      currentStep: track === 'B' ? 'chunking' : null,
      currentChunkIndex: 0,
      currentUnitId: curriculum?.unitId ?? null,
      currentCurriculumStepId: curriculum?.curriculumStepId ?? null,
    }),
  setCurrentSentenceId: (currentSentenceId) => set({ currentSentenceId }),
  setStep: (currentStep) => set({ currentStep }),
  setChunkIndex: (currentChunkIndex) => set({ currentChunkIndex }),
  // Reset back to defaults — curriculum fields included (Req 6.3).
  endSession: () => set(initialState),
}));
