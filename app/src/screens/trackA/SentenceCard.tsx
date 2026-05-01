import { useCallback, useMemo, useState } from 'react';
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
  onPlayKorean,
}: SentenceCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // --- ko-to-en mode: toggle English answer ---------------------------
  const [showEnglish, setShowEnglish] = useState(false);

  const handleRevealEnglish = useCallback(() => {
    setShowEnglish(true);
    onRevealEnglish?.();
  }, [onRevealEnglish]);

  if (mode === 'ko-to-en') {
    // Korean is the main text; English is hidden until revealed.
    return (
      <View style={styles.card}>
        {/* Mode badge so the learner knows this is a recall exercise */}
        <View style={[styles.modeBadge, { backgroundColor: theme.colors.accent }]}>
          <Text style={[styles.modeBadgeText, { color: theme.colors.text }]}>
            🇰🇷→🇺🇸 영어로 말해보기
          </Text>
        </View>

        <Text accessibilityRole="header" accessibilityLabel={textKo ?? ''} style={styles.sentence}>
          {textKo ?? '(한국어 번역 없음)'}
        </Text>

        {/* Korean replay button */}
        {onPlayKorean ? (
          <Pressable
            onPress={onPlayKorean}
            accessibilityRole="button"
            accessibilityLabel="한국어 다시 듣기"
            style={styles.koreanPlayButton}
          >
            <Text style={[styles.koreanPlayText, { color: theme.colors.primary }]}>
              🔊 한국어 다시 듣기
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.revealRow}>
          {showEnglish ? (
            <>
              <EnglishWords textEn={textEn} onWordPress={onWordPress} styles={styles} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="영어 정답 숨기기"
                onPress={() => setShowEnglish(false)}
                style={styles.toggle}
              >
                <Text style={styles.toggleText}>숨기기</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="영어 정답 보기"
              onPress={handleRevealEnglish}
              style={styles.revealButton}
            >
              <Text style={[styles.revealButtonText, { color: theme.colors.primaryOn }]}>
                영어 보기
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  // --- Default: en-to-ko mode -----------------------------------------
  return (
    <View style={styles.card}>
      <EnglishWords textEn={textEn} onWordPress={onWordPress} styles={styles} />

      {textKo ? (
        <View style={styles.koreanRow}>
          <Text style={styles.korean}>{textKo}</Text>
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
    // --- ko-to-en mode styles ---
    modeBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      borderRadius: theme.radius.sm,
    },
    modeBadgeText: {
      ...theme.typography.caption,
      fontWeight: '600',
    },
    revealRow: {
      gap: theme.spacing.sm,
    },
    revealButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
    },
    revealButtonText: {
      ...theme.typography.button,
    },
    koreanPlayButton: {
      alignSelf: 'flex-start',
      paddingVertical: theme.spacing.xs,
    },
    koreanPlayText: {
      ...theme.typography.caption,
      fontWeight: '600',
    },
  });
}
