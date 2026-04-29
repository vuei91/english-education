import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { useTheme, type Theme } from '../../theme';
import type { PlaybackSpeed } from '../../types/domain';

/**
 * ShadowingPlayer — Req 5.1, 5.2, 5.3, 5.4, 5.5.
 *
 * Shadowing step for Track B. The user hears native audio at an adjustable
 * speed and can toggle chunk-boundary pauses for easier repeating.
 *
 * Req 5.5 is enforced by absence: NO record button, NO mic permission,
 * NO score. We never inspect what the user says back.
 */

export type ShadowingPlayerProps = {
  onPlayFull: () => void;
  onRepeatChunk: () => void;
  onChangeSpeed: (speed: PlaybackSpeed) => void;
  onToggleChunkPause: (enabled: boolean) => void;
  speed: PlaybackSpeed;
  chunkPauseEnabled: boolean;
};

const SPEED_CHOICES: PlaybackSpeed[] = [0.5, 0.75, 1, 1.25];

export default function ShadowingPlayer({
  onPlayFull,
  onRepeatChunk,
  onChangeSpeed,
  onToggleChunkPause,
  speed,
  chunkPauseEnabled,
}: ShadowingPlayerProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [pendingSpeed, setPendingSpeed] = useState(speed);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="전체 문장 재생"
          onPress={onPlayFull}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: theme.colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.primaryLabel, { color: theme.colors.primaryOn }]}>
            ▶︎  전체 재생
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="현재 청크 반복"
          onPress={onRepeatChunk}
          style={({ pressed }) => [
            styles.secondary,
            {
              borderColor: theme.colors.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.secondaryLabel, { color: theme.colors.text }]}>
            ⟳  청크 반복
          </Text>
        </Pressable>
      </View>

      <View>
        <Text style={styles.groupLabel}>재생 속도</Text>
        <View style={styles.speedRow}>
          {SPEED_CHOICES.map((s) => (
            <Pressable
              key={s}
              onPress={() => {
                setPendingSpeed(s);
                onChangeSpeed(s);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: pendingSpeed === s }}
              accessibilityLabel={`${s}배속`}
              style={[
                styles.speedChip,
                {
                  borderColor: pendingSpeed === s ? theme.colors.primary : theme.colors.border,
                  backgroundColor:
                    pendingSpeed === s ? theme.colors.surface : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.speedText,
                  {
                    color:
                      pendingSpeed === s ? theme.colors.primary : theme.colors.textSubtle,
                  },
                ]}
              >
                {s}×
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.toggleRow}>
        <Text style={[styles.toggleLabel, { color: theme.colors.text }]}>
          청크 사이 1.5초 쉬기
        </Text>
        <Switch
          accessibilityLabel="청크 사이 쉬기"
          value={chunkPauseEnabled}
          onValueChange={onToggleChunkPause}
        />
      </View>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
    },
    row: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    primary: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      borderRadius: theme.radius.md,
    },
    primaryLabel: {
      ...theme.typography.button,
    },
    secondary: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      borderRadius: theme.radius.md,
      borderWidth: 1,
    },
    secondaryLabel: {
      ...theme.typography.button,
    },
    groupLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginBottom: theme.spacing.sm,
    },
    speedRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    speedChip: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      borderWidth: 1,
    },
    speedText: {
      ...theme.typography.button,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    toggleLabel: {
      ...theme.typography.body,
    },
  });
}
