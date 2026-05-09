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
import type { CurriculumDay, CurriculumStep, IntroPhrase } from '../../types/domain';
import AudioControls from './AudioControls';
import SentenceCard, { type CardMode } from './SentenceCard';

/**
 * Track A session — simplified design.
 *
 * Flow:
 *   1. On mount, preload ALL sentences for this Day (across all units/steps)
 *      sorted by step order → created_at.
 *   2. Track the current position with a single `currentIndex` (0-based).
 *   3. Restore position from `dayProgress[dayNumber]` on re-entry.
 *   4. "다음" → index + 1. "이전" → index - 1.
 *   5. First EN_FIRST_COUNT sentences in ko-to-en if Korean available,
 *      based on `currentIndex` (not session counter) so mode is stable
 *      across re-entry.
 *   6. On completion (index >= sentences.length), mark all steps/units
 *      completed and clear dayProgress for this Day.
 */
export default function TrackASessionScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TrackASession'>>();
  const unitId = route.params?.unitId;
  const unitIds = route.params?.unitIds;
  const dayNumber = route.params?.dayNumber;

  const cefrLevel = useUserStore((s) => s.cefrLevel);
  const startSession = useSessionStore((s) => s.startSession);
  const endSession = useSessionStore((s) => s.endSession);
  const recordTap = useVocabStore((s) => s.recordTap);
  const completeSentence = useProgressStore((s) => s.completeSentence);
  const markStepCompleted = useProgressStore((s) => s.markStepCompleted);
  const dayProgress = useProgressStore((s) => s.dayProgress);
  const setDayProgress = useProgressStore((s) => s.setDayProgress);
  const clearDayProgress = useProgressStore((s) => s.clearDayProgress);

  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playCount, setPlayCount] = useState(0);
  const [nextDay, setNextDay] = useState<CurriculumDay | null>(null);

  // Intro phase state
  const [introPhrases, setIntroPhrases] = useState<IntroPhrase[]>([]);
  const [introIndex, setIntroIndex] = useState(0);
  const [phase, setPhase] = useState<'day-intro' | 'intro' | 'main'>('day-intro');
  const [dayDescription, setDayDescription] = useState<string | null>(null);

  /** Refs for service singletons. */
  const contentSvcRef = useRef<ContentService | null>(null);
  const curriculumSvcRef = useRef<CurriculumService | null>(null);
  /** Full list of curriculum steps, used for marking completion. */
  const allStepsRef = useRef<CurriculumStep[]>([]);
  /** Tracks whether we've initialised from persisted state already. */
  const initialisedRef = useRef(false);

  /** How many sentences to show in `en-to-ko` mode before switching. */
  const EN_FIRST_COUNT = 3;

  const getContentService = useCallback(async () => {
    if (contentSvcRef.current) return contentSvcRef.current;
    const db = await getContentDatabase();
    contentSvcRef.current = new ContentService(db, getSupabaseClient());
    return contentSvcRef.current;
  }, []);

  const getCurriculumService = useCallback(async () => {
    if (curriculumSvcRef.current) return curriculumSvcRef.current;
    const db = await getContentDatabase();
    curriculumSvcRef.current = new CurriculumService(db, getSupabaseClient());
    return curriculumSvcRef.current;
  }, []);

  /**
   * Load all sentences for the Day's units, preserving step → created_at order.
   * Also sets the current index from persisted dayProgress.
   */
  const loadDay = useCallback(async () => {
    if (initialisedRef.current) return;
    initialisedRef.current = true;

    setLoading(true);
    setError(null);

    try {
      const idsToLoad = unitIds && unitIds.length > 0 ? unitIds : unitId ? [unitId] : [];
      if (idsToLoad.length === 0) {
        setSentences([]);
        return;
      }

      const csvc = await getCurriculumService();
      const svc = await getContentService();

      // Collect steps across all units in order
      const allSteps: CurriculumStep[] = [];
      for (const uid of idsToLoad) {
        const bundle = await csvc.getUnitWithSteps(uid);
        const sorted = [...bundle.steps].sort((a, b) => a.orderIndex - b.orderIndex);
        allSteps.push(...sorted);
      }
      allStepsRef.current = allSteps;

      // Fetch all sentences in one shot (no level filter — curriculum order is the guide)
      const stepIds = allSteps.map((s) => s.id);
      const loaded = await svc.getSentencesForSteps(stepIds);
      setSentences(loaded);

      // Restore position from persisted state
      if (dayNumber) {
        const savedIndex = dayProgress[dayNumber] ?? 0;
        const clamped = Math.max(0, Math.min(savedIndex, loaded.length - 1));
        setCurrentIndex(clamped);

        // Load intro phrases for this Day
        const dayData = await csvc.getDayByNumber(dayNumber);

        if (savedIndex === 0) {
          // Day 설명이 있으면 패턴 전에 보여준다
          if (dayData && dayData.descriptionKo) {
            setDayDescription(dayData.descriptionKo);
            setPhase('day-intro');
          }

          // Load intro phrases for after day-intro
          if (dayData && dayData.introPhrases.length > 0) {
            setIntroPhrases(dayData.introPhrases);
            setIntroIndex(0);
            if (!dayData.descriptionKo) {
              setPhase('intro');
            }
          } else if (!dayData?.descriptionKo) {
            setPhase('main');
          }
        } else {
          // 이어하기: 바로 본 학습으로
          setPhase('main');
        }
      } else {
        // dayNumber 없이 직접 진입한 경우
        setPhase('main');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      initialisedRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [unitId, unitIds, dayNumber, cefrLevel, dayProgress, getContentService, getCurriculumService]);

  // Prefetch the next Day for "다음 학습" navigation when the Day completes.
  const prefetchNextDay = useCallback(async () => {
    if (!dayNumber) return;
    try {
      const csvc = await getCurriculumService();
      const next = await csvc.getDayByNumber(dayNumber + 1);
      setNextDay(next);
    } catch {
      // Silent — user can go back manually if this fails.
    }
  }, [dayNumber, getCurriculumService]);

  // Mount: load Day + prefetch next.
  useEffect(() => {
    void loadDay();
    void prefetchNextDay();
    return () => {
      void audioPlayer.stop();
      endSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Current sentence (undefined when Day completed or empty). */
  const sentence = sentences[currentIndex];

  /** Present the current sentence's audio + start session state. */
  useEffect(() => {
    if (!sentence || phase !== 'main') return;
    const hasKorean = Boolean(sentence.textKo);
    const useKoToEn = hasKorean && currentIndex >= EN_FIRST_COUNT;
    startSession('A', sentence.id);
    setPlayCount(0);

    void (async () => {
      if (useKoToEn && sentence.textKo) {
        await audioPlayer.speak(sentence.textKo, { language: 'ko-KR' });
      } else {
        await audioPlayer.speak(sentence.textEn, { sentenceId: sentence.id });
      }
      setPlayCount(1);
    })();

    // Persist current position
    if (dayNumber) {
      setDayProgress(dayNumber, currentIndex);
    }
  }, [sentence, currentIndex, dayNumber, phase, setDayProgress, startSession]);

  /** Keep header title clean. */
  useEffect(() => {
    const base = dayNumber ? `Day ${dayNumber}` : (route.params?.unitTitle ?? '');
    navigation.setOptions({ title: base });
  }, [dayNumber, navigation, route.params?.unitTitle]);

  const totalCount = sentences.length;
  const progress = totalCount > 0 ? (currentIndex + 1) / totalCount : 0;
  const hasKorean = Boolean(sentence?.textKo);
  const useKoToEn = hasKorean && currentIndex >= EN_FIRST_COUNT;
  const cardMode: CardMode = useKoToEn ? 'ko-to-en' : 'en-to-ko';
  const allDone = totalCount > 0 && currentIndex >= totalCount;

  // --- Intro phase handlers ---
  const currentIntro = introPhrases[introIndex] as IntroPhrase | undefined;

  const handleIntroPlay = useCallback(async () => {
    if (!currentIntro) return;
    await audioPlayer.speak(currentIntro.en, { language: 'en-US' });
    setPlayCount((n) => n + 1);
  }, [currentIntro]);

  const handleIntroNext = useCallback(() => {
    if (introIndex < introPhrases.length - 1) {
      setIntroIndex(introIndex + 1);
      setPlayCount(0);
    } else {
      // Intro done → switch to main phase
      setPhase('main');
      setPlayCount(0);
    }
  }, [introIndex, introPhrases.length]);

  const handleIntroPrev = useCallback(() => {
    if (introIndex > 0) {
      setIntroIndex(introIndex - 1);
      setPlayCount(0);
    }
  }, [introIndex]);

  // Auto-play intro phrase when it changes
  useEffect(() => {
    if (phase !== 'intro' || !currentIntro) return;
    setPlayCount(0);
    void audioPlayer.speak(currentIntro.en, { language: 'en-US' }).then(() => {
      setPlayCount(1);
    });
  }, [phase, currentIntro]);

  /** Dismiss day intro → move to intro phrases or main. */
  const handleDayIntroDismiss = useCallback(() => {
    if (introPhrases.length > 0) {
      setPhase('intro');
    } else {
      setPhase('main');
    }
  }, [introPhrases.length]);

  const handlePlay = useCallback(async () => {
    if (!sentence) return;
    await audioPlayer.speak(sentence.textEn, { sentenceId: sentence.id });
    setPlayCount((n) => n + 1);
  }, [sentence]);

  const handleRevealEnglish = useCallback(async () => {
    if (!sentence) return;
    await audioPlayer.speak(sentence.textEn, { sentenceId: sentence.id });
    setPlayCount((n) => n + 1);
  }, [sentence]);

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

  /** Mark all steps/units complete and clear Day progress. */
  const finishDay = useCallback(() => {
    const steps = allStepsRef.current;
    // Group steps by unit
    const unitSteps = new Map<string, CurriculumStep[]>();
    for (const s of steps) {
      const list = unitSteps.get(s.unitId) ?? [];
      list.push(s);
      unitSteps.set(s.unitId, list);
    }
    for (const [uid, stepList] of unitSteps.entries()) {
      const allStepIds = stepList.map((s) => s.id);
      for (const step of stepList) {
        markStepCompleted(uid, step.id, allStepIds);
      }
    }
    if (dayNumber) clearDayProgress(dayNumber);
  }, [dayNumber, markStepCompleted, clearDayProgress]);

  const handleNext = useCallback(() => {
    completeSentence();
    const next = currentIndex + 1;
    if (next >= totalCount) {
      // Day done
      finishDay();
    }
    setCurrentIndex(next);
  }, [completeSentence, currentIndex, totalCount, finishDay]);

  const handlePrev = useCallback(() => {
    if (currentIndex <= 0) return;
    setCurrentIndex(currentIndex - 1);
  }, [currentIndex]);

  const canGoBack = currentIndex > 0;

  return (
    <View style={styles.container}>
      {phase === 'intro' ? (
        <View style={styles.topBar}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${((introIndex + 1) / introPhrases.length) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            핵심 패턴 {introIndex + 1} / {introPhrases.length}
          </Text>
        </View>
      ) : totalCount > 0 && !allDone ? (
        <View style={styles.topBar}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
          </View>
          <Text
            style={styles.progressLabel}
            accessibilityLabel={`${currentIndex + 1} / ${totalCount} 완료`}
          >
            {currentIndex + 1} / {totalCount}
          </Text>
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        style={styles.scrollFlex}
      >
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
                initialisedRef.current = false;
                void loadDay();
              }}
              style={styles.retry}
              accessibilityRole="button"
              accessibilityLabel="다시 시도"
            >
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : phase === 'day-intro' && dayDescription ? (
          <View style={styles.dayIntroCard}>
            <Text style={styles.dayIntroLabel}>Day {dayNumber}</Text>
            <Text style={styles.dayIntroTitle}>{route.params?.unitTitle}</Text>
            <Text style={styles.dayIntroDescription}>{dayDescription}</Text>
            <Pressable
              onPress={handleDayIntroDismiss}
              accessibilityRole="button"
              accessibilityLabel="학습 시작"
              style={({ pressed }) => [
                styles.nextButton,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: pressed ? 0.85 : 1,
                  marginTop: theme.spacing.lg,
                  alignSelf: 'stretch',
                },
              ]}
            >
              <Text style={styles.nextButtonText}>시작하기 →</Text>
            </Pressable>
          </View>
        ) : phase === 'intro' && currentIntro ? (
          <>
            <View style={styles.introCard}>
              <Text style={styles.introLabel}>핵심 패턴</Text>
              <Text style={styles.introEn}>{currentIntro.en}</Text>
              <Text style={styles.introKo}>{currentIntro.ko}</Text>
            </View>
            <AudioControls onPlay={handleIntroPlay} playCount={playCount} />
            <View style={styles.navRow}>
              <Pressable
                onPress={handleIntroPrev}
                disabled={introIndex <= 0}
                accessibilityRole="button"
                accessibilityLabel="이전 패턴"
                style={({ pressed }) => [
                  styles.prevButton,
                  { opacity: introIndex <= 0 ? 0.4 : pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.prevButtonText}>← 이전</Text>
              </Pressable>
              <Pressable
                onPress={handleIntroNext}
                accessibilityRole="button"
                accessibilityLabel={
                  introIndex < introPhrases.length - 1 ? '다음 패턴' : '학습 시작'
                }
                style={({ pressed }) => [
                  styles.nextButton,
                  {
                    backgroundColor: theme.colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={styles.nextButtonText}>
                  {introIndex < introPhrases.length - 1 ? '다음 →' : '학습 시작 →'}
                </Text>
              </Pressable>
            </View>
          </>
        ) : allDone ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>이 단원을 모두 학습했어요! 🎉</Text>
            {nextDay ? (
              <Pressable
                onPress={() =>
                  navigation.replace('TrackASession', {
                    unitId: nextDay.unitIds[0] ?? nextDay.unitId,
                    unitIds: nextDay.unitIds,
                    unitTitle: nextDay.titleKo,
                    dayNumber: nextDay.dayNumber,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Day ${nextDay.dayNumber} ${nextDay.titleKo} 시작`}
                style={styles.retry}
              >
                <Text style={styles.retryText}>다음 학습: Day {nextDay.dayNumber} →</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                if (dayNumber) clearDayProgress(dayNumber);
                navigation.replace('TrackASession', {
                  unitId: unitIds?.[0] ?? unitId ?? '',
                  unitIds,
                  unitTitle: route.params?.unitTitle ?? '',
                  dayNumber,
                });
              }}
              accessibilityRole="button"
              accessibilityLabel="처음부터 복습하기"
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>복습하기 🔄</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="홈으로 돌아가기"
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>홈으로</Text>
            </Pressable>
          </View>
        ) : sentence ? (
          <>
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
            <View style={styles.navRow}>
              <Pressable
                onPress={handlePrev}
                disabled={!canGoBack}
                accessibilityRole="button"
                accessibilityLabel="이전 문장"
                style={({ pressed }) => [
                  styles.prevButton,
                  { opacity: !canGoBack ? 0.4 : pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.prevButtonText}>← 이전</Text>
              </Pressable>
              <Pressable
                onPress={handleNext}
                accessibilityRole="button"
                accessibilityLabel="다음 문장"
                style={({ pressed }) => [
                  styles.nextButton,
                  {
                    backgroundColor: theme.colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={styles.nextButtonText}>다음 →</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>아직 학습할 문장이 없어요.</Text>
            <Text style={styles.emptyDetail}>콘텐츠가 충분히 쌓인 뒤 다시 와주세요.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    scroll: { padding: theme.spacing.lg, gap: theme.spacing.lg },
    scrollFlex: { flex: 1 },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    errorTitle: { ...theme.typography.button, color: theme.colors.text },
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
    retryText: { ...theme.typography.button, color: theme.colors.primaryOn },
    navRow: { flexDirection: 'row', gap: theme.spacing.sm },
    prevButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    prevButtonText: { ...theme.typography.button, color: theme.colors.text },
    nextButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
    },
    nextButtonText: { ...theme.typography.button, color: theme.colors.primaryOn },
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
    secondaryButton: {
      marginTop: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    secondaryButtonText: { ...theme.typography.button, color: theme.colors.text },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.bg,
    },
    progressTrack: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.border,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: theme.colors.primary,
    },
    progressLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      minWidth: 48,
      textAlign: 'right',
    },
    introCard: {
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    introLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    introEn: {
      ...theme.typography.sentence,
      color: theme.colors.text,
      fontSize: 24,
      textAlign: 'center',
    },
    introKo: {
      ...theme.typography.body,
      color: theme.colors.textSubtle,
      textAlign: 'center',
    },
    dayIntroCard: {
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xl,
    },
    dayIntroLabel: {
      ...theme.typography.caption,
      color: theme.colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      fontWeight: '700',
    },
    dayIntroTitle: {
      ...theme.typography.heading,
      color: theme.colors.text,
      fontSize: 20,
      textAlign: 'center',
    },
    dayIntroDescription: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 22,
      textAlign: 'center',
      marginTop: theme.spacing.md,
    },
  });
}
