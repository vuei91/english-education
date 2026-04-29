import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Chunk } from '../../services/content';
import { useTheme, type Theme } from '../../theme';

/**
 * ChunkingView — Req 4.1, 4.2, 4.3, 4.5.
 *
 * Shows meaning-unit chunks with depth-indent + role-coloured left bar.
 * A dedicated ▶ button plays audio for just that chunk (Req 4.3).
 * Words in the chunk text are individually tappable to open the Vocab
 * Helper (Req 4.5). The chunk play button and the word-lookup buttons
 * are siblings — never nested — so the web (HTML) output remains valid
 * (no button-within-button).
 *
 * If the sentence has no chunks in the Content Pool the parent is
 * responsible for rendering a single-chunk fallback (Req 4.4); this
 * component assumes the array has at least one element.
 */

const WORD_SPLIT = /(\s+)/;

export type ChunkingViewProps = {
  chunks: Chunk[];
  onChunkTap?: (chunk: Chunk) => void;
  onWordTap?: (word: string, chunk: Chunk) => void;
  activeChunkIndex?: number;
};

const ROLE_COLORS = [
  '#3B6EF6',
  '#F2B441',
  '#30A46C',
  '#E5484D',
  '#8B5CF6',
];

function colorForRole(role: string | null): string {
  if (!role) return ROLE_COLORS[4]!;
  const idx =
    role.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % ROLE_COLORS.length;
  return ROLE_COLORS[idx]!;
}

export default function ChunkingView({
  chunks,
  onChunkTap,
  onWordTap,
  activeChunkIndex,
}: ChunkingViewProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      {chunks.map((chunk, idx) => {
        const isActive = idx === activeChunkIndex;
        return (
          <View
            key={chunk.id}
            style={[
              styles.row,
              {
                marginLeft: chunk.depth * theme.spacing.md,
                backgroundColor: isActive ? theme.colors.surface : 'transparent',
                borderLeftColor: colorForRole(chunk.role),
              },
            ]}
          >
            {onChunkTap ? (
              <Pressable
                onPress={() => onChunkTap(chunk)}
                accessibilityRole="button"
                accessibilityLabel={`청크 재생: ${chunk.text}`}
                style={({ pressed }) => [
                  styles.playButton,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.playGlyph}>▶</Text>
              </Pressable>
            ) : null}
            <View style={styles.textCol}>
              <Text style={styles.chunkText}>
                {chunk.text.split(WORD_SPLIT).map((tok, tIdx) => {
                  if (tok.trim() === '')
                    return <Text key={`s-${tIdx}`}>{tok}</Text>;
                  const cleaned = tok.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
                  const tappable = Boolean(cleaned && onWordTap);
                  return (
                    <Text
                      key={`w-${tIdx}`}
                      onPress={
                        tappable ? () => onWordTap?.(cleaned, chunk) : undefined
                      }
                      accessibilityRole={tappable ? 'button' : undefined}
                      accessibilityLabel={
                        tappable ? `${cleaned} 뜻 보기` : undefined
                      }
                      style={tappable ? styles.tappableWord : undefined}
                    >
                      {tok}
                    </Text>
                  );
                })}
              </Text>
              {chunk.role ? (
                <Text style={styles.roleBadge}>{chunk.role}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderLeftWidth: 3,
      borderRadius: theme.radius.sm,
      gap: theme.spacing.sm,
    },
    playButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    playGlyph: {
      ...theme.typography.caption,
      color: theme.colors.primary,
    },
    textCol: {
      flex: 1,
    },
    chunkText: {
      ...theme.typography.sentence,
      color: theme.colors.text,
    },
    tappableWord: {
      color: theme.colors.primary,
      textDecorationLine: 'underline',
      textDecorationStyle: 'dotted',
    },
    roleBadge: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
  });
}
