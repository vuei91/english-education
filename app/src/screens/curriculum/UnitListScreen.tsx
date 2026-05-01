import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../../navigation/types';
import type { CurriculumUnit } from '../../types/domain';
import { CurriculumService } from '../../services/curriculum/CurriculumService';
import { getSupabaseClient } from '../../lib/supabase';
import { getContentDatabase } from '../../db';
import { useTheme, type Theme } from '../../theme';

/**
 * @deprecated Replaced by DayListScreen in the 100-day curriculum redesign.
 * Kept for reference; not registered in any navigator.
 */
export default function UnitListScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'DayList'>>();
  const filterChapter = route.params?.chapter;

  const [units, setUnits] = useState<CurriculumUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUnits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = await getContentDatabase();
      const svc = new CurriculumService(db, getSupabaseClient());
      const data = await svc.listUnits();
      setUnits(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUnits();
  }, [loadUnits]);

  const renderUnit = useCallback(
    ({ item }: { item: CurriculumUnit }) => (
      <Pressable
        onPress={() =>
          navigation.navigate('TrackASession', {
            unitId: item.id,
            unitTitle: item.titleKo,
          })
        }
        accessibilityRole="button"
        accessibilityLabel={`${item.titleKo} 단원 시작`}
        style={({ pressed }) => [styles.unitCard, pressed && { opacity: 0.85 }]}
      >
        <View style={styles.unitIndex}>
          <Text style={styles.unitIndexText}>{item.orderIndex}</Text>
        </View>
        <View style={styles.unitBody}>
          <Text style={styles.unitTitle}>{item.titleKo}</Text>
          <Text style={styles.unitMeta}>
            {item.opens ? `${item.opens.track} · ${item.opens.point}` : '팩 확장'}
            {' · '}
            {item.theme}
          </Text>
        </View>
      </Pressable>
    ),
    [navigation, styles],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>단원을 불러오지 못했어요.</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <Pressable
          onPress={() => void loadUnits()}
          style={styles.retry}
          accessibilityRole="button"
          accessibilityLabel="다시 시도"
        >
          <Text style={styles.retryText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  if (units.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>아직 단원이 없어요.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={units}
      keyExtractor={(u) => u.id}
      renderItem={renderUnit}
      contentContainerStyle={styles.list}
      style={{ backgroundColor: theme.colors.bg }}
    />
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.xl,
      backgroundColor: theme.colors.bg,
      gap: theme.spacing.sm,
    },
    list: {
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    unitCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.md,
      gap: theme.spacing.md,
    },
    unitIndex: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unitIndexText: {
      ...theme.typography.button,
      color: theme.colors.primaryOn,
    },
    unitBody: { flex: 1, gap: 2 },
    unitTitle: {
      ...theme.typography.button,
      color: theme.colors.text,
    },
    unitMeta: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    errorText: {
      ...theme.typography.button,
      color: theme.colors.text,
      textAlign: 'center',
    },
    errorDetail: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      textAlign: 'center',
    },
    retry: {
      marginTop: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
    },
    retryText: {
      ...theme.typography.button,
      color: theme.colors.primaryOn,
    },
  });
}
