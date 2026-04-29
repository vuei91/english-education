import { StyleSheet, Text, View } from 'react-native';

import { useTheme, type Theme } from '../../theme';
import type { MnemonicPayload } from './types';

/**
 * Mnemonic (경선식 style) view — Req 10.1, 10.2.
 *
 * Korean sound-association phrase + optional one-sentence story.
 * This is purely presentational; quality of content is owned by the
 * content pipeline (Content-Curator steering).
 */

export type MnemonicViewProps = {
  payload: MnemonicPayload;
};

export default function MnemonicView({ payload }: MnemonicViewProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.phraseBox}>
        <Text style={styles.phrase}>{payload.korean_phrase}</Text>
      </View>
      {payload.story ? <Text style={styles.story}>{payload.story}</Text> : null}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
    },
    phraseBox: {
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
    },
    phrase: {
      ...theme.typography.sentence,
      color: theme.colors.text,
    },
    story: {
      ...theme.typography.body,
      color: theme.colors.textSubtle,
    },
  });
}
