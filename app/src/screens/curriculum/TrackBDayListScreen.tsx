import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../../navigation/types';
import type { ReadingDay } from '../../types/domain';
import { READING_CHAPTERS, READING_TOTAL_DAYS } from '../../types/domain';
import { ReadingCurriculumService } from '../../services/curriculum/ReadingCurriculumService';
import { getSupabaseClient } from '../../lib/supabase';
import { getContentDatabase } from '../../db';
import { useProgressStore } from '../../stores';
import { useTheme, type Theme } from '../../theme';

type DaySection = {
  title: string;
  subtitle: string;
  description: string;
  data: ReadingDay[];
};

/**
 * TrackBDayListScreen — 60일 독해 커리큘럼 목록.
 *
 * 3개 챕터를 SectionList로 표시하고, 각 Day를 탭하면
 * TrackBSession으로 진입한다. 1일 3지문.
 */
export default function TrackBDayListScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [days, setDays] = useState<ReadingDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const completedReadingPassageIds = useProgressStore((s) => s.completedReadingPassageIds);

  const loadDays = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = await getContentDatabase();
      const svc = new ReadingCurriculumService(db, getSupabaseClient());
      const data = await svc.listDays();
      setDays(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDays();
  }, [loadDays]);

  const sections: DaySection[] = useMemo(() => {
    const grouped = new Map<number, ReadingDay[]>();
    for (const day of days) {
      const list = grouped.get(day.chapter) ?? [];
      list.push(day);
      grouped.set(day.chapter, list);
    }
    return READING_CHAPTERS.map((ch) => ({
      title: `Chapter ${ch.number}. ${ch.titleKo}`,
      subtitle: ch.subtitleKo,
      description: ch.descriptionKo,
      data: grouped.get(ch.number) ?? [],
    }));
  }, [days]);

  const completedCount = useMemo(() => {
    return days.filter((d) => d.passageIds.every((id) => completedReadingPassageIds.has(id)))
      .length;
  }, [days, completedReadingPassageIds]);

  const renderDay = useCallback(
    ({ item }: { item: ReadingDay }) => {
      const completedPassages = item.passageIds.filter((id) =>
        completedReadingPassageIds.has(id),
      ).length;
      const isCompleted = completedPassages === item.passageIds.length;
      return (
        <Pressable
          onPress={() =>
            navigation.navigate('TrackBSession', {
              dayNumber: item.dayNumber,
              passageIds: item.passageIds,
              dayTitle: item.titleKo,
            })
          }
          accessibilityRole="button"
          accessibilityLabel={`Day ${item.dayNumber} ${item.titleKo} ${isCompleted ? '완료' : `${completedPassages}/${item.passageIds.length}`}`}
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
            {item.subtitleKo ? (
              <Text style={styles.dayDescription} numberOfLines={1}>
                {item.subtitleKo}
              </Text>
            ) : null}
            <Text style={styles.dayMeta}>
              {completedPassages}/{item.passageIds.length} 지문
            </Text>
          </View>
          {isCompleted && <Text style={styles.checkMark}>✓</Text>}
        </Pressable>
      );
    },
    [navigation, styles, completedReadingPassageIds],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: DaySection }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
        <Text style={styles.sectionDescription}>{section.description}</Text>
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
        <Text style={styles.errorText}>독해 커리큘럼을 불러오지 못했어요.</Text>
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
        <Text style={styles.progressTitle}>독해 60일 챌린지</Text>
        <Text style={styles.progressCount}>
          {completedCount} / {READING_TOTAL_DAYS}일 완료
        </Text>
        <View
          style={styles.progressTrack}
          accessibilityRole="progressbar"
          accessibilityLabel={`${READING_TOTAL_DAYS}일 중 ${completedCount}일 완료`}
        >
          <View
            style={[
              styles.progressFill,
              { width: `${(completedCount / READING_TOTAL_DAYS) * 100}%` },
            ]}
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
      ...theme.typography.headingMd,
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
      ...theme.typography.headingMd,
      color: theme.colors.text,
      fontSize: 16,
    },
    sectionSubtitle: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    sectionDescription: {
      ...theme.typography.body,
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: theme.spacing.xs,
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
    dayDescription: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
    dayMeta: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    checkMark: {
      ...theme.typography.headingMd,
      color: theme.colors.primary,
      fontSize: 18,
    },
    errorText: {
      ...theme.typography.body,
      color: theme.colors.text,
      textAlign: 'center',
      fontWeight: '500',
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
