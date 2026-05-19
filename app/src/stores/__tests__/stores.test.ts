/**
 * Store skeleton tests for Task 1.3.
 * Confirms each store starts at expected defaults and the basic mutators
 * behave correctly. Deeper behavioural tests live alongside the features
 * that own each store (sections 7, 9, 10, 12).
 */

import {
  useProgressStore,
  useSessionStore,
  useUserStore,
  useVocabStore,
  DRILL_COMPLETION_THRESHOLD,
} from '../index';

describe('useUserStore', () => {
  beforeEach(() => {
    useUserStore.getState().reset();
  });

  it('starts anonymous with Track A defaults', () => {
    const s = useUserStore.getState();
    expect(s.userId).toBeNull();
    expect(s.anonymousId).toBeNull();
    expect(s.preferredTrack).toBe('A');
    expect(s.onboardingCompleted).toBe(false);
  });

  it('flags onboarding completed', () => {
    useUserStore.getState().completeOnboarding();
    expect(useUserStore.getState().onboardingCompleted).toBe(true);
  });

  it('updates preferred track', () => {
    useUserStore.getState().setPreferredTrack('B');
    const s = useUserStore.getState();
    expect(s.preferredTrack).toBe('B');
  });
});

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.getState().endSession();
  });

  it('starts with no active session', () => {
    const s = useSessionStore.getState();
    expect(s.activeTrack).toBeNull();
    expect(s.currentSentenceId).toBeNull();
    expect(s.currentStep).toBeNull();
    expect(s.currentChunkIndex).toBe(0);
  });

  it('startSession sets Track B into the chunking step', () => {
    useSessionStore.getState().startSession('B', 'sentence-1');
    const s = useSessionStore.getState();
    expect(s.activeTrack).toBe('B');
    expect(s.currentSentenceId).toBe('sentence-1');
    expect(s.currentStep).toBe('chunking');
  });

  it('startSession for Track A leaves step as null', () => {
    useSessionStore.getState().startSession('A', 'sentence-42');
    expect(useSessionStore.getState().currentStep).toBeNull();
  });
});

describe('useProgressStore', () => {
  beforeEach(() => {
    useProgressStore.getState().reset();
    useProgressStore.setState({ hydrated: true });
  });

  it('defaults daily goal to 10 (Req 13.1)', () => {
    expect(useProgressStore.getState().dailyGoal).toBe(10);
  });

  it('completeSentence increments both today and total counters', () => {
    useProgressStore.getState().completeSentence('2026-04-29');
    useProgressStore.getState().completeSentence('2026-04-29');
    const s = useProgressStore.getState();
    expect(s.sentencesCompletedToday).toBe(2);
    expect(s.totalSentencesCompleted).toBe(2);
  });

  it('completeSentence returns true exactly once — when goal is reached', () => {
    useProgressStore.getState().setDailyGoal(5);
    const results: boolean[] = [];
    for (let i = 0; i < 6; i += 1) {
      results.push(useProgressStore.getState().completeSentence('2026-04-29'));
    }
    expect(results).toEqual([false, false, false, false, true, false]);
  });

  it('hitting daily goal on consecutive days extends streak, bestStreak tracks max', () => {
    useProgressStore.setState({ dailyGoal: 1 });
    useProgressStore.getState().completeSentence('2026-04-27');
    useProgressStore.getState().completeSentence('2026-04-28');
    useProgressStore.getState().completeSentence('2026-04-29');
    const s = useProgressStore.getState();
    expect(s.currentStreak).toBe(3);
    expect(s.bestStreak).toBe(3);
  });

  it('skipping a day resets streak on next goal hit', () => {
    useProgressStore.setState({ dailyGoal: 1 });
    useProgressStore.getState().completeSentence('2026-04-26');
    useProgressStore.getState().completeSentence('2026-04-29');
    const s = useProgressStore.getState();
    expect(s.currentStreak).toBe(1);
    expect(s.bestStreak).toBe(1);
  });

  it('reconcileForToday resets daily counter when the day changes', () => {
    useProgressStore.getState().setDailyGoal(10);
    useProgressStore.getState().completeSentence('2026-04-28');
    useProgressStore.getState().completeSentence('2026-04-28');
    useProgressStore.getState().reconcileForToday('2026-04-29');
    expect(useProgressStore.getState().sentencesCompletedToday).toBe(0);
  });

  it('resetStreak keeps bestStreak intact', () => {
    useProgressStore.setState({ dailyGoal: 1 });
    useProgressStore.getState().completeSentence('2026-04-27');
    useProgressStore.getState().completeSentence('2026-04-28');
    useProgressStore.getState().resetStreak();
    const s = useProgressStore.getState();
    expect(s.currentStreak).toBe(0);
    expect(s.bestStreak).toBe(2);
  });

  it('loseHeart never goes below zero', () => {
    for (let i = 0; i < 10; i += 1) {
      useProgressStore.getState().loseHeart();
    }
    expect(useProgressStore.getState().hearts).toBe(0);
  });

  it('setDailyGoal rejects values outside 5/10/20/30', () => {
    useProgressStore.getState().setDailyGoal(7);
    expect(useProgressStore.getState().dailyGoal).toBe(10);
    useProgressStore.getState().setDailyGoal(20);
    expect(useProgressStore.getState().dailyGoal).toBe(20);
  });
});

describe('useVocabStore', () => {
  beforeEach(() => {
    useVocabStore.getState().clearTaps();
  });

  it('records taps in most-recent-first order', () => {
    const store = useVocabStore.getState();
    store.recordTap({ word: 'inspect', tappedAt: 1, sourceSentenceId: 's1' });
    store.recordTap({ word: 'abandon', tappedAt: 2, sourceSentenceId: 's2' });
    const taps = useVocabStore.getState().recentTaps;
    expect(taps.map((t) => t.word)).toEqual(['abandon', 'inspect']);
  });

  it('caps history to 500 entries', () => {
    const store = useVocabStore.getState();
    for (let i = 0; i < 600; i += 1) {
      store.recordTap({ word: `w${i}`, tappedAt: i, sourceSentenceId: null });
    }
    expect(useVocabStore.getState().recentTaps).toHaveLength(500);
  });
});

// ---------------------------------------------------------------------------
// Task 16.1 — useSessionStore curriculum fields (Req 6.1, 6.2, 6.3)
// ---------------------------------------------------------------------------
describe('useSessionStore — curriculum fields (Task 16.1)', () => {
  beforeEach(() => {
    useSessionStore.getState().endSession();
  });

  it('startSession without curriculum arg keeps curriculum fields null (Req 6.2)', () => {
    useSessionStore.getState().startSession('A', 'sentence-1');
    const s = useSessionStore.getState();
    expect(s.activeTrack).toBe('A');
    expect(s.currentSentenceId).toBe('sentence-1');
    expect(s.currentUnitId).toBeNull();
    expect(s.currentCurriculumStepId).toBeNull();
  });

  it('startSession with curriculum arg populates unitId and curriculumStepId (Req 6.2)', () => {
    useSessionStore.getState().startSession('A', 'sentence-2', {
      unitId: 'unit-abc',
      curriculumStepId: 'step-xyz',
    });
    const s = useSessionStore.getState();
    expect(s.activeTrack).toBe('A');
    expect(s.currentSentenceId).toBe('sentence-2');
    expect(s.currentUnitId).toBe('unit-abc');
    expect(s.currentCurriculumStepId).toBe('step-xyz');
  });

  it('endSession resets curriculum fields to null (Req 6.3)', () => {
    useSessionStore.getState().startSession('A', 'sentence-3', {
      unitId: 'unit-abc',
      curriculumStepId: 'step-xyz',
    });
    useSessionStore.getState().endSession();
    const s = useSessionStore.getState();
    expect(s.activeTrack).toBeNull();
    expect(s.currentUnitId).toBeNull();
    expect(s.currentCurriculumStepId).toBeNull();
  });

  it('Track B startSession with curriculum still sets chunking step (Req 6.1)', () => {
    useSessionStore.getState().startSession('B', 'sentence-4', {
      unitId: 'unit-def',
      curriculumStepId: 'step-ghi',
    });
    const s = useSessionStore.getState();
    expect(s.activeTrack).toBe('B');
    expect(s.currentStep).toBe('chunking');
    expect(s.currentUnitId).toBe('unit-def');
    expect(s.currentCurriculumStepId).toBe('step-ghi');
  });
});

// ---------------------------------------------------------------------------
// Task 16.2 — useProgressStore.markStepCompleted (Req 6.5, 6.6)
// ---------------------------------------------------------------------------
describe('useProgressStore — markStepCompleted (Task 16.2)', () => {
  const UNIT_ID = 'unit-001';
  const STEP_IDS = ['step-phrase', 'step-conj', 'step-sub'] as const;

  beforeEach(() => {
    useProgressStore.getState().reset();
    useProgressStore.setState({ hydrated: true });
  });

  it('adds stepId to completedStepIds (Req 6.5)', () => {
    useProgressStore.getState().markStepCompleted(UNIT_ID, STEP_IDS[0], STEP_IDS);
    const s = useProgressStore.getState();
    expect(s.completedStepIds.has(STEP_IDS[0])).toBe(true);
    expect(s.completedStepIds.size).toBe(1);
  });

  it('returns { unitCompleted: false } when not all steps are done (Req 6.6)', () => {
    const result = useProgressStore
      .getState()
      .markStepCompleted(UNIT_ID, STEP_IDS[0], STEP_IDS);
    expect(result).toEqual({ unitCompleted: false });
    expect(useProgressStore.getState().completedUnitIds.has(UNIT_ID)).toBe(false);
  });

  it('returns { unitCompleted: true } when all 3 steps are completed (Req 6.6)', () => {
    useProgressStore.getState().markStepCompleted(UNIT_ID, STEP_IDS[0], STEP_IDS);
    useProgressStore.getState().markStepCompleted(UNIT_ID, STEP_IDS[1], STEP_IDS);
    const result = useProgressStore
      .getState()
      .markStepCompleted(UNIT_ID, STEP_IDS[2], STEP_IDS);
    expect(result).toEqual({ unitCompleted: true });
    expect(useProgressStore.getState().completedUnitIds.has(UNIT_ID)).toBe(true);
  });

  it('is idempotent — re-completing a step returns { unitCompleted: false }', () => {
    useProgressStore.getState().markStepCompleted(UNIT_ID, STEP_IDS[0], STEP_IDS);
    const result = useProgressStore
      .getState()
      .markStepCompleted(UNIT_ID, STEP_IDS[0], STEP_IDS);
    expect(result).toEqual({ unitCompleted: false });
    expect(useProgressStore.getState().completedStepIds.size).toBe(1);
  });

  it('tracks multiple units independently', () => {
    const UNIT_B = 'unit-002';
    const STEPS_B = ['step-b1', 'step-b2', 'step-b3'] as const;

    // Complete all steps for unit A
    for (const stepId of STEP_IDS) {
      useProgressStore.getState().markStepCompleted(UNIT_ID, stepId, STEP_IDS);
    }
    // Complete only 1 step for unit B
    useProgressStore.getState().markStepCompleted(UNIT_B, STEPS_B[0], STEPS_B);

    const s = useProgressStore.getState();
    expect(s.completedUnitIds.has(UNIT_ID)).toBe(true);
    expect(s.completedUnitIds.has(UNIT_B)).toBe(false);
    expect(s.completedStepIds.size).toBe(4); // 3 from A + 1 from B
  });
});

// ---------------------------------------------------------------------------
// Task 16.3 — hydrate round-trip for curriculum Sets (Req 6.7)
// ---------------------------------------------------------------------------
describe('useProgressStore — curriculum Set hydrate round-trip (Task 16.3)', () => {
  const UNIT_ID = 'unit-hydrate';
  const STEP_IDS = ['step-h1', 'step-h2', 'step-h3'] as const;

  beforeEach(() => {
    useProgressStore.getState().reset();
    useProgressStore.setState({ hydrated: true });
  });

  it('completedUnitIds and completedStepIds survive hydrate as Set instances (Req 6.7)', async () => {
    // Complete all steps → unit marked complete
    for (const stepId of STEP_IDS) {
      useProgressStore.getState().markStepCompleted(UNIT_ID, stepId, STEP_IDS);
    }
    expect(useProgressStore.getState().completedUnitIds.has(UNIT_ID)).toBe(true);

    // Let AsyncStorage write settle
    await Promise.resolve();

    // Wipe in-memory state (simulate app relaunch)
    useProgressStore.setState({
      completedUnitIds: new Set<string>(),
      completedStepIds: new Set<string>(),
      hydrated: false,
    });

    // Hydrate from disk
    await useProgressStore.getState().hydrate();

    const s = useProgressStore.getState();
    // Must be Set instances, not arrays
    expect(s.completedUnitIds).toBeInstanceOf(Set);
    expect(s.completedStepIds).toBeInstanceOf(Set);
    // Values must survive the round-trip
    expect(s.completedUnitIds.has(UNIT_ID)).toBe(true);
    for (const stepId of STEP_IDS) {
      expect(s.completedStepIds.has(stepId)).toBe(true);
    }
    expect(s.completedStepIds.size).toBe(3);
  });

  it('hydrate with no prior curriculum data yields empty Sets (Req 6.7)', async () => {
    // Reset clears AsyncStorage, so hydrate reads nothing
    useProgressStore.getState().reset();
    useProgressStore.setState({ hydrated: false });

    await useProgressStore.getState().hydrate();

    const s = useProgressStore.getState();
    expect(s.completedUnitIds).toBeInstanceOf(Set);
    expect(s.completedStepIds).toBeInstanceOf(Set);
    expect(s.completedUnitIds.size).toBe(0);
    expect(s.completedStepIds.size).toBe(0);
  });
});

describe('useProgressStore — pattern master badge (Task 8.5, Req 2.7)', () => {
  // Drive `today` explicitly so these tests never depend on the
  // runtime clock. DRILL_COMPLETION_THRESHOLD is 3 at the time of
  // writing; the tests are written against the exported constant so
  // a future tuning doesn't silently break them.
  const TODAY = '2026-05-01';

  beforeEach(() => {
    useProgressStore.getState().reset();
    useProgressStore.setState({ hydrated: true });
  });

  it('increments the completion count and returns false below threshold', () => {
    const store = useProgressStore.getState();
    const patternId = 'sentence-42';

    const firstCall = store.recordDrillCompletion(patternId, TODAY);
    expect(firstCall).toBe(false);
    expect(useProgressStore.getState().drillCompletions[patternId]).toBe(1);
    expect(useProgressStore.getState().hasPatternBadge(patternId)).toBe(false);

    const secondCall = useProgressStore
      .getState()
      .recordDrillCompletion(patternId, TODAY);
    expect(secondCall).toBe(false);
    expect(useProgressStore.getState().drillCompletions[patternId]).toBe(2);
    expect(useProgressStore.getState().hasPatternBadge(patternId)).toBe(false);
  });

  it('returns true exactly on the completion that crosses the threshold', () => {
    const patternId = 'sentence-42';
    const results: boolean[] = [];
    for (let i = 0; i < DRILL_COMPLETION_THRESHOLD; i += 1) {
      results.push(
        useProgressStore.getState().recordDrillCompletion(patternId, TODAY),
      );
    }
    // Only the final call — the one that hits the threshold — is true.
    const expected = Array.from(
      { length: DRILL_COMPLETION_THRESHOLD },
      (_, idx) => idx === DRILL_COMPLETION_THRESHOLD - 1,
    );
    expect(results).toEqual(expected);

    const s = useProgressStore.getState();
    expect(s.drillCompletions[patternId]).toBe(DRILL_COMPLETION_THRESHOLD);
    expect(s.hasPatternBadge(patternId)).toBe(true);
    expect(s.patternBadges[patternId]).toEqual({ earnedAt: TODAY });
  });

  it('keeps incrementing the count but stops re-granting the badge', () => {
    const patternId = 'sentence-42';
    // Reach threshold.
    for (let i = 0; i < DRILL_COMPLETION_THRESHOLD; i += 1) {
      useProgressStore.getState().recordDrillCompletion(patternId, '2026-01-01');
    }
    const grantedAt =
      useProgressStore.getState().patternBadges[patternId]!.earnedAt;
    expect(grantedAt).toBe('2026-01-01');

    // Two more completions on a later date. Counter bumps from 3 → 5,
    // but the badge's `earnedAt` stays pinned to the first-crossing day.
    expect(
      useProgressStore.getState().recordDrillCompletion(patternId, '2026-03-01'),
    ).toBe(false);
    expect(
      useProgressStore.getState().recordDrillCompletion(patternId, '2026-03-02'),
    ).toBe(false);

    const s = useProgressStore.getState();
    expect(s.drillCompletions[patternId]).toBe(DRILL_COMPLETION_THRESHOLD + 2);
    expect(s.patternBadges[patternId]!.earnedAt).toBe('2026-01-01');
  });

  it('tracks independent counts and badges per originSentenceId', () => {
    // Pattern A crosses the threshold. Pattern B gets one completion.
    for (let i = 0; i < DRILL_COMPLETION_THRESHOLD; i += 1) {
      useProgressStore.getState().recordDrillCompletion('pattern-a', TODAY);
    }
    useProgressStore.getState().recordDrillCompletion('pattern-b', TODAY);

    const s = useProgressStore.getState();
    expect(s.drillCompletions['pattern-a']).toBe(DRILL_COMPLETION_THRESHOLD);
    expect(s.drillCompletions['pattern-b']).toBe(1);
    expect(s.hasPatternBadge('pattern-a')).toBe(true);
    expect(s.hasPatternBadge('pattern-b')).toBe(false);
  });

  it('reset() clears drill completions and pattern badges', () => {
    for (let i = 0; i < DRILL_COMPLETION_THRESHOLD; i += 1) {
      useProgressStore.getState().recordDrillCompletion('pattern-a', TODAY);
    }
    expect(useProgressStore.getState().hasPatternBadge('pattern-a')).toBe(true);

    useProgressStore.getState().reset();
    const s = useProgressStore.getState();
    expect(s.drillCompletions).toEqual({});
    expect(s.patternBadges).toEqual({});
    expect(s.hasPatternBadge('pattern-a')).toBe(false);
  });

  it('persists drill completions and badges across hydrate() cycles', async () => {
    // Round-trip through AsyncStorage: bump + grant, swap the in-
    // memory state to defaults, then hydrate() and assert values
    // survive. The AsyncStorage Jest mock retains writes within the
    // test process, so `writePersisted` → `readPersisted` is
    // observable here without touching the filesystem.
    const patternId = 'sentence-persist';
    for (let i = 0; i < DRILL_COMPLETION_THRESHOLD; i += 1) {
      useProgressStore.getState().recordDrillCompletion(patternId, TODAY);
    }
    // `writePersisted` inside recordDrillCompletion is void-returned
    // (fire-and-forget). AsyncStorage's Jest mock resolves
    // synchronously after the microtask queue flushes, so a single
    // await is enough to guarantee the write settled.
    await Promise.resolve();

    // Wipe in-memory state but leave disk intact — simulating an app
    // relaunch.
    useProgressStore.setState({
      drillCompletions: {},
      patternBadges: {},
      hydrated: false,
    });

    await useProgressStore.getState().hydrate();

    const s = useProgressStore.getState();
    expect(s.drillCompletions[patternId]).toBe(DRILL_COMPLETION_THRESHOLD);
    expect(s.hasPatternBadge(patternId)).toBe(true);
    expect(s.patternBadges[patternId]).toEqual({ earnedAt: TODAY });
  });
});
