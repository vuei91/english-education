import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme, type Theme } from '../../theme';

/**
 * SentenceCard — Req 1.2, 1.8.
 *
 * Presentational component. The screen decides when to load the next
 * sentence, when to play audio, and when the user finishes; this card
 * only renders the English line + (optional) Korean toggle and turns
 * individual word taps into a callback.
 *
 * Tokens come from useTheme so dark mode + typography stay consistent
 * with the rest of the app.
 */

export type SentenceCardProps = {
  textEn: string;
  textKo?: string | null;
  onWordPress?: (word: string) => void;
};

const WORD_SPLIT = /(\s+)/; // preserve whitespace so layout matches the source

export default function SentenceCard({ textEn, textKo, onWordPress }: SentenceCardProps) {
  const theme = useTheme();
  const [showKorean, setShowKorean] = useState(false);
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <Text
        accessibilityRole="header"
        accessibilityLabel={textEn}
        style={styles.sentence}
      >
        {textEn.split(WORD_SPLIT).map((token, idx) => {
          if (token.trim() === '') return <Text key={`s-${idx}`}>{token}</Text>;
          const cleaned = token.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
          const tappable = Boolean(cleaned && onWordPress);
          return (
            <Text
              key={`w-${idx}`}
              onPress={tappable ? () => onWordPress?.(cleaned) : undefined}
              accessibilityRole={tappable ? 'button' : undefined}
              accessibilityLabel={tappable ? `${cleaned} 뜻 보기` : undefined}
              style={tappable ? styles.tappableWord : undefined}
            >
              {token}
            </Text>
          );
        })}
      </Text>

      {textKo ? (
        <View style={styles.koreanRow}>
          {showKorean ? <Text style={styles.korean}>{textKo}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              showKorean ? '한국어 번역 숨기기' : '한국어 번역 보기'
            }
            onPress={() => setShowKorean((prev) => !prev)}
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>
              {showKorean ? '숨기기' : '한국어 보기'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: theme.spacing.md,
    },
    sentence: {
      ...theme.typography.sentence,
      color: theme.colors.text,
    },
    tappableWord: {
      color: theme.colors.primary,
      textDecorationLine: 'underline',
      textDecorationStyle: 'dotted',
    },
    koreanRow: {
      minHeight: 28,
    },
    korean: {
      ...theme.typography.body,
      color: theme.colors.textSubtle,
    },
    toggle: {
      alignSelf: 'flex-start',
      paddingVertical: theme.spacing.xs,
    },
    toggleText: {
      ...theme.typography.caption,
      color: theme.colors.primary,
    },
  });
}
