import { useCallback, useEffect, useMemo, useState } from 'react';
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
 * `mode` controls the card's presentation direction:
 *   - `'en-to-ko'` (default): English sentence is the main text, Korean
 *     is hidden behind a toggle. This is the standard listen-and-repeat
 *     flow.
 *   - `'ko-to-en'`: Korean sentence is the main text. The learner tries
 *     to recall the English sentence, then reveals it via a toggle. Word
 *     taps and audio playback become available only after the English is
 *     revealed. No scoring, no penalty for revealing immediately — this
 *     is a self-check exercise aligned with the listen-first principle.
 *
 * Tokens come from useTheme so dark mode + typography stay consistent
 * with the rest of the app.
 */

/** Card presentation direction. */
export type CardMode = 'en-to-ko' | 'ko-to-en';

export type SentenceCardProps = {
  textEn: string;
  textKo?: string | null;
  onWordPress?: (word: string) => void;
  /**
   * Presentation mode. Defaults to `'en-to-ko'` for backward
   * compatibility with existing callers.
   */
  mode?: CardMode;
  /**
   * `ko-to-en` mode only — called when the learner reveals the English
   * answer. The parent can use this to enable audio playback.
   */
  onRevealEnglish?: () => void;
  /**
   * `ko-to-en` mode only — called when the learner taps the Korean
   * replay button. The parent plays the Korean TTS.
   */
  onPlayKorean?: () => void;
};

const WORD_SPLIT = /(\s+)/; // preserve whitespace so layout matches the source

/** Renders tappable English words. Extracted so both modes share it. */
function EnglishWords({
  textEn,
  onWordPress,
  styles,
}: {
  textEn: string;
  onWordPress?: (word: string) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Text accessibilityRole="header" accessibilityLabel={textEn} style={styles.sentence}>
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
  );
}

export default function SentenceCard({
  textEn,
  textKo,
  onWordPress,
  mode = 'en-to-ko',
  onRevealEnglish,
  onPlayKorean: _onPlayKorean,
}: SentenceCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [revealed, setRevealed] = useState(false);

  // Reset revealed state when the sentence changes
  useEffect(() => {
    setRevealed(false);
  }, [textEn]);

  const handleReveal = useCallback(() => {
    setRevealed(true);
    if (mode === 'ko-to-en') onRevealEnglish?.();
  }, [mode, onRevealEnglish]);

  const isKoToEn = mode === 'ko-to-en';

  return (
    <View style={styles.card}>
      {/* Top: primary language */}
      {isKoToEn ? (
        <Text accessibilityRole="header" style={styles.sentence}>
          {textKo ?? '(한국어 번역 없음)'}
        </Text>
      ) : (
        <EnglishWords textEn={textEn} onWordPress={onWordPress} styles={styles} />
      )}

      {/* Bottom: hidden language, toggle on tap */}
      {revealed ? (
        <Pressable
          onPress={() => setRevealed(false)}
          accessibilityRole="button"
          accessibilityLabel={isKoToEn ? '영어 숨기기' : '한글 숨기기'}
          style={styles.revealedRow}
        >
          {isKoToEn ? (
            <EnglishWords textEn={textEn} onWordPress={onWordPress} styles={styles} />
          ) : (
            <Text style={styles.korean}>{textKo ?? ''}</Text>
          )}
          <Text style={styles.hideHint}>
            {isKoToEn ? '탭하여 숨기기' : '탭하여 숨기기'}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={handleReveal}
          accessibilityRole="button"
          accessibilityLabel={isKoToEn ? '영어 보기' : '한글 보기'}
          style={({ pressed }) => [
            styles.revealButton,
            {
              borderColor: theme.colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={styles.revealButtonText}>
            {isKoToEn ? '영어 보기' : '한글 보기'}
          </Text>
        </Pressable>
      )}
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
    korean: {
      ...theme.typography.body,
      color: theme.colors.textSubtle,
    },
    revealedRow: {
      paddingTop: theme.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    hideHint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      textAlign: 'left',
      marginTop: theme.spacing.xs,
    },
    revealButton: {
      alignSelf: 'stretch',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1,
    },
    revealButtonText: {
      ...theme.typography.button,
      color: theme.colors.textMuted,
    },
  });
}
