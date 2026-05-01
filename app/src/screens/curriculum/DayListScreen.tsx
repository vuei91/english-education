import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../../navigation/types';
import type { CurriculumDay } from '../../types/domain';
import { CHAPTERS, TOTAL_DAYS } from '../../types/domain';
import { CurriculumService } from '../../services/curriculum/CurriculumService';
import { getSupabaseClient } from '../../lib/supabase';
import { getContentDatabase } from '../../db';
import { useProgressStore } from '../../stores';
import { useTheme, type Theme } from '../../theme';

type DaySection = {
  title: string;
  subtitle: string;
  data: CurriculumDay[];
};

/**
 * DayListScreen — 100일 커리큘럼 목록.
 *
 * 기존 LevelSelectScreen + UnitListScreen을 대체한다.
 * 3개 챕터를 SectionList로 표시하고, 각 Day를 탭하면
 * TrackASessionScreen으로 진입한다.
 */
export default function DayListScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'DayList'>>();
  const filterChapter = route.params?.chapter;

  const [days, setDays] = useState<CurriculumDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const completedUnitIds = useProgressStore((s) => s.completedUnitIds);

  const loadDays = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = await getContentDatabase();
      const svc = new CurriculumService(db, getSupabaseClient());
      const data = await svc.listDays(filterChapter);
      setDays(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [filterChapter]);

  useEffect(() => {
    void loadDays();
  }, [loadDays]);

  const sections: DaySection[] = useMemo(() => {
    const grouped = new Map<number, CurriculumDay[]>();
    for (const day of days) {
      const list = grouped.get(day.chapter) ?? [];
      list.push(day);
      grouped.set(day.chapter, list);
    }
    return CHAPTERS.filter((ch) => !filterChapter || ch.number === filterChapter).map((ch) => ({
      title: `Chapter ${ch.number}. ${ch.titleKo}`,
      subtitle: ch.subtitleKo,
      data: grouped.get(ch.number) ?? [],
    }));
  }, [days, filterChapter]);

  const completedCount = useMemo(() => {
    return days.filter((d) => completedUnitIds.has(d.unitId)).length;
  }, [days, completedUnitIds]);

  const renderDay = useCallback(
    ({ item }: { item: CurriculumDay }) => {
      const isCompleted = completedUnitIds.has(item.unitId);
      return (
        <Pressable
          onPress={() =>
            navigation.navigate('TrackASession', {
              unitId: item.unitId,
              unitTitle: item.titleKo,
              dayNumber: item.dayNumber,
            })
          }
          accessibilityRole="button"
          accessibilityLabel={`Day ${item.dayNumber} ${item.titleKo} ${isCompleted ? '완료' : ''}`}
          style={({ pressed }) => [
            styles.dayCard,
            isCompleted && styles.dayCardCompleted,
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={[styles.dayBadge, isCompleted && styles.dayBadgeCompleted]}>
            <Text style={[styles.dayBadgeText, isCompleted && styles.dayBadgeTextCompleted]}>
              {item.dayNumber}
            </Text>
          </View>
          <View style={styles.dayBody}>
            <Text style={styles.dayTitle}>{item.titleKo}</Text>
            <Text style={styles.dayMeta}>
              {item.cefrLevel}
              {item.isReview ? ' · 복습' : ''}
            </Text>
          </View>
          {isCompleted && <Text style={styles.checkMark}>✓</Text>}
        </Pressable>
      );
    },
    [navigation, styles, completedUnitIds],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: DaySection }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
      </View>
    ),
    [styles],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>커리큘럼을 불러오지 못했어요.</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <Pressable
          onPress={() => void loadDays()}
          style={styles.retry}
          accessibilityRole="button"
          accessibilityLabel="다시 시도"
        >
          <Text style={styles.retryText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressTitle}>100일 챌린지</Text>
        <Text style={styles.progressCount}>
          {completedCount} / {TOTAL_DAYS}일 완료
        </Text>
        <View
          style={styles.progressTrack}
          accessibilityRole="progressbar"
          accessibilityLabel={`100일 중 ${completedCount}일 완료`}
        >
          <View
            style={[styles.progressFill, { width: `${(completedCount / TOTAL_DAYS) * 100}%` }]}
          />
        </View>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderDay}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.xl,
      backgroundColor: theme.colors.bg,
      gap: theme.spacing.sm,
    },
    progressHeader: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    progressTitle: {
      ...theme.typography.heading,
      color: theme.colors.text,
    },
    progressCount: {
      ...theme.typography.body,
      color: theme.colors.textMuted,
    },
    progressTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.border,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
    },
    list: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
    },
    sectionHeader: {
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
      gap: 2,
    },
    sectionTitle: {
      ...theme.typography.button,
      color: theme.colors.text,
      fontSize: 16,
    },
    sectionSubtitle: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    dayCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      gap: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    dayCardCompleted: {
      opacity: 0.7,
    },
    dayBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayBadgeCompleted: {
      backgroundColor: theme.colors.border,
    },
    dayBadgeText: {
      ...theme.typography.caption,
      color: theme.colors.primaryOn,
      fontWeight: '700',
      fontSize: 13,
    },
    dayBadgeTextCompleted: {
      color: theme.colors.textMuted,
    },
    dayBody: { flex: 1, gap: 2 },
    dayTitle: {
      ...theme.typography.body,
      color: theme.colors.text,
    },
    dayMeta: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    checkMark: {
      ...theme.typography.heading,
      color: theme.colors.primary,
      fontSize: 18,
    },
    errorText: {
      ...theme.typography.button,
      color: theme.colors.text,
      textAlign: 'center',
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
  });
}
