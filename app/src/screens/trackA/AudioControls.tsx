import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme, type Theme } from '../../theme';

/**
 * AudioControls — Req 1.4 (Track A).
 *
 * Track A intentionally keeps the control minimal: a single play button.
 * Speed adjustment is reserved for long-form Track B (Req 5.2), so we
 * don't surface it here.
 */
export type AudioControlsProps = {
  onPlay: () => void;
  disabled?: boolean;
  playCount: number;
};

export default function AudioControls({ onPlay, disabled, playCount }: AudioControlsProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="원어민 발음 재생"
        onPress={onPlay}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: theme.colors.primary,
            opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text style={[styles.label, { color: theme.colors.primaryOn }]}>🔊  듣기</Text>
      </Pressable>
      {playCount > 0 ? (
        <Text style={styles.count} accessibilityLiveRegion="polite">
          {playCount}회 재생됨
        </Text>
      ) : null}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    button: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
    },
    label: {
      ...theme.typography.button,
    },
    count: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
  });
}
