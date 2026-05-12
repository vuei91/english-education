import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme, type Theme } from '../../theme';

/**
 * RepetitionTracker — 자기 보고식 발화 반복 체크박스.
 *
 * 원칙:
 *  - "다음" 버튼은 항상 활성화. 체크 수와 무관하게 진행 가능.
 *  - 체크는 순전히 자기 동기부여용 시각 피드백.
 *  - 발화를 평가·채점·시간 측정하지 않는다.
 */

const DEFAULT_TOTAL = 10;

export type RepetitionTrackerProps = {
  /** 현재 체크된 횟수 */
  count: number;
  /** 목표 횟수 (기본 10) */
  total?: number;
  /** 체크 탭 시 호출 */
  onCheck: () => void;
};

export default function RepetitionTracker({
  count,
  total = DEFAULT_TOTAL,
  onCheck,
}: RepetitionTrackerProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const handlePress = useCallback(() => {
    if (count < total) onCheck();
  }, [count, total, onCheck]);

  const filled = Math.min(count, total);

  return (
    <View style={styles.container}>
      <Text style={styles.guide}>따라 말해보세요</Text>
      <View style={styles.row}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[styles.dot, i < filled ? styles.dotFilled : styles.dotEmpty]}
            accessibilityLabel={i < filled ? `${i + 1}번째 완료` : `${i + 1}번째 미완료`}
          />
        ))}
      </View>
      <Pressable
        onPress={handlePress}
        disabled={count >= total}
        accessibilityRole="button"
        accessibilityLabel={`발화 체크 (${filled}/${total})`}
        style={({ pressed }) => [
          styles.checkButton,
          count >= total ? styles.checkButtonDone : undefined,
          { opacity: pressed && count < total ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.checkText, count >= total ? styles.checkTextDone : undefined]}>
          {count >= total ? `${total}번 완료 ✓` : `말했어요 (${filled}/${total})`}
        </Text>
      </Pressable>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    guide: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    row: {
      flexDirection: 'row',
      gap: 6,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    dotFilled: {
      backgroundColor: theme.colors.primary,
    },
    dotEmpty: {
      backgroundColor: theme.colors.border,
    },
    checkButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    checkButtonDone: {
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    checkText: {
      ...theme.typography.caption,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    checkTextDone: {
      color: theme.colors.textMuted,
    },
  });
}
