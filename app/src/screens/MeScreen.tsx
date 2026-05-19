import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import {
  DAILY_GOAL_OPTIONS,
  useHydrateProgressStore,
  useProgressStore,
  useUserStore,
  useVocabStore,
} from '../stores';
import { useTheme, type Theme } from '../theme';
import type { Track } from '../types/domain';

/**
 * Me tab — personal settings + secondary entry for Recent Words
 * (Req 13.1 Daily_Goal picker, Req 18.x preferences).
 *
 * Non-Goal reminder: Recent Words is a secondary row here — never a
 * top-level tab — so the single-word SRS pattern cannot creep in.
 */
export default function MeScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useHydrateProgressStore();
  const dailyGoal = useProgressStore((s) => s.dailyGoal);
  const setDailyGoal = useProgressStore((s) => s.setDailyGoal);
  const resetProgress = useProgressStore((s) => s.reset);
  const clearTaps = useVocabStore((s) => s.clearTaps);

  const preferredTrack = useUserStore((s) => s.preferredTrack);
  const setPreferredTrack = useUserStore((s) => s.setPreferredTrack);

  const handleResetProgress = useCallback(() => {
    const doReset = () => {
      resetProgress();
      clearTaps();
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        '진행 상황, 스트릭, 패턴 배지, 단어 기록이 모두 초기화됩니다. 이 작업은 되돌릴 수 없습니다.',
      );
      if (confirmed) doReset();
    } else {
      Alert.alert(
        '학습 기록 초기화',
        '진행 상황, 스트릭, 패턴 배지, 단어 기록이 모두 초기화됩니다. 이 작업은 되돌릴 수 없습니다.',
        [
          { text: '취소', style: 'cancel' },
          { text: '초기화', style: 'destructive', onPress: doReset },
        ],
      );
    }
  }, [resetProgress, clearTaps]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>내 정보</Text>

      <Section title="일일 목표" theme={theme}>
        <Text style={styles.sectionHint}>
          하루에 몇 문장이 적당한가요?
        </Text>
        <View style={styles.chipRow}>
          {DAILY_GOAL_OPTIONS.map((goal) => (
            <Chip
              key={goal}
              label={`${goal}`}
              active={dailyGoal === goal}
              onPress={() => setDailyGoal(goal)}
              accessibilityLabel={`일일 목표 ${goal}문장으로 설정`}
              theme={theme}
            />
          ))}
        </View>
      </Section>

      <Section title="선호 학습" theme={theme}>
        <View style={styles.chipRow}>
          {(['A', 'B'] as const satisfies readonly Track[]).map((t) => (
            <Chip
              key={t}
              label={t === 'A' ? '회화' : '독해'}
              active={preferredTrack === t}
              onPress={() => setPreferredTrack(t)}
              accessibilityLabel={t === 'A' ? '회화 선호' : '독해 선호'}
              theme={theme}
            />
          ))}
        </View>
      </Section>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="최근 본 단어 열기"
        onPress={() => navigation.navigate('RecentWords')}
        style={({ pressed }) => [
          styles.row,
          pressed ? { opacity: 0.85 } : null,
        ]}
      >
        <Text style={styles.rowLabel}>📚  최근 본 단어</Text>
        <Text style={styles.rowChevron}>›</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="학습 기록 초기화"
        onPress={handleResetProgress}
        style={({ pressed }) => [
          styles.row,
          styles.rowDanger,
          pressed ? { opacity: 0.85 } : null,
        ]}
      >
        <Text style={styles.rowLabelDanger}>🔄  학습 기록 초기화</Text>
      </Pressable>
    </ScrollView>
  );
}

function Section({
  title,
  children,
  theme,
}: {
  title: string;
  children: React.ReactNode;
  theme: Theme;
}) {
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  accessibilityLabel,
  theme,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  theme: Theme;
}) {
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      padding: theme.spacing.lg,
      gap: theme.spacing.lg,
    },
    title: {
      ...theme.typography.headingLg,
      color: theme.colors.text,
    },
    section: {
      gap: theme.spacing.sm,
    },
    sectionTitle: {
      ...theme.typography.button,
      color: theme.colors.text,
    },
    sectionHint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    chip: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    chipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    chipLabel: {
      ...theme.typography.caption,
      color: theme.colors.text,
    },
    chipLabelActive: {
      color: theme.colors.primaryOn,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    rowLabel: {
      ...theme.typography.button,
      color: theme.colors.text,
    },
    rowChevron: {
      ...theme.typography.headingLg,
      color: theme.colors.textMuted,
    },
    rowDanger: {
      borderColor: theme.colors.danger,
    },
    rowLabelDanger: {
      ...theme.typography.button,
      color: theme.colors.danger,
    },
  });
}
