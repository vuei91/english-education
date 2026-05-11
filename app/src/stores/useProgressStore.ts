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

// ---------------------------------------------------------------------------
// SyncService binding (curriculum-foundation Task 10.4 / Task 11 entry point)
//
// `markStepCompleted` needs to enqueue curriculum progress for eventual
// upload (Req 6.7) but importing `SyncService` here would create a cycle:
//    services/sync ─► stores (existing consumers)
//    stores/useProgressStore ─► services/sync (NEW import)
// Instead we expose a tiny injection seam. At app boot, the container
// that instantiates SyncService calls `bindCurriculumProgressSync(fn)`
// with a closure that forwards to `syncService.queueCurriculumProgress`.
// Tests and cold boots leave it unbound — the `markStepCompleted` action
// still completes, it just skips the queue write. The actual network
// shape is declared in Task 11.1.
//
type CurriculumProgressPayload = {
  completedUnitIds: readonly string[];
  completedStepIds: readonly string[];
};

type CurriculumProgressSyncFn = (payload: CurriculumProgressPayload) => void | Promise<void>;

let boundSync: CurriculumProgressSyncFn | null = null;

/**
 * Connect `useProgressStore.markStepCompleted` to a SyncService-backed
 * enqueue. Call once from the app shell after SyncService is ready; pass
 * `null` to unbind (useful in tests). No-ops when called twice with the
 * same reference.
 */
export function bindCurriculumProgressSync(fn: CurriculumProgressSyncFn | null): void {
  boundSync = fn;
}

async function queueCurriculumProgressViaBinding(
  payload: CurriculumProgressPayload,
): Promise<void> {
  if (!boundSync) return;
  try {
    await boundSync(payload);
  } catch {
    // Sync is best-effort; the local state is the source of truth and
    // the next flush will pick the row up from the queue anyway.
  }
}

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
  /**
   * Completed curriculum units (ids of `curriculum_unit`). Stored as
   * `string[]` on disk because JSON cannot serialise `Set`; the
   * in-memory shape in `ProgressState` is `Set<string>` so membership
   * checks stay O(1) (design D3). Pre-curriculum persist payloads
   * don't carry this field and are merged against `initialPersisted`
   * in `hydrate` (Req 6.7).
   */
  completedUnitIds: string[];
  /** Completed curriculum steps — same storage strategy as units. (Req 6.7) */
  completedStepIds: string[];
  /**
   * Per-day sentence index: `{ [dayNumber]: sentenceIndex }`.
   * Tracks where in the sentence array the user is, so re-entering a Day
   * resumes from that position. Cleared for a day when it's fully completed.
   */
  dayProgress: Record<number, number>;
  /**
   * Completed reading passage IDs (Track B). Stored as `string[]` on disk,
   * converted to `Set<string>` in memory for O(1) lookups.
   */
  completedReadingPassageIds: string[];
};

/**
 * Runtime state. Curriculum completion lives as `Set<string>` for fast
 * `has()` lookups on every Track A/B render (design D3). Serialisation
 * converts to `string[]` in `snapshot` and back via `new Set(array)` in
 * `hydrate`.
 */
export type ProgressState = Omit<
  PersistedShape,
  'completedUnitIds' | 'completedStepIds' | 'completedReadingPassageIds'
> & {
  hydrated: boolean;
  completedUnitIds: Set<string>;
  completedStepIds: Set<string>;
  completedReadingPassageIds: Set<string>;
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
  /**
   * Mark a curriculum step completed (Req 6.5). `allStepIdsOfUnit` is
   * the full step-id list of the owning unit — when every id is in
   * `completedStepIds` after the insert, the unit itself is also
   * marked complete (Req 6.6) and the returned `unitCompleted` flag
   * flips to `true` so the caller can trigger celebratory UI / an
   * analytics event.
   *
   * Idempotent: re-completing an already-completed step is a no-op
   * and returns `{ unitCompleted: false }` (we don't want a second
   * celebration on replay).
   *
   * Persistence: every call flushes to AsyncStorage, and a best-effort
   * `SyncService.queueCurriculumProgress` call lets the Sync spec pick
   * it up later. The sync call is wired through `bindSyncService` —
   * unbound stores (tests, cold boot) just skip that leg.
   */
  markStepCompleted: (
    unitId: string,
    stepId: string,
    allStepIdsOfUnit: readonly string[],
  ) => { unitCompleted: boolean };
  /** Set the current sentence index for a Day. */
  setDayProgress: (dayNumber: number, sentenceIndex: number) => void;
  /** Clear a Day's progress (called when Day is fully completed or reset). */
  clearDayProgress: (dayNumber: number) => void;
  /** Mark a reading passage (Track B) as completed. Idempotent. */
  completeReadingPassage: (passageId: string) => void;
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
  completedUnitIds: [],
  completedStepIds: [],
  dayProgress: {},
  completedReadingPassageIds: [],
};

const initialState: ProgressState = {
  ...initialPersisted,
  completedUnitIds: new Set<string>(),
  completedStepIds: new Set<string>(),
  completedReadingPassageIds: new Set<string>(),
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
    // Convert Sets → arrays for JSON. `hydrate` does the inverse.
    completedUnitIds: Array.from(state.completedUnitIds),
    completedStepIds: Array.from(state.completedStepIds),
    completedReadingPassageIds: Array.from(state.completedReadingPassageIds),
    dayProgress: state.dayProgress,
  };
}

export const useProgressStore = create<ProgressState & ProgressActions>((set, get) => ({
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
      prevCount < DRILL_COMPLETION_THRESHOLD && nextCount >= DRILL_COMPLETION_THRESHOLD;

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

  markStepCompleted: (unitId, stepId, allStepIdsOfUnit) => {
    const before = get();

    // Idempotent: if the step is already completed, don't re-run the
    // unit-completion detector. Re-granting a unit completion would
    // double-celebrate, and we'd also re-queue a no-op sync row.
    if (before.completedStepIds.has(stepId)) {
      return { unitCompleted: false };
    }

    const nextStepIds = new Set(before.completedStepIds);
    nextStepIds.add(stepId);

    // Unit is complete only the first time *every* declared step is
    // in the set. The caller declares the full step-id list so we
    // don't have to reach into the curriculum catalog from inside
    // the store (keeps the dependency graph one-way: curriculum →
    // progress, never the other direction).
    const unitCompleted =
      !before.completedUnitIds.has(unitId) && allStepIdsOfUnit.every((id) => nextStepIds.has(id));

    const nextUnitIds = unitCompleted
      ? new Set(before.completedUnitIds).add(unitId)
      : before.completedUnitIds;

    set({
      completedStepIds: nextStepIds,
      completedUnitIds: nextUnitIds,
    });
    // AsyncStorage write is best-effort; next launch will re-read the
    // previous good snapshot if this flight fails (same policy as the
    // other actions in this store).
    void writePersisted(snapshot(get()));

    // Signature is declared on the SyncService side by
    // curriculum-foundation Task 11.1. We call through the binding
    // module so this store never imports SyncService directly (avoids
    // the circular `services → stores → services` dependency). The
    // binding is a no-op until Task 11 wires a concrete service in.
    void queueCurriculumProgressViaBinding({
      completedUnitIds: Array.from(nextUnitIds),
      completedStepIds: Array.from(nextStepIds),
    });

    return { unitCompleted };
  },

  setDayProgress: (dayNumber, sentenceIndex) => {
    const before = get();
    set({ dayProgress: { ...before.dayProgress, [dayNumber]: sentenceIndex } });
    void writePersisted(snapshot(get()));
  },

  clearDayProgress: (dayNumber) => {
    const before = get();
    const next = { ...before.dayProgress };
    delete next[dayNumber];
    set({ dayProgress: next });
    void writePersisted(snapshot(get()));
  },

  completeReadingPassage: (passageId) => {
    const before = get();
    if (before.completedReadingPassageIds.has(passageId)) return;
    const next = new Set(before.completedReadingPassageIds);
    next.add(passageId);
    set({ completedReadingPassageIds: next });
    void writePersisted(snapshot(get()));
  },

  hydrate: async () => {
    const persisted = await readPersisted();
    const merged: PersistedShape = {
      ...initialPersisted,
      ...persisted,
    };
    set({
      ...merged,
      // Re-hydrate Set<string> from the persisted `string[]` shape
      // (design D3). Defensive fallback to `[]` handles older payloads
      // written before curriculum-foundation rolled out.
      completedUnitIds: new Set(merged.completedUnitIds ?? []),
      completedStepIds: new Set(merged.completedStepIds ?? []),
      completedReadingPassageIds: new Set(merged.completedReadingPassageIds ?? []),
      hydrated: true,
    });
    // After hydrating, run a reconcile pass so the UI never shows stale
    // "yesterday" counters on first paint.
    get().reconcileForToday();
  },

  reset: () => {
    // Fresh Sets on every reset — callers that stash the old reference
    // should not observe mutations via a stale pointer.
    set({
      ...initialState,
      completedUnitIds: new Set<string>(),
      completedStepIds: new Set<string>(),
      completedReadingPassageIds: new Set<string>(),
    });
    void AsyncStorage.removeItem(STORAGE_KEY);
  },
}));

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
