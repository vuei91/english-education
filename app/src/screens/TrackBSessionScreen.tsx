import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { audioPlayer } from '../services/audio/audioPlayer';
import { getContentDatabase } from '../db';
import { getSupabaseClient } from '../lib/supabase';
import {
  ContentService,
  type Chunk,
  type Sentence,
  type StructureSummary,
} from '../services/content';
import { useSessionStore, useProgressStore } from '../stores';
import { useTheme, type Theme } from '../theme';
import type { PlaybackSpeed, TrackBStep } from '../types/domain';
import ChunkingView from './trackB/ChunkingView';
import ReadingQuizView from './trackB/ReadingQuizView';
import ShadowingPlayer from './trackB/ShadowingPlayer';
import StructureSummaryView from './trackB/StructureSummaryView';

/**
 * Track B session — curriculum-based 4-step flow per passage:
 *   listen → chunking → summary → quiz
 *
 * Receives `passageIds` (3 per day) from TrackBDayListScreen.
 * Each passage goes through the 4-step flow, then advances to the next.
 * Non-Goal reminder: no recording, no pronunciation scoring.
 */

const STEP_LABELS: Record<TrackBStep, string> = {
  listen: '듣기',
  chunking: '청킹',
  summary: '구조 요약',
  quiz: '독해 퀴즈',
  shadowing: '섀도잉',
};

const STEP_ORDER: TrackBStep[] = ['listen', 'chunking', 'summary', 'quiz'];

export default function TrackBSessionScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TrackBSession'>>();
  const { passageIds, dayNumber } = route.params;

  const startSession = useSessionStore((s) => s.startSession);
  const endSession = useSessionStore((s) => s.endSession);
  const setStep = useSessionStore((s) => s.setStep);
  const setChunkIndex = useSessionStore((s) => s.setChunkIndex);
  const currentStep = useSessionStore((s) => s.currentStep) ?? 'listen';
  const currentChunkIndex = useSessionStore((s) => s.currentChunkIndex);
  const completeSentence = useProgressStore((s) => s.completeSentence);
  const completeReadingPassage = useProgressStore((s) => s.completeReadingPassage);

  const [sentence, setSentence] = useState<Sentence | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [summary, setSummary] = useState<StructureSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [chunkPauseEnabled, setChunkPauseEnabled] = useState(false);
  const [cachedQuestion, setCachedQuestion] = useState<{
    type: string;
    questionKo: string;
  } | null>(null);

  /** Current passage index within the day (0, 1, 2). */
  const [passageIndex, setPassageIndex] = useState(0);

  const serviceRef = useRef<ContentService | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const getService = useCallback(async () => {
    if (serviceRef.current) return serviceRef.current;
    const db = await getContentDatabase();
    serviceRef.current = new ContentService(db, getSupabaseClient());
    return serviceRef.current;
  }, []);

  const loadPassage = useCallback(
    async (index: number) => {
      setLoading(true);
      setError(null);
      try {
        const sentenceId = passageIds[index];
        if (!sentenceId) {
          // All passages done — go back to day list
          navigation.goBack();
          return;
        }
        const svc = await getService();
        const next = await svc.getSentenceById(sentenceId);
        setSentence(next);
        if (!next) {
          setChunks([]);
          setSummary(null);
          setCachedQuestion(null);
          return;
        }
        startSession('B', next.id);
        setStep('listen');
        setChunkIndex(0);
        setCachedQuestion(null);

        const [loadedChunks, loadedSummary] = await Promise.all([
          svc.getChunks(next.id),
          svc.getSentenceSummary(next.id),
        ]);
        setChunks(
          loadedChunks.length > 0
            ? loadedChunks
            : [
                {
                  id: `${next.id}:whole`,
                  sentenceId: next.id,
                  orderIndex: 0,
                  text: next.textEn,
                  depth: 0,
                  role: null,
                },
              ],
        );
        setSummary(loadedSummary);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [getService, passageIds, navigation, setChunkIndex, setStep, startSession],
  );

  useEffect(() => {
    void loadPassage(0);
    return () => {
      void audioPlayer.stop();
      endSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playChunk = useCallback(
    async (chunk: Chunk) => {
      setChunkIndex(chunks.findIndex((c) => c.id === chunk.id));
      await audioPlayer.speak(chunk.text, {
        kind: 'chunk',
        sentenceId: chunk.id,
        rate: speed,
      });
    },
    [chunks, setChunkIndex, speed],
  );

  const playFull = useCallback(async () => {
    if (!sentence) return;
    await audioPlayer.speak(sentence.textEn, {
      sentenceId: sentence.id,
      rate: speed,
    });
  }, [sentence, speed]);

  const repeatChunk = useCallback(async () => {
    const chunk = chunks[currentChunkIndex];
    if (!chunk) return;
    await audioPlayer.speak(chunk.text, {
      kind: 'chunk',
      sentenceId: chunk.id,
      rate: speed,
    });
    if (chunkPauseEnabled) {
      await new Promise((r) => setTimeout(r, 1500));
      await audioPlayer.speak(chunk.text, {
        kind: 'chunk',
        sentenceId: chunk.id,
        rate: speed,
      });
    }
  }, [chunks, chunkPauseEnabled, currentChunkIndex, speed]);

  const goToNextStep = useCallback(() => {
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx < STEP_ORDER.length - 1) {
      const next = STEP_ORDER[idx + 1];
      if (next) setStep(next);
    } else {
      // Last step of this passage → mark complete, advance to next passage
      completeSentence();
      const currentPassageId = passageIds[passageIndex];
      if (currentPassageId) {
        completeReadingPassage(currentPassageId);
      }
      const nextIndex = passageIndex + 1;
      if (nextIndex < passageIds.length) {
        setPassageIndex(nextIndex);
        void loadPassage(nextIndex);
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      } else {
        // All 3 passages done
        navigation.goBack();
      }
    }
  }, [
    completeSentence,
    completeReadingPassage,
    currentStep,
    loadPassage,
    navigation,
    passageIds,
    passageIndex,
    setStep,
  ]);

  const goToPrevStep = useCallback(() => {
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx > 0) {
      const prev = STEP_ORDER[idx - 1];
      if (prev) setStep(prev);
    }
  }, [currentStep, setStep]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {/* Passage progress indicator */}
        <View style={styles.passageProgress}>
          <Text style={styles.passageProgressText}>
            지문 {passageIndex + 1} / {passageIds.length}
          </Text>
          <View style={styles.passageDots}>
            {passageIds.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.passageDot,
                  {
                    backgroundColor:
                      i < passageIndex
                        ? theme.colors.success
                        : i === passageIndex
                          ? theme.colors.primary
                          : theme.colors.border,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>지문을 불러오지 못했어요.</Text>
            <Text style={styles.errorDetail}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="다시 시도"
              onPress={() => void loadPassage(passageIndex)}
              style={styles.retry}
            >
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : !sentence ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>지문을 찾을 수 없어요.</Text>
            <Text style={styles.emptyDetail}>콘텐츠가 준비되면 다시 시도해 주세요.</Text>
          </View>
        ) : (
          <>
            <StepIndicator
              steps={STEP_ORDER}
              active={currentStep}
              theme={theme}
              onSelect={(step) => setStep(step)}
            />

            {currentStep === 'chunking' ? (
              <ChunkingView
                chunks={chunks}
                onChunkTap={(c) => void playChunk(c)}
                activeChunkIndex={currentChunkIndex}
              />
            ) : null}

            {currentStep === 'listen' ? (
              <View style={styles.listenBox}>
                <Text style={styles.listenText}>{sentence.textEn}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="전체 문장 듣기"
                  onPress={() => void playFull()}
                  style={({ pressed }) => [
                    styles.listenButton,
                    {
                      backgroundColor: theme.colors.primary,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.listenButtonLabel, { color: theme.colors.primaryOn }]}>
                    🔊 전체 듣기
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {currentStep === 'shadowing' ? (
              <ShadowingPlayer
                speed={speed}
                chunkPauseEnabled={chunkPauseEnabled}
                onChangeSpeed={setSpeed}
                onToggleChunkPause={setChunkPauseEnabled}
                onPlayFull={() => void playFull()}
                onRepeatChunk={() => void repeatChunk()}
              />
            ) : null}

            {currentStep === 'summary' ? <StructureSummaryView summary={summary} /> : null}

            {currentStep === 'quiz' && sentence ? (
              <ReadingQuizView
                sentenceEn={sentence.textEn}
                sentenceKo={sentence.textKo}
                question={cachedQuestion ?? undefined}
                onPrev={goToPrevStep}
                onComplete={goToNextStep}
                onQuestionGenerated={setCachedQuestion}
              />
            ) : null}
          </>
        )}
      </ScrollView>

      {/* 하단 고정 네비게이션 버튼 (quiz 단계에서는 ReadingQuizView 내부 버튼 사용) */}
      {!loading && !error && sentence && currentStep !== 'quiz' ? (
        <View style={styles.bottomNav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이전 단계"
            disabled={STEP_ORDER.indexOf(currentStep) === 0}
            onPress={goToPrevStep}
            style={({ pressed }) => [
              styles.navButton,
              {
                borderColor: theme.colors.border,
                opacity: STEP_ORDER.indexOf(currentStep) === 0 ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.navLabel, { color: theme.colors.text }]}>← 이전</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              STEP_ORDER.indexOf(currentStep) === STEP_ORDER.length - 1
                ? '지문 마치기'
                : '다음 단계'
            }
            onPress={goToNextStep}
            style={({ pressed }) => [
              styles.navPrimary,
              {
                backgroundColor: theme.colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.navLabel, { color: theme.colors.primaryOn }]}>
              {STEP_ORDER.indexOf(currentStep) === STEP_ORDER.length - 1 ? '완료' : '다음 →'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function StepIndicator({
  steps,
  active,
  theme,
  onSelect,
}: {
  steps: readonly TrackBStep[];
  active: TrackBStep;
  theme: Theme;
  onSelect: (step: TrackBStep) => void;
}) {
  const styles = makeStyles(theme);
  return (
    <View style={styles.stepperRow}>
      {steps.map((step, idx) => {
        const activeIdx = steps.indexOf(active);
        const state = idx < activeIdx ? 'done' : idx === activeIdx ? 'active' : 'upcoming';
        return (
          <Pressable
            key={step}
            onPress={() => onSelect(step)}
            accessibilityRole="tab"
            accessibilityState={{ selected: state === 'active' }}
            accessibilityLabel={STEP_LABELS[step]}
            style={styles.stepItem}
          >
            <View
              style={[
                styles.stepDot,
                {
                  backgroundColor:
                    state === 'active'
                      ? theme.colors.primary
                      : state === 'done'
                        ? theme.colors.success
                        : theme.colors.border,
                },
              ]}
            />
            <Text
              style={[
                styles.stepText,
                {
                  color: state === 'active' ? theme.colors.primary : theme.colors.textMuted,
                  fontWeight: state === 'active' ? '700' : '500',
                },
              ]}
            >
              {STEP_LABELS[step]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    scroll: { padding: theme.spacing.lg, gap: theme.spacing.lg },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    passageProgress: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    passageProgressText: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    passageDots: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    passageDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    errorTitle: { ...theme.typography.body, color: theme.colors.text, fontWeight: '500' },
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
    emptyTitle: {
      ...theme.typography.body,
      color: theme.colors.text,
      textAlign: 'center',
      fontWeight: '500',
    },
    emptyDetail: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      textAlign: 'center',
    },
    stepperRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    stepItem: { flex: 1, alignItems: 'center', gap: 4 },
    stepDot: { width: 10, height: 10, borderRadius: 5 },
    stepText: { ...theme.typography.caption },
    listenBox: { gap: theme.spacing.md },
    listenText: { ...theme.typography.sentence, color: theme.colors.text },
    listenButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
    },
    listenButtonLabel: { ...theme.typography.button },
    navButton: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      borderRadius: theme.radius.md,
      borderWidth: 1,
    },
    navPrimary: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      borderRadius: theme.radius.md,
    },
    navLabel: { ...theme.typography.button },
    bottomNav: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.bg,
    },
  });
}
