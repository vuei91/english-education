import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme, type Theme } from '../../theme';
import type { SentenceFeedback } from '../../types/domain';

/**
 * FeedbackBar — Req 1.7.
 *
 * Two-grade feedback: "Got it" (known) or "Hard" (hard). This is used
 * only to nudge the next-sentence ranker later; it is NOT a performance
 * score and must never surface as one to the user.
 */
export type FeedbackBarProps = {
  onPick: (feedback: SentenceFeedback) => void;
  disabled?: boolean;
};

export default function FeedbackBar({ onPick, disabled }: FeedbackBarProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.row}>
      <PickButton
        theme={theme}
        label="알았어요"
        tone={theme.colors.success}
        onPress={() => onPick('known')}
        disabled={disabled}
      />
      <PickButton
        theme={theme}
        label="어려워요"
        tone={theme.colors.danger}
        onPress={() => onPick('hard')}
        disabled={disabled}
      />
    </View>
  );
}

function PickButton({
  theme,
  label,
  tone,
  onPress,
  disabled,
}: {
  theme: Theme;
  label: string;
  tone: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const styles = makeStyles(theme);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.pick,
        {
          borderColor: tone,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={[styles.pickLabel, { color: theme.colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    pick: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      borderWidth: 2,
      borderRadius: theme.radius.md,
      backgroundColor: 'transparent',
    },
    pickLabel: {
      ...theme.typography.button,
    },
  });
}
