import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../../navigation/types';
import { useTheme, type Theme } from '../../theme';

const LEVELS = [
  { key: 'A1' as const, label: '초급', desc: '기초 회화 · 현재형 · 일상 어휘' },
  { key: 'A2' as const, label: '중급', desc: '과거·미래 · 문장 잇기 · 확장 어휘' },
  { key: 'B1' as const, label: '고급', desc: '완료형 · 분사 · 복합 문장' },
] as const;

/**
 * @deprecated Replaced by DayListScreen in the 100-day curriculum redesign.
 * Kept for reference; not registered in any navigator.
 */
export default function LevelSelectScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>커리큘럼 선택</Text>
      <Text style={styles.subtitle}>내 수준에 맞는 레벨을 골라주세요</Text>
      <View style={styles.list}>
        {LEVELS.map((lv) => (
          <Pressable
            key={lv.key}
            onPress={() => navigation.navigate('DayList', { chapter: undefined })}
            accessibilityRole="button"
            accessibilityLabel={`${lv.label} 레벨 선택`}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.levelBadge}>{lv.key}</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardLabel}>{lv.label}</Text>
              <Text style={styles.cardDesc}>{lv.desc}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
      padding: theme.spacing.lg,
      gap: theme.spacing.lg,
    },
    title: {
      ...theme.typography.headingLg,
      color: theme.colors.text,
    },
    subtitle: {
      ...theme.typography.body,
      color: theme.colors.textMuted,
    },
    list: { gap: theme.spacing.md },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.md,
      gap: theme.spacing.md,
    },
    levelBadge: {
      ...theme.typography.headingLg,
      color: theme.colors.primary,
      width: 48,
      textAlign: 'center',
    },
    cardBody: { flex: 1, gap: 2 },
    cardLabel: {
      ...theme.typography.button,
      color: theme.colors.text,
    },
    cardDesc: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
  });
}
