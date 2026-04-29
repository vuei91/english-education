import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme, type Theme } from '../../theme';
import type { EtymologyPayload } from './types';

/**
 * Etymology (voca style) view — Req 9.1, 9.2, 9.3.
 *
 * Renders the prefix/root/suffix breakdown plus up to 5 related words.
 * Tapping a related word invokes `onRelatedTap` which the parent uses to
 * swap the sheet contents in place (Req 9.3).
 */

export type EtymologyViewProps = {
  payload: EtymologyPayload;
  onRelatedTap?: (word: string) => void;
};

const MAX_RELATED = 5;

export default function EtymologyView({ payload, onRelatedTap }: EtymologyViewProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const related = (payload.related ?? []).slice(0, MAX_RELATED);

  return (
    <View style={styles.container}>
      {payload.parts.length > 0 ? (
        <View style={styles.partsRow}>
          {payload.parts.map((p, idx) => (
            <View key={`${p.text}-${idx}`} style={styles.partChip}>
              <Text style={styles.partText}>{p.text}</Text>
              <Text style={styles.partMeaning}>{p.meaning}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {payload.gloss ? <Text style={styles.gloss}>→ {payload.gloss}</Text> : null}

      {related.length > 0 ? (
        <View>
          <Text style={styles.relatedHeading}>관련 단어</Text>
          <View style={styles.relatedRow}>
            {related.map((word) => (
              <Pressable
                key={word}
                onPress={() => onRelatedTap?.(word)}
                accessibilityRole="button"
                accessibilityLabel={`${word} 단어 도우미 열기`}
                style={({ pressed }) => [
                  styles.relatedChip,
                  pressed ? { opacity: 0.8 } : null,
                ]}
              >
                <Text style={styles.relatedText}>{word}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
    },
    partsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    partChip: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
    partText: {
      ...theme.typography.button,
      color: theme.colors.text,
    },
    partMeaning: {
      ...theme.typography.caption,
      color: theme.colors.textSubtle,
    },
    gloss: {
      ...theme.typography.body,
      color: theme.colors.textSubtle,
    },
    relatedHeading: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginBottom: theme.spacing.sm,
    },
    relatedRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    relatedChip: {
      backgroundColor: theme.colors.badgeBg,
      borderRadius: theme.radius.pill,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
    },
    relatedText: {
      ...theme.typography.caption,
      color: theme.colors.primary,
    },
  });
}
