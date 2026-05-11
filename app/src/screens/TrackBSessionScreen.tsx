import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { useSessionStore, useUserStore, useProgressStore } from '../stores';
import { useTheme, type Theme } from '../theme';
import type { PlaybackSpeed, TrackBStep } from '../types/domain';
import ChunkingView from './trackB/ChunkingView';
import ShadowingPlayer from './trackB/ShadowingPlayer';
import StructureSummaryView from './trackB/StructureSummaryView';

/**
 * Track B session — 4-step flow per Req 3.2:
 *   chunking → listen → shadowing → summary
 *
 * Each step has a skip button (Req 3.3). We never force progression.
 * Non-Goal reminder (Req 5.5): no recording, no pronunciation scoring.
 */

const STEP_LABELS: Record<TrackBStep, string> = {
  chunking: '청킹',
  listen: '듣기',
  shadowing: '섀도잉',
  summary: '구조 요약',
};

const STEP_ORDER: TrackBStep[] = ['chunking', 'listen', 'shadowing', 'summary'];

export default function TrackBSessionScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const cefrLevel = useUserStore((s) => s.cefrLevel);
  const startSession = useSessionStore((s) => s.startSession);
  const endSession = useSessionStore((s) => s.endSession);
  const setStep = useSessionStore((s) => s.setStep);
  const setChunkIndex = useSessionStore((s) => s.setChunkIndex);
  const currentStep = useSessionStore((s) => s.currentStep) ?? 'chunking';
  const currentChunkIndex = useSessionStore((s) => s.currentChunkIndex);
  const recentTaps = useVocabStore((s) => s.recentTaps);
  const completeSentence = useProgressStore((s) => s.completeSentence);

  const [sentence, setSentence] = useState<Sentence | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [summary, setSummary] = useState<StructureSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [chunkPauseEnabled, setChunkPauseEnabled] = useState(false);

  const shownIdsRef = useRef<string[]>([]);
  const serviceRef = useRef<ContentService | null>(null);

  const getService = useCallback(async () => {
    if (serviceRef.current) return serviceRef.current;
    const db = await getContentDatabase();
    serviceRef.current = new ContentService(db, getSupabaseClient());
    return serviceRef.current;
  }, []);

  const loadNext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const svc = await getService();
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const hotWords = Array.from(
        new Set(recentTaps.filter((t) => t.tappedAt >= cutoff).map((t) => t.word)),
      ).slice(0, 20);
      const next = await svc.getNextSentence('B', cefrLevel, {
        hotWords,
        excludeIds: shownIdsRef.current,
      });
      setSentence(next);
      if (!next) {
        setChunks([]);
        setSummary(null);
        return;
      }
      shownIdsRef.current = [...shownIdsRef.current, next.id].slice(-50);
      startSession('B', next.id);
      setStep('chunking');
      setChunkIndex(0);

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
  }, [cefrLevel, getService, recentTaps, setChunkIndex, setStep, startSession]);

  useEffect(() => {
    void loadNext();
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
      // Last step → Finish. Count this sentence as completed (Req 13.3).
      completeSentence();
      void loadNext();
    }
  }, [completeSentence, currentStep, loadNext, setStep]);

  const goToPrevStep = useCallback(() => {
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx > 0) {
      const prev = STEP_ORDER[idx - 1];
      if (prev) setStep(prev);
    }
  }, [currentStep, setStep]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
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
              onPress={() => {
                void loadNext();
              }}
              style={styles.retry}
            >
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : !sentence ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>아직 긴 지문이 없어요.</Text>
            <Text style={styles.emptyDetail}>
              콘텐츠가 충분히 쌓인 뒤 다시 와주세요.
            </Text>
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
                  <Text
                    style={[
                      styles.listenButtonLabel,
                      { color: theme.colors.primaryOn },
                    ]}
                  >
                    🔊  전체 듣기
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

            {currentStep === 'summary' ? (
              <StructureSummaryView summary={summary} />
            ) : null}

            <View style={styles.navRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="이전 단계"
                disabled={STEP_ORDER.indexOf(currentStep) === 0}
                onPress={goToPrevStep}
                style={({ pressed }) => [
                  styles.navButton,
                  {
                    borderColor: theme.colors.border,
                    opacity:
                      STEP_ORDER.indexOf(currentStep) === 0
                        ? 0.4
                        : pressed
                          ? 0.85
                          : 1,
                  },
                ]}
              >
                <Text style={[styles.navLabel, { color: theme.colors.text }]}>
                  ← 이전
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  STEP_ORDER.indexOf(currentStep) === STEP_ORDER.length - 1
                    ? '문장 마치기'
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
                  {STEP_ORDER.indexOf(currentStep) === STEP_ORDER.length - 1
                    ? '완료'
                    : '다음 →'}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
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
        const state =
          idx < activeIdx ? 'done' : idx === activeIdx ? 'active' : 'upcoming';
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
                  color:
                    state === 'active' ? theme.colors.primary : theme.colors.textMuted,
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
    navRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
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
  });
}
