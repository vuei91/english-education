import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getContentDatabase } from '../../db';
import { getSupabaseClient } from '../../lib/supabase';
import type { RootStackParamList, RootStackScreenProps } from '../../navigation/types';
import { audioPlayer } from '../../services/audio/audioPlayer';
import { ContentService, type Sentence, type VocabEntry } from '../../services/content';
import { VocabService } from '../../services/vocab';
import { useVocabStore } from '../../stores';
import { useTheme, type Theme } from '../../theme';
import EtymologyView from './EtymologyView';
import MnemonicView from './MnemonicView';
import type { EtymologyPayload, MnemonicPayload } from './types';

/**
 * Vocab Helper — presented as a modal bottom sheet (Task 10.1, Req 8.1, 8.8).
 *
 * Exists only as a modal on the root stack. It must never become a tab or
 * standalone screen (mobile-implementation steering). Tapping outside the
 * sheet closes it and returns to the exact sentence position the user
 * came from (Req 8.7) — React Navigation gives us that for free since
 * we are a modal overlay on top of the previous route.
 */

type Tab = 'etymology' | 'mnemonic' | 'examples';

const TAB_ORDER: Tab[] = ['etymology', 'mnemonic', 'examples'];
const TAB_LABELS: Record<Tab, string> = {
  etymology: '🧬 어원',
  mnemonic: '🎨 연상',
  examples: '📖 예문',
};

export default function VocabHelperSheet({ route }: RootStackScreenProps<'VocabHelper'>) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [activeWord, setActiveWord] = useState(route.params.word);
  const [entry, setEntry] = useState<VocabEntry | null>(null);
  const [sourceSentence, setSourceSentence] = useState<Sentence | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('etymology');
  const recordTap = useVocabStore((s) => s.recordTap);

  const serviceRef = useRef<VocabService | null>(null);

  const getService = useCallback(async () => {
    if (serviceRef.current) return serviceRef.current;
    const db = await getContentDatabase();
    const content = new ContentService(db, getSupabaseClient());
    serviceRef.current = new VocabService(content, db);
    return serviceRef.current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const svc = await getService();
        const result = await svc.getEntry(activeWord);
        if (!cancelled) setEntry(result);
        // Fetch source sentence for translation fallback when no vocab entry exists.
        if (!result && route.params.sourceSentenceId) {
          const db = await getContentDatabase();
          const content = new ContentService(db, getSupabaseClient());
          const sentence = await content.getSentenceById(route.params.sourceSentenceId);
          if (!cancelled) setSourceSentence(sentence);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeWord, getService, route.params.sourceSentenceId]);

  // When the sheet first appears, record the tap.
  useEffect(() => {
    recordTap({
      word: route.params.word,
      tappedAt: Date.now(),
      sourceSentenceId: route.params.sourceSentenceId ?? null,
    });
    // Persist to native DB too (no-op on web).
    void (async () => {
      const svc = await getService();
      await svc.recordTap({
        word: route.params.word,
        tappedAt: Date.now(),
        sourceSentenceId: route.params.sourceSentenceId ?? null,
      });
    })();
    // This effect should run ONCE per sheet open, keyed by the initial word.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params.word]);

  const etymology = parseEtymology(entry?.etymology ?? null);
  const mnemonic = parseMnemonic(entry?.mnemonic ?? null);
  const availableTabs = useMemo<Tab[]>(() => {
    const tabs: Tab[] = [];
    if (etymology) tabs.push('etymology');
    if (mnemonic) tabs.push('mnemonic');
    // Examples tab shown whenever we have example sentence ids.
    if ((entry?.exampleSentenceIds ?? []).length > 0) tabs.push('examples');
    return tabs;
  }, [etymology, mnemonic, entry]);

  useEffect(() => {
    // Snap active tab to the first available when data comes in or when
    // the user swaps to a related word with a different tab mix (Req 8.5/8.6).
    if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] ?? 'etymology');
    }
  }, [availableTabs, activeTab]);

  const handleRelatedTap = useCallback((word: string) => {
    setActiveWord(word); // Req 9.3: swap the sheet's content in place
    setEntry(null);
  }, []);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleSpeak = useCallback(() => {
    void audioPlayer.speak(activeWord);
  }, [activeWord]);

  return (
    <View style={styles.backdrop}>
      <Pressable
        style={styles.backdropClose}
        accessibilityRole="button"
        accessibilityLabel="단어 도우미 닫기"
        onPress={handleClose}
      />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.word}>{activeWord}</Text>
            {loading ? null : (
              <Text style={styles.meta}>
                {[entry?.pos, entry?.ipa].filter(Boolean).join(' · ')}
              </Text>
            )}
            {entry?.meaningKo ? (
              <Text style={styles.meaning}>{entry.meaningKo}</Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="발음 재생"
            onPress={handleSpeak}
            style={({ pressed }) => [
              styles.speaker,
              pressed ? { opacity: 0.85 } : null,
            ]}
          >
            <Text style={styles.speakerLabel}>🔊</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loader} color={theme.colors.primary} />
        ) : availableTabs.length === 0 ? (
          <View style={styles.fallbackBody}>
            {entry?.meaningKo ? (
              <Text style={styles.fallbackTranslation}>{entry.meaningKo}</Text>
            ) : sourceSentence?.textKo ? (
              <>
                <Text style={styles.fallbackLabel}>문장 번역</Text>
                <Text style={styles.fallbackTranslation}>{sourceSentence.textKo}</Text>
              </>
            ) : null}
          </View>
        ) : (
          <>
            <View style={styles.tabBar}>
              {TAB_ORDER.filter((t) => availableTabs.includes(t)).map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === tab }}
                  accessibilityLabel={TAB_LABELS[tab]}
                  style={[
                    styles.tabItem,
                    activeTab === tab
                      ? { borderBottomColor: theme.colors.primary }
                      : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color:
                          activeTab === tab
                            ? theme.colors.primary
                            : theme.colors.textSubtle,
                      },
                    ]}
                  >
                    {TAB_LABELS[tab]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <ScrollView
              style={styles.tabBody}
              contentContainerStyle={{ paddingBottom: theme.spacing.lg }}
              keyboardShouldPersistTaps="handled"
            >
              {activeTab === 'etymology' && etymology ? (
                <EtymologyView payload={etymology} onRelatedTap={handleRelatedTap} />
              ) : null}
              {activeTab === 'mnemonic' && mnemonic ? (
                <MnemonicView payload={mnemonic} />
              ) : null}
              {activeTab === 'examples' ? (
                <Text style={styles.emptyBody}>
                  예문 보기는 다음 업데이트에서 제공돼요.
                </Text>
              ) : null}
            </ScrollView>
          </>
        )}
      </View>
    </View>
  );
}

/* -------- payload parsers (defensive against jsonb shape drift) ------- */

function parseEtymology(raw: unknown): EtymologyPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const rawParts = Array.isArray(obj.parts) ? obj.parts : [];
  const parts = rawParts
    .map((p) => {
      if (!p || typeof p !== 'object') return null;
      const pp = p as Record<string, unknown>;
      if (typeof pp.text !== 'string' || typeof pp.meaning !== 'string') return null;
      return { text: pp.text, meaning: pp.meaning };
    })
    .filter((p): p is EtymologyPayload['parts'][number] => p !== null);
  if (parts.length === 0 && typeof obj.gloss !== 'string') return null;
  return {
    parts,
    gloss: typeof obj.gloss === 'string' ? obj.gloss : undefined,
    related: Array.isArray(obj.related)
      ? obj.related.filter((x): x is string => typeof x === 'string')
      : undefined,
  };
}

function parseMnemonic(raw: unknown): MnemonicPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.korean_phrase !== 'string') return null;
  return {
    korean_phrase: obj.korean_phrase,
    story: typeof obj.story === 'string' ? obj.story : undefined,
  };
}

/* ---------------------------- styles ---------------------------------- */

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    backdropClose: {
      ...StyleSheet.absoluteFillObject,
    },
    sheet: {
      backgroundColor: theme.colors.surfaceElevated,
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      maxHeight: '85%',
    },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.border,
      marginBottom: theme.spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.md,
    },
    word: {
      ...theme.typography.heading,
      color: theme.colors.text,
    },
    meta: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    meaning: {
      ...theme.typography.body,
      color: theme.colors.textSubtle,
      marginTop: theme.spacing.sm,
    },
    speaker: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surface,
    },
    speakerLabel: {
      fontSize: 20,
    },
    tabBar: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    tabItem: {
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabText: {
      ...theme.typography.button,
    },
    tabBody: {
      flexGrow: 0,
    },
    loader: {
      marginVertical: theme.spacing.lg,
    },
    emptyBody: {
      ...theme.typography.body,
      color: theme.colors.textMuted,
    },
    fallbackBody: {
      gap: theme.spacing.sm,
    },
    fallbackLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    fallbackTranslation: {
      ...theme.typography.body,
      color: theme.colors.text,
      lineHeight: 24,
    },
  });
}
