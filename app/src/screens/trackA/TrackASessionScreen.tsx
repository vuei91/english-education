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

import type { RootStackParamList } from '../../navigation/types';
import { audioPlayer } from '../../services/audio/audioPlayer';
import { ContentService, type Sentence } from '../../services/content';
import { getSupabaseClient } from '../../lib/supabase';
import { getContentDatabase } from '../../db';
import { useSessionStore, useUserStore, useVocabStore, useProgressStore } from '../../stores';
import { useTheme, type Theme } from '../../theme';
import type { SentenceFeedback } from '../../types/domain';
import AudioControls from './AudioControls';
import FeedbackBar from './FeedbackBar';
import SentenceCard from './SentenceCard';

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
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

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
  /**
   * Sentences shown in this session. Used by the RPC to avoid serving the
   * same card twice before the user has seen the rest of the pool. The
   * list resets whenever the screen mounts (endSession cleanup).
   */
  const shownIdsRef = useRef<string[]>([]);

  // Keep the service instance stable across renders; re-creating the
  // Supabase-backed service on every render would thrash the cache.
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
    setPlayCount(0);
    try {
      const svc = await getService();
      // Hot words: most recent unique taps from the last 30 days, capped.
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const hotWords = Array.from(
        new Set(
          recentTaps
            .filter((t) => t.tappedAt >= cutoff)
            .map((t) => t.word),
        ),
      ).slice(0, 20);
      const next = await svc.getNextSentence('A', cefrLevel, {
        hotWords,
        excludeIds: shownIdsRef.current,
      });
      setSentence(next);
      if (next) {
        shownIdsRef.current = [...shownIdsRef.current, next.id].slice(-50);
        startSession('A', next.id);
        // Req 1.3: one automatic playback when the sentence first appears.
        await audioPlayer.speak(next.textEn);
        setPlayCount(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [cefrLevel, getService, recentTaps, startSession]);

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
    await audioPlayer.speak(sentence.textEn);
    setPlayCount((n) => n + 1);
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
            <SentenceCard
              textEn={sentence.textEn}
              textKo={sentence.textKo}
              onWordPress={handleWordPress}
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
            <Text style={styles.emptyTitle}>아직 내 레벨에 맞는 문장이 없어요.</Text>
            <Text style={styles.emptyDetail}>
              내 탭에서 레벨을 조정하거나, 콘텐츠가 충분히 쌓인 뒤 다시 와주세요.
            </Text>
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
  });
}
