import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../../navigation/types';
import { useVocabStore, type WordTap } from '../../stores';
import { useTheme, type Theme } from '../../theme';

/**
 * RecentWordsScreen — Task 10.10.
 *
 * Per product context, this is an *optional helper entry* reachable from
 * the Me tab, never a top-level tab (10.11 guard). Each row opens the
 * Vocab Helper modal for that word.
 *
 * We read from the in-memory `useVocabStore` (fast, resilient) and group
 * duplicates client-side. The native SQLite log owned by VocabService is
 * the source of truth in the long run; aggregating it happens in Task
 * 11 alongside Word Unresolved Score.
 */

type RowData = {
  word: string;
  tapCount: number;
  lastTappedAt: number;
  sourceSentenceId: string | null;
};

function group(taps: WordTap[]): RowData[] {
  const map = new Map<string, RowData>();
  for (const tap of taps) {
    const existing = map.get(tap.word);
    if (existing) {
      existing.tapCount += 1;
      if (tap.tappedAt > existing.lastTappedAt) {
        existing.lastTappedAt = tap.tappedAt;
        existing.sourceSentenceId = tap.sourceSentenceId;
      }
    } else {
      map.set(tap.word, {
        word: tap.word,
        tapCount: 1,
        lastTappedAt: tap.tappedAt,
        sourceSentenceId: tap.sourceSentenceId,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.lastTappedAt - a.lastTappedAt);
}

export default function RecentWordsScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const taps = useVocabStore((s) => s.recentTaps);
  const rows = useMemo(() => group(taps), [taps]);

  if (rows.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>아직 본 단어가 없어요.</Text>
        <Text style={styles.emptyHint}>
          문장 속 단어를 탭하면 어원 + 연상을 바로 볼 수 있어요.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={rows}
      keyExtractor={(r) => r.word}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => (
        <Pressable
          onPress={() =>
            navigation.navigate('VocabHelper', {
              word: item.word,
              sourceSentenceId: item.sourceSentenceId ?? undefined,
            })
          }
          accessibilityRole="button"
          accessibilityLabel={`${item.word} 단어 도우미 열기`}
          style={({ pressed }) => [
            styles.row,
            pressed ? { backgroundColor: theme.colors.surface } : null,
          ]}
        >
          <Text style={styles.word}>{item.word}</Text>
          <Text style={styles.meta}>
            {item.tapCount}× · {formatTime(item.lastTappedAt)}
          </Text>
        </Pressable>
      )}
    />
  );
}

function formatTime(ts: number): string {
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60) return '방금 전';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  return `${Math.floor(diffHr / 24)}일 전`;
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    list: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    listContent: {
      paddingVertical: theme.spacing.md,
    },
    row: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    word: {
      ...theme.typography.sentence,
      color: theme.colors.text,
    },
    meta: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    separator: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginHorizontal: theme.spacing.lg,
    },
    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.xl,
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.bg,
    },
    emptyTitle: {
      ...theme.typography.heading,
      color: theme.colors.text,
    },
    emptyHint: {
      ...theme.typography.body,
      color: theme.colors.textMuted,
      textAlign: 'center',
    },
  });
}
