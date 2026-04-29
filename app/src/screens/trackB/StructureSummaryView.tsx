import { StyleSheet, Text, View } from 'react-native';

import type { StructureSummary } from '../../services/content';
import { useTheme, type Theme } from '../../theme';

/**
 * StructureSummaryView — Req 6.1, 6.2, 6.3, 6.4.
 *
 * Displays the 4-slot "who / what / where / when" summary for a long
 * sentence. Missing slots render as "—". No user input is taken; the
 * subjective reading quiz (Req 6.x+) is a follow-up spec.
 */

export type StructureSummaryViewProps = {
  summary: StructureSummary | null;
};

type Slot = { label: string; value: string | null | undefined };

export default function StructureSummaryView({ summary }: StructureSummaryViewProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const slots: Slot[] = [
    { label: '누가', value: summary?.who },
    { label: '무엇을', value: summary?.what },
    { label: '어디에서', value: summary?.whereAt },
    { label: '언제', value: summary?.whenAt },
  ];

  return (
    <View style={styles.grid}>
      {slots.map((slot) => (
        <View key={slot.label} style={styles.cell}>
          <Text style={styles.label}>{slot.label}</Text>
          <Text style={styles.value}>{slot.value && slot.value.length > 0 ? slot.value : '—'}</Text>
        </View>
      ))}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
    },
    cell: {
      flexBasis: '47%',
      flexGrow: 1,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: theme.spacing.xs,
    },
    label: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    value: {
      ...theme.typography.body,
      color: theme.colors.text,
    },
  });
}
