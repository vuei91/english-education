import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import type { CurriculumDay } from '../types/domain';
import { CHAPTERS, TOTAL_DAYS } from '../types/domain';
import { CurriculumService } from '../services/curriculum/CurriculumService';
import { getSupabaseClient } from '../lib/supabase';
import { getContentDatabase } from '../db';
import { useHydrateProgressStore, useProgressStore } from '../stores';
import { useTheme, type Theme } from '../theme';

/**
 * Dashboard — 홈 화면.
 *
 * 사용자가 앱을 열면 가장 먼저 보는 화면.
 * 오늘 학습할 Day, 진행 상황, 학습 시작 버튼을 보여준다.
 * 긍정적 톤만 사용하고, 패널티·경고 UI는 없다.
 */
export default function DashboardScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const hydrated = useHydrateProgressStore();
  const reconcile = useProgressStore((s) => s.reconcileForToday);
  const dailyGoal = useProgressStore((s) => s.dailyGoal);
  const sentencesCompletedToday = useProgressStore((s) => s.sentencesCompletedToday);
  const totalSentencesCompleted = useProgressStore((s) => s.totalSentencesCompleted);
  const currentStreak = useProgressStore((s) => s.currentStreak);
  const bestStreak = useProgressStore((s) => s.bestStreak);
  const goalHitToday = useProgressStore((s) => s.goalHitToday);
  const completedUnitIds = useProgressStore((s) => s.completedUnitIds);

  const [currentDay, setCurrentDay] = useState<CurriculumDay | null>(null);
  const [completedDays, setCompletedDays] = useState(0);
  const serviceRef = useRef<CurriculumService | null>(null);

  useEffect(() => {
    if (hydrated) reconcile();
  }, [hydrated, reconcile]);

  /** Load the current Day from the 30-day curriculum. */
  const loadCurrentDay = useCallback(async () => {
    try {
      if (!serviceRef.current) {
        const db = await getContentDatabase();
        serviceRef.current = new CurriculumService(db, getSupabaseClient());
      }
      const day = await serviceRef.current.getCurrentDay(completedUnitIds);
      setCurrentDay(day);

      const allDays = await serviceRef.current.listDays();
      const count = allDays.filter((d) => d.unitIds.every((id) => completedUnitIds.has(id))).length;
      setCompletedDays(count);
    } catch {
      // Silently fail — dashboard still shows other stats.
    }
  }, [completedUnitIds]);

  useEffect(() => {
    if (hydrated) void loadCurrentDay();
  }, [hydrated, loadCurrentDay]);

  if (!hydrated) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>진도를 불러오는 중…</Text>
      </View>
    );
  }

  const progressRatio = Math.min(1, sentencesCompletedToday / Math.max(1, dailyGoal));
  const remaining = Math.max(0, dailyGoal - sentencesCompletedToday);
  const allDone = completedDays >= TOTAL_DAYS;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* ── 오늘의 학습 CTA ── */}
      {currentDay ? (
        <Pressable
          onPress={() =>
            navigation.navigate('TrackASession', {
              unitId: currentDay.unitIds[0] ?? currentDay.unitId,
              unitIds: currentDay.unitIds,
              unitTitle: currentDay.titleKo,
              dayNumber: currentDay.dayNumber,
            })
          }
          accessibilityRole="button"
          accessibilityLabel={`Day ${currentDay.dayNumber} ${currentDay.titleKo} 시작`}
          style={({ pressed }) => [styles.heroCta, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.heroLabel}>현재 진행중인 학습</Text>
          <Text style={styles.heroTitle}>
            Day {currentDay.dayNumber}. {currentDay.titleKo}
          </Text>
          <Text style={styles.heroSub}>
            {CHAPTERS.find((ch) => ch.number === currentDay.chapter)?.titleKo ?? ''} ·{' '}
            {currentDay.unitIds.length}개 단원
          </Text>
          <View style={styles.heroButtonRow}>
            <Text style={styles.heroButtonText}>학습 시작 →</Text>
          </View>
        </Pressable>
      ) : allDone ? (
        <View style={styles.heroCta}>
          <Text style={styles.heroTitle}>🎉 60일 완주!</Text>
          <Text style={styles.heroSub}>축하합니다! 모든 학습을 완료했어요.</Text>
        </View>
      ) : null}

      {/* ── 오늘 진도 ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>오늘 진도</Text>
        <Text style={styles.cardDesc}>
          하루 목표 {dailyGoal}문장 중 {sentencesCompletedToday}문장 완료
        </Text>
        <View
          style={styles.progressTrack}
          accessibilityRole="progressbar"
          accessibilityLabel={`오늘 진도 ${sentencesCompletedToday} / ${dailyGoal}`}
        >
          <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
        </View>
        {goalHitToday ? (
          <Text style={styles.goalHit}>오늘 목표 달성 ✨</Text>
        ) : (
          <Text style={styles.cardMuted}>{remaining}문장 더 하면 목표 달성!</Text>
        )}
      </View>

      {/* ── 학습 통계 ── */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>🔥 {currentStreak}일</Text>
          <Text style={styles.statLabel}>연속 학습</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>🏆 {bestStreak}일</Text>
          <Text style={styles.statLabel}>최고 기록</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>📝 {totalSentencesCompleted}</Text>
          <Text style={styles.statLabel}>누적 문장</Text>
        </View>
      </View>

      {/* ── 60일 챌린지 진행률 ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📅 60일 챌린지</Text>
        <Text style={styles.cardDesc}>
          {allDone
            ? '모든 Day를 완료했어요!'
            : currentDay
              ? `현재 Day ${currentDay.dayNumber} 진행 중`
              : '커리큘럼을 불러오는 중…'}
        </Text>
        <Text style={styles.challengeProgress}>
          {completedDays} / {TOTAL_DAYS}일 완료
        </Text>
        <View
          style={styles.progressTrack}
          accessibilityRole="progressbar"
          accessibilityLabel={`60일 중 ${completedDays}일 완료`}
        >
          <View
            style={[styles.progressFill, { width: `${(completedDays / TOTAL_DAYS) * 100}%` }]}
          />
        </View>
      </View>

      {/* ── 전체 커리큘럼 보기 ── */}
      <Pressable
        onPress={() => navigation.navigate('DayList', {})}
        accessibilityRole="button"
        accessibilityLabel="60일 커리큘럼 전체 보기"
        style={({ pressed }) => [styles.ctaSecondary, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.ctaSecondaryText}>60일 커리큘럼 전체 보기</Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      padding: theme.spacing.lg,
      gap: theme.spacing.lg,
    },
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    /* ── Hero CTA (오늘의 학습) ── */
    heroCta: {
      backgroundColor: theme.colors.primary,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.md,
      gap: theme.spacing.sm,
    },
    heroLabel: {
      ...theme.typography.caption,
      color: theme.colors.primaryOn,
      opacity: 0.8,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    heroTitle: {
      ...theme.typography.headingLg,
      color: theme.colors.primaryOn,
    },
    heroSub: {
      ...theme.typography.caption,
      color: theme.colors.primaryOn,
      opacity: 0.85,
    },
    heroButtonRow: {
      marginTop: theme.spacing.sm,
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.sm,
    },
    heroButtonText: {
      ...theme.typography.button,
      color: theme.colors.primaryOn,
    },
    /* ── 공통 카드 ── */
    card: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.md,
      gap: theme.spacing.sm,
    },
    cardTitle: {
      ...theme.typography.button,
      color: theme.colors.text,
    },
    cardDesc: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    cardMuted: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    progressTrack: {
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.border,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
    },
    goalHit: {
      ...theme.typography.body,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    challengeProgress: {
      ...theme.typography.headingLg,
      color: theme.colors.primary,
    },
    /* ── 통계 카드 ── */
    statsRow: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    statCard: {
      flex: 1,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      gap: 4,
    },
    statValue: {
      ...theme.typography.headingLg,
      color: theme.colors.text,
      fontSize: 16,
    },
    statLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    /* ── 하단 CTA ── */
    ctaSecondary: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      alignItems: 'center',
    },
    ctaSecondaryText: {
      ...theme.typography.body,
      color: theme.colors.text,
    },
  });
}
