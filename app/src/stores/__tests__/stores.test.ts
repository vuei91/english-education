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

  it('starts anonymous with A2 / Track A defaults', () => {
    const s = useUserStore.getState();
    expect(s.userId).toBeNull();
    expect(s.anonymousId).toBeNull();
    expect(s.cefrLevel).toBe('A2');
    expect(s.preferredTrack).toBe('A');
    expect(s.onboardingCompleted).toBe(false);
  });

  it('flags onboarding completed', () => {
    useUserStore.getState().completeOnboarding();
    expect(useUserStore.getState().onboardingCompleted).toBe(true);
  });

  it('updates CEFR level and preferred track', () => {
    useUserStore.getState().setCefrLevel('B1');
    useUserStore.getState().setPreferredTrack('B');
    const s = useUserStore.getState();
    expect(s.cefrLevel).toBe('B1');
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
