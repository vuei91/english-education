import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * Daily progress, streak, and hearts (Req 13).
 *
 * Persistence mirrors `useUserStore`: a small hand-rolled AsyncStorage
 * wrapper instead of `zustand/middleware/persist` (see notes there).
 *
 * Streak semantics (Req 13.2, 13.5):
 *   - A day "counts" the first time the user hits Daily_Goal that day.
 *   - Streak increments only on goal-hit days and only once per day.
 *   - If today's ISO date is not consecutive with `lastStreakDate`, the
 *     current streak resets to 0 before the next goal-hit.
 *   - Calling `reconcileForToday` at app foreground resets
 *     `sentencesCompletedToday` when the stored date rolls over.
 */

const STORAGE_KEY = 'sentenceflow.progress';
const DEFAULT_DAILY_GOAL = 10;
const MAX_HEARTS = 5;

export const DAILY_GOAL_OPTIONS: readonly number[] = [5, 10, 20, 30] as const;

/**
 * Default "pattern master" threshold (Req 2.7). Exported so the UI layer
 * (PatternDrillPanel's badge banner) can cite the exact same number in
 * its user-facing copy without drifting out of sync with the store.
 *
 * "Crossing" semantics: the badge is granted exactly once on the
 * completion call where `drillCompletions[originSentenceId]` moves from
 * `< threshold` to `>= threshold`. Subsequent completions still bump
 * the counter (useful for future analytics telling 3 from 5) but never
 * re-grant the badge. See `recordDrillCompletion`.
 */
export const DRILL_COMPLETION_THRESHOLD = 3;

/** originSentenceId → number of completed drill sessions. */
type DrillCompletionMap = Record<string, number>;

/** originSentenceId → badge metadata (currently just the grant date). */
type EarnedBadges = Record<string, { earnedAt: string }>;

type PersistedShape = {
  dailyGoal: number;
  sentencesCompletedToday: number;
  totalSentencesCompleted: number;
  currentStreak: number;
  bestStreak: number;
  hearts: number;
  lastActiveDate: string | null;
  lastStreakDate: string | null;
  goalHitToday: boolean;
  /**
   * Per-pattern drill completion counts. New in Task 8.5. Older
   * persist payloads (pre-8.5) don't have this field; `hydrate` merges
   * `initialPersisted` underneath the persisted object so they read as
   * `{}` on first launch and survive the round-trip on every launch
   * after that (Req 2.7).
   */
  drillCompletions: DrillCompletionMap;
  /**
   * Granted "pattern master" badges keyed by originSentenceId. Same
   * backward-compat story as drillCompletions.
   */
  patternBadges: EarnedBadges;
};

export type ProgressState = PersistedShape & {
  hydrated: boolean;
};

export type ProgressActions = {
  setDailyGoal: (goal: number) => void;
  /** Called after a sentence (Track A or B) is completed. Handles
   *  counter bump, goal detection, and streak roll. Returns true if this
   *  call is the one that ticked Daily_Goal over the finish line. */
  completeSentence: (today?: string) => boolean;
  resetStreak: () => void;
  loseHeart: () => void;
  refillHearts: () => void;
  /** Checks the calendar: if we've crossed midnight since last use, the
   *  daily counter resets, and if the gap is more than one day the
   *  streak resets too. Safe to call on every foreground event. */
  reconcileForToday: (today?: string) => void;
  /**
   * Records that the learner finished a full pattern drill for
   * `originSentenceId` (Req 2.7). Increments that pattern's
   * completion counter, and — if this completion crossed the
   * `DRILL_COMPLETION_THRESHOLD` from below — grants the "pattern
   * master" badge with `earnedAt = today`.
   *
   * Returns `true` exactly on the call that moved the count from
   * `< threshold` to `>= threshold`, so the caller (panel) can
   * trigger its badge celebration UI. Subsequent calls continue to
   * increment the counter but return `false` and do not re-grant the
   * badge.
   */
  recordDrillCompletion: (originSentenceId: string, today?: string) => boolean;
  /** True when `originSentenceId` has an entry in `patternBadges`. */
  hasPatternBadge: (originSentenceId: string) => boolean;
  hydrate: () => Promise<void>;
  /** Test-only: wipe everything (both memory + disk). */
  reset: () => void;
};

const initialPersisted: PersistedShape = {
  dailyGoal: DEFAULT_DAILY_GOAL,
  sentencesCompletedToday: 0,
  totalSentencesCompleted: 0,
  currentStreak: 0,
  bestStreak: 0,
  hearts: MAX_HEARTS,
  lastActiveDate: null,
  lastStreakDate: null,
  goalHitToday: false,
  drillCompletions: {},
  patternBadges: {},
};

const initialState: ProgressState = {
  ...initialPersisted,
  hydrated: false,
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(prev: string, next: string): number {
  const p = Date.parse(prev);
  const n = Date.parse(next);
  if (Number.isNaN(p) || Number.isNaN(n)) return Number.POSITIVE_INFINITY;
  return Math.round((n - p) / 86_400_000);
}

async function readPersisted(): Promise<Partial<PersistedShape> | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<PersistedShape>;
  } catch {
    return null;
  }
}

async function writePersisted(state: PersistedShape): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Next launch re-reads the previous good snapshot.
  }
}

function snapshot(state: ProgressState): PersistedShape {
  return {
    dailyGoal: state.dailyGoal,
    sentencesCompletedToday: state.sentencesCompletedToday,
    totalSentencesCompleted: state.totalSentencesCompleted,
    currentStreak: state.currentStreak,
    bestStreak: state.bestStreak,
    hearts: state.hearts,
    lastActiveDate: state.lastActiveDate,
    lastStreakDate: state.lastStreakDate,
    goalHitToday: state.goalHitToday,
    drillCompletions: state.drillCompletions,
    patternBadges: state.patternBadges,
  };
}

export const useProgressStore = create<ProgressState & ProgressActions>(
  (set, get) => ({
    ...initialState,

    setDailyGoal: (dailyGoal) => {
      if (!DAILY_GOAL_OPTIONS.includes(dailyGoal)) return;
      set({ dailyGoal });
      void writePersisted(snapshot(get()));
    },

    completeSentence: (today = todayIso()) => {
      // First, make sure the calendar state is fresh for *this* date.
      get().reconcileForToday(today);
      const before = get();
      const nextCount = before.sentencesCompletedToday + 1;
      const hitNow = !before.goalHitToday && nextCount >= before.dailyGoal;

      let nextStreak = before.currentStreak;
      let nextBest = before.bestStreak;
      let nextStreakDate = before.lastStreakDate;

      if (hitNow) {
        const gap =
          before.lastStreakDate === null
            ? Number.POSITIVE_INFINITY
            : daysBetween(before.lastStreakDate, today);
        nextStreak = gap === 1 ? before.currentStreak + 1 : 1;
        nextBest = Math.max(before.bestStreak, nextStreak);
        nextStreakDate = today;
      }

      set({
        sentencesCompletedToday: nextCount,
        totalSentencesCompleted: before.totalSentencesCompleted + 1,
        lastActiveDate: today,
        goalHitToday: before.goalHitToday || hitNow,
        currentStreak: nextStreak,
        bestStreak: nextBest,
        lastStreakDate: nextStreakDate,
      });
      void writePersisted(snapshot(get()));
      return hitNow;
    },

    resetStreak: () => {
      set({ currentStreak: 0 });
      void writePersisted(snapshot(get()));
    },

    loseHeart: () => {
      set((state) => ({ hearts: Math.max(0, state.hearts - 1) }));
      void writePersisted(snapshot(get()));
    },

    refillHearts: () => {
      set({ hearts: MAX_HEARTS });
      void writePersisted(snapshot(get()));
    },

    reconcileForToday: (today = todayIso()) => {
      const s = get();
      if (s.lastActiveDate === today) return;

      // Day rolled over. Reset daily counter + goal flag.
      let nextStreak = s.currentStreak;
      if (s.lastStreakDate !== null) {
        const gap = daysBetween(s.lastStreakDate, today);
        if (gap > 1) nextStreak = 0;
      }

      set({
        sentencesCompletedToday: 0,
        goalHitToday: false,
        lastActiveDate: today,
        currentStreak: nextStreak,
      });
      void writePersisted(snapshot(get()));
    },

    recordDrillCompletion: (originSentenceId, today = todayIso()) => {
      const before = get();
      const prevCount = before.drillCompletions[originSentenceId] ?? 0;
      const nextCount = prevCount + 1;
      const crossed =
        prevCount < DRILL_COMPLETION_THRESHOLD &&
        nextCount >= DRILL_COMPLETION_THRESHOLD;

      // Build new maps immutably so downstream selectors see a fresh
      // reference. Preserve the existing badge entry when we've
      // already granted it — re-granting would clobber the original
      // `earnedAt` and Req 2.7 only cares about the *first* crossing.
      const nextDrillCompletions: DrillCompletionMap = {
        ...before.drillCompletions,
        [originSentenceId]: nextCount,
      };
      const nextPatternBadges: EarnedBadges = crossed
        ? {
            ...before.patternBadges,
            [originSentenceId]: { earnedAt: today },
          }
        : before.patternBadges;

      set({
        drillCompletions: nextDrillCompletions,
        patternBadges: nextPatternBadges,
      });
      void writePersisted(snapshot(get()));
      return crossed;
    },

    hasPatternBadge: (originSentenceId) => {
      return get().patternBadges[originSentenceId] !== undefined;
    },

    hydrate: async () => {
      const persisted = await readPersisted();
      set({
        ...initialPersisted,
        ...persisted,
        hydrated: true,
      });
      // After hydrating, run a reconcile pass so the UI never shows stale
      // "yesterday" counters on first paint.
      get().reconcileForToday();
    },

    reset: () => {
      set(initialState);
      void AsyncStorage.removeItem(STORAGE_KEY);
    },
  }),
);

/**
 * Hook: hydrates the store once on mount and runs a reconcile pass every
 * time the app surface becomes active. Components that care about
 * "today" numbers should render this or subscribe to `hydrated`.
 */
export function useHydrateProgressStore(): boolean {
  const hydrated = useProgressStore((s) => s.hydrated);
  useEffect(() => {
    if (!hydrated) void useProgressStore.getState().hydrate();
  }, [hydrated]);
  return hydrated;
}
