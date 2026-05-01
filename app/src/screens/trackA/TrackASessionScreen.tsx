import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../../navigation/types';
import { audioPlayer } from '../../services/audio/audioPlayer';
import { ContentService, type Sentence } from '../../services/content';
import { CurriculumService } from '../../services/curriculum/CurriculumService';
import { getSupabaseClient } from '../../lib/supabase';
import { getContentDatabase } from '../../db';
import { useSessionStore, useUserStore, useVocabStore, useProgressStore } from '../../stores';
import { useTheme, type Theme } from '../../theme';
import type { CurriculumStep, SentenceFeedback } from '../../types/domain';
import AudioControls from './AudioControls';
import FeedbackBar from './FeedbackBar';
import SentenceCard, { type CardMode } from './SentenceCard';

/**
 * Track A session screen — Req 1.1, 1.3, 1.6, 1.8.
 *
 * Responsibilities:
 *   - Ask ContentService for the next sentence (1.1)
 *   - Auto-play the native audio once on arrival (1.3)
 *   - Let the user replay via the listen button (1.4)
 *   - Route word taps to VocabHelper (1.8)
 *   - Gather "known/hard" feedback and advance (1.6, 1.7)
 *
 * Explicit Non-Goals (enforced by absence):
 *   - No microphone, no speech recognition, no pronunciation score (1.5)
 *   - No penalty for skipping — the Next button is always live (Req 3 in 3-4)
 *
 * Note on services: we instantiate ContentService lazily and keep it in a
 * ref so React Native Fast Refresh doesn't create a fresh Supabase client
 * on every render.
 */
export default function TrackASessionScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TrackASession'>>();
  const unitId = route.params?.unitId;
  const dayNumber = route.params?.dayNumber;

  const cefrLevel = useUserStore((s) => s.cefrLevel);
  const startSession = useSessionStore((s) => s.startSession);
  const endSession = useSessionStore((s) => s.endSession);
  const recordTap = useVocabStore((s) => s.recordTap);
  const recentTaps = useVocabStore((s) => s.recentTaps);
  const completeSentence = useProgressStore((s) => s.completeSentence);

  const [sentence, setSentence] = useState<Sentence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playCount, setPlayCount] = useState(0);
  const [stepLabel, setStepLabel] = useState<string | null>(null);
  /** Current card presentation mode. */
  const [cardMode, setCardMode] = useState<CardMode>('en-to-ko');
  /** Progress: how many sentences completed (shown MIN_REPEATS times) in current step. */
  const [completedCount, setCompletedCount] = useState(0);
  /** Progress: total sentences in current step. */
  const [totalInStep, setTotalInStep] = useState(0);
  /**
   * Per-sentence exposure count in this session. A sentence is only
   * excluded from the RPC query after it has been shown
   * `MIN_REPEATS` times, ensuring every sentence gets practised at
   * least 3 times before moving on.
   */
  const exposureMapRef = useRef<Record<string, number>>({});
  /** Minimum times each sentence must be shown before it's excluded. */
  const MIN_REPEATS = 3;
  /**
   * Total number of sentences presented so far in this session.
   * The first few are shown in `en-to-ko` mode (English first) so the
   * learner gets familiar with the pattern, then the rest switch to
   * `ko-to-en` (Korean first, English hidden) for active recall.
   */
  const sessionCountRef = useRef(0);
  /** How many sentences to show in en-to-ko mode before switching. */
  const EN_FIRST_COUNT = 3;
  /** Curriculum steps for the selected unit, loaded once. */
  const stepsRef = useRef<CurriculumStep[]>([]);
  /** Index into stepsRef — advances when a step's sentences are exhausted. */
  const stepIndexRef = useRef(0);

  const serviceRef = useRef<ContentService | null>(null);
  const curriculumSvcRef = useRef<CurriculumService | null>(null);

  const getService = useCallback(async () => {
    if (serviceRef.current) return serviceRef.current;
    const db = await getContentDatabase();
    serviceRef.current = new ContentService(db, getSupabaseClient());
    return serviceRef.current;
  }, []);

  const getCurriculumService = useCallback(async () => {
    if (curriculumSvcRef.current) return curriculumSvcRef.current;
    const db = await getContentDatabase();
    curriculumSvcRef.current = new CurriculumService(db, getSupabaseClient());
    return curriculumSvcRef.current;
  }, []);

  /** Load curriculum steps for the unit (once). */
  const loadSteps = useCallback(async () => {
    if (!unitId || stepsRef.current.length > 0) return;
    const csvc = await getCurriculumService();
    const bundle = await csvc.getUnitWithSteps(unitId);
    stepsRef.current = [...bundle.steps].sort((a, b) => a.orderIndex - b.orderIndex);
    stepIndexRef.current = 0;
  }, [unitId, getCurriculumService]);

  const STEP_LABELS: Record<string, string> = {
    phrase: '구 듣기',
    conjugation: '굴절 연습',
    substitution: '치환 연습',
  };

  /**
   * Present a loaded sentence. The first `EN_FIRST_COUNT` sentences in
   * the session are shown in `en-to-ko` mode (English text + audio
   * first) so the learner gets familiar with the pattern. After that,
   * every sentence switches to `ko-to-en` mode — Korean text is shown
   * and read aloud, English is hidden behind a reveal button.
   */
  const presentSentence = useCallback(
    async (next: Sentence) => {
      sessionCountRef.current += 1;
      const count = sessionCountRef.current;

      const hasKorean = Boolean(next.textKo);
      const useKoToEn = hasKorean && count > EN_FIRST_COUNT;

      setSentence(next);
      setCardMode(useKoToEn ? 'ko-to-en' : 'en-to-ko');
      startSession('A', next.id);

      if (useKoToEn && next.textKo) {
        // Korean-first mode: read Korean aloud.
        await audioPlayer.speak(next.textKo, { language: 'ko-KR' });
        setPlayCount(1);
      } else {
        // English-first mode: play English audio immediately.
        await audioPlayer.speak(next.textEn, { sentenceId: next.id });
        setPlayCount(1);
      }
    },
    [startSession],
  );

  const loadNext = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPlayCount(0);

    /** Build excludeIds: only sentences shown >= MIN_REPEATS times. */
    const getExcludeIds = (): string[] =>
      Object.entries(exposureMapRef.current)
        .filter(([, count]) => count >= MIN_REPEATS)
        .map(([id]) => id);

    /** Record that a sentence was shown once more and update progress. */
    const recordExposure = (id: string) => {
      exposureMapRef.current[id] = (exposureMapRef.current[id] ?? 0) + 1;
      // Update completed count: sentences that reached MIN_REPEATS.
      const done = Object.values(exposureMapRef.current).filter((c) => c >= MIN_REPEATS).length;
      setCompletedCount(done);
    };

    try {
      await loadSteps();
      const svc = await getService();

      const steps = stepsRef.current;
      let currentStepId: string | undefined;

      if (steps.length > 0) {
        // Try current step; if exhausted, advance to next step
        while (stepIndexRef.current < steps.length) {
          const step = steps[stepIndexRef.current];
          if (!step) break;
          currentStepId = step.id;
          setStepLabel(
            `${stepIndexRef.current + 1}/3 ${STEP_LABELS[step.stepType] ?? step.stepType}`,
          );

          const hotWords: string[] = [];
          const next = await svc.getNextSentence('A', cefrLevel, {
            hotWords,
            excludeIds: getExcludeIds(),
            curriculumStepId: currentStepId,
          });

          if (next) {
            // On first sentence of a step, fetch total count for progress.
            if (Object.keys(exposureMapRef.current).length === 0) {
              const count = await svc.countSentencesInStep(currentStepId!);
              setTotalInStep(count);
              setCompletedCount(0);
            }
            recordExposure(next.id);
            await presentSentence(next);
            return;
          }

          // No more sentences in this step — advance
          stepIndexRef.current += 1;
          // Reset exposure map for the new step so sentences start fresh.
          exposureMapRef.current = {};
        }

        // All steps exhausted
        setSentence(null);
        setStepLabel('완료');
      } else {
        // No curriculum — legacy random mode
        setStepLabel(null);
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const hotWords = Array.from(
          new Set(recentTaps.filter((t) => t.tappedAt >= cutoff).map((t) => t.word)),
        ).slice(0, 20);
        const next = await svc.getNextSentence('A', cefrLevel, {
          hotWords,
          excludeIds: getExcludeIds(),
        });
        if (next) {
          recordExposure(next.id);
          await presentSentence(next);
        } else {
          setSentence(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [cefrLevel, getService, loadSteps, presentSentence, recentTaps]);

  useEffect(() => {
    void loadNext();
    return () => {
      void audioPlayer.stop();
      endSession();
    };
    // We only want this on mount. loadNext is stable via useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlay = useCallback(async () => {
    if (!sentence) return;
    await audioPlayer.speak(sentence.textEn, { sentenceId: sentence.id });
    setPlayCount((n) => n + 1);
  }, [sentence]);

  /**
   * `ko-to-en` mode: called when the learner taps "영어 보기" to reveal
   * the English answer. Plays the audio so they can hear the correct
   * pronunciation right after seeing the text.
   */
  const handleRevealEnglish = useCallback(async () => {
    if (!sentence) return;
    await audioPlayer.speak(sentence.textEn, { sentenceId: sentence.id });
    setPlayCount((n) => n + 1);
  }, [sentence]);

  /** Replay the Korean sentence via Korean TTS. */
  const handlePlayKorean = useCallback(async () => {
    if (!sentence?.textKo) return;
    await audioPlayer.speak(sentence.textKo, { language: 'ko-KR' });
  }, [sentence]);

  const handleWordPress = useCallback(
    (word: string) => {
      if (!sentence) return;
      recordTap({
        word,
        tappedAt: Date.now(),
        sourceSentenceId: sentence.id,
      });
      navigation.navigate('VocabHelper', {
        word,
        sourceSentenceId: sentence.id,
      });
    },
    [navigation, recordTap, sentence],
  );

  const handleFeedback = useCallback(
    async (_feedback: SentenceFeedback) => {
      // _feedback is stored as part of the sync queue in Task 17 wiring.
      // Here we just advance; ranking uses the same value in Task 11.
      completeSentence();
      await loadNext();
    },
    [completeSentence, loadNext],
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>문장을 불러오지 못했어요.</Text>
            <Text style={styles.errorDetail}>{error}</Text>
            <Pressable
              onPress={() => {
                void loadNext();
              }}
              style={styles.retry}
              accessibilityRole="button"
              accessibilityLabel="다시 시도"
            >
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : sentence ? (
          <>
            {stepLabel && (
              <View style={styles.stepHeader}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{stepLabel}</Text>
                </View>
                {totalInStep > 0 && (
                  <Text style={styles.progressText}>
                    {completedCount} / {totalInStep} 완료
                  </Text>
                )}
              </View>
            )}
            <SentenceCard
              textEn={sentence.textEn}
              textKo={sentence.textKo}
              onWordPress={handleWordPress}
              mode={cardMode}
              onRevealEnglish={() => {
                void handleRevealEnglish();
              }}
              onPlayKorean={() => {
                void handlePlayKorean();
              }}
            />
            <AudioControls onPlay={handlePlay} playCount={playCount} />
            <FeedbackBar
              onPick={(fb) => {
                void handleFeedback(fb);
              }}
            />
            <Pressable
              onPress={() => {
                void loadNext();
              }}
              accessibilityRole="button"
              accessibilityLabel="다음 문장"
              style={styles.skip}
            >
              <Text style={styles.skipText}>건너뛰기 →</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.center}>
            {stepLabel === '완료' ? (
              <>
                <Text style={styles.emptyTitle}>이 단원을 모두 학습했어요! 🎉</Text>
                <Pressable
                  onPress={() => navigation.goBack()}
                  accessibilityRole="button"
                  accessibilityLabel="단원 목록으로 돌아가기"
                  style={styles.retry}
                >
                  <Text style={styles.retryText}>단원 목록으로</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.emptyTitle}>아직 내 레벨에 맞는 문장이 없어요.</Text>
                <Text style={styles.emptyDetail}>
                  내 탭에서 레벨을 조정하거나, 콘텐츠가 충분히 쌓인 뒤 다시 와주세요.
                </Text>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    scroll: {
      padding: theme.spacing.lg,
      gap: theme.spacing.lg,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    errorTitle: {
      ...theme.typography.button,
      color: theme.colors.text,
    },
    errorDetail: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      textAlign: 'center',
    },
    retry: {
      marginTop: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
    },
    retryText: {
      ...theme.typography.button,
      color: theme.colors.primaryOn,
    },
    skip: {
      alignSelf: 'flex-end',
      padding: theme.spacing.sm,
    },
    skipText: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    emptyTitle: {
      ...theme.typography.button,
      color: theme.colors.text,
      textAlign: 'center',
    },
    emptyDetail: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      textAlign: 'center',
    },
    stepHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    stepBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 4,
      borderRadius: theme.radius.sm,
    },
    stepBadgeText: {
      ...theme.typography.caption,
      color: theme.colors.primaryOn,
      fontWeight: '600',
    },
    progressText: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
  });
}
