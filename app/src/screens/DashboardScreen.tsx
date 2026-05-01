import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import type { CurriculumDay } from '../types/domain';
import { TOTAL_DAYS } from '../types/domain';
import { CurriculumService } from '../services/curriculum/CurriculumService';
import { getSupabaseClient } from '../lib/supabase';
import { getContentDatabase } from '../db';
import { useHydrateProgressStore, useProgressStore } from '../stores';
import { useTheme, type Theme } from '../theme';

/**
 * Dashboard — Req 13.6.
 *
 * Shows today's progress against Daily_Goal, the current and best streak,
 * and lifetime completed sentences. Two start CTAs route straight into
 * Track A or Track B. The user's preferred track gets the primary slot.
 *
 * We intentionally avoid showing loss-framed UI: no warnings about
 * breaking the streak, no heart-punishment prompts. Daily_Goal reached
 * messages appear only as a positive confirmation.
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

  /** Load the current Day from the 100-day curriculum. */
  const loadCurrentDay = useCallback(async () => {
    try {
      if (!serviceRef.current) {
        const db = await getContentDatabase();
        serviceRef.current = new CurriculumService(db, getSupabaseClient());
      }
      const day = await serviceRef.current.getCurrentDay(completedUnitIds);
      setCurrentDay(day);

      const allDays = await serviceRef.current.listDays();
      const count = allDays.filter((d) => completedUnitIds.has(d.unitId)).length;
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>오늘의 목표</Text>
        <Text style={styles.goalLine}>
          {sentencesCompletedToday} / {dailyGoal} 문장
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
          <Text style={styles.remaining}>목표까지 {remaining}문장 남았어요.</Text>
        )}
      </View>

      <View style={styles.statsRow}>
        <StatCard label="스트릭" value={`${currentStreak}일`} theme={theme} />
        <StatCard label="최고" value={`${bestStreak}일`} theme={theme} />
        <StatCard label="누적" value={`${totalSentencesCompleted}`} theme={theme} />
      </View>

      {/* 100일 챌린지 진행률 */}
      <View style={styles.challengeCard}>
        <Text style={styles.challengeTitle}>📅 100일 챌린지</Text>
        <Text style={styles.challengeProgress}>
          Day {completedDays > 0 ? completedDays : 0} / {TOTAL_DAYS}
        </Text>
        <View
          style={styles.progressTrack}
          accessibilityRole="progressbar"
          accessibilityLabel={`100일 중 ${completedDays}일 완료`}
        >
          <View
            style={[styles.progressFill, { width: `${(completedDays / TOTAL_DAYS) * 100}%` }]}
          />
        </View>
      </View>

      <View style={styles.ctaSection}>
        <Text style={styles.sectionLabel}>학습 시작</Text>
        {currentDay ? (
          <Pressable
            onPress={() =>
              navigation.navigate('TrackASession', {
                unitId: currentDay.unitId,
                unitTitle: currentDay.titleKo,
                dayNumber: currentDay.dayNumber,
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`Day ${currentDay.dayNumber} ${currentDay.titleKo} 시작`}
            style={({ pressed }) => [styles.ctaPrimary, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.ctaPrimaryText}>
              Day {currentDay.dayNumber}. {currentDay.titleKo}
            </Text>
            <Text style={styles.ctaPrimarySub}>
              {currentDay.isReview ? '복습' : currentDay.cefrLevel} · 오늘의 학습
            </Text>
          </Pressable>
        ) : completedDays >= TOTAL_DAYS ? (
          <View style={styles.ctaPrimary}>
            <Text style={styles.ctaPrimaryText}>🎉 100일 완주!</Text>
            <Text style={styles.ctaPrimarySub}>축하합니다! 모든 학습을 완료했어요.</Text>
          </View>
        ) : null}
        <Pressable
          onPress={() => navigation.navigate('DayList', {})}
          accessibilityRole="button"
          accessibilityLabel="100일 커리큘럼 전체 보기"
          style={({ pressed }) => [styles.ctaSecondary, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.ctaSecondaryText}>100일 커리큘럼 전체 보기</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

type StatCardProps = { label: string; value: string; theme: Theme };

function StatCard({ label, value, theme }: StatCardProps) {
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
    header: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.md,
      gap: theme.spacing.sm,
    },
    greeting: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    goalLine: {
      ...theme.typography.heading,
      color: theme.colors.text,
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
    remaining: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
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
      ...theme.typography.heading,
      color: theme.colors.text,
    },
    statLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    challengeCard: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.md,
      gap: theme.spacing.sm,
    },
    challengeTitle: {
      ...theme.typography.button,
      color: theme.colors.text,
    },
    challengeProgress: {
      ...theme.typography.heading,
      color: theme.colors.primary,
    },
    ctaSection: {
      gap: theme.spacing.md,
    },
    sectionLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    ctaPrimary: {
      backgroundColor: theme.colors.primary,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.md,
      gap: 4,
    },
    ctaPrimaryText: {
      ...theme.typography.heading,
      color: theme.colors.primaryOn,
    },
    ctaPrimarySub: {
      ...theme.typography.caption,
      color: theme.colors.primaryOn,
      opacity: 0.85,
    },
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
