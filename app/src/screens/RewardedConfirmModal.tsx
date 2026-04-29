import { StyleSheet, Text, View } from 'react-native';

import type { RootStackScreenProps } from '../navigation/types';
import { useTheme } from '../theme';

/**
 * Confirmation modal shown before triggering a rewarded ad.
 * Shows reward type and estimated watch time; full logic in Task 13.4.
 */
export default function RewardedConfirmModal({
  route,
}: RootStackScreenProps<'RewardedConfirm'>) {
  const { rewardType } = route.params;
  const theme = useTheme();

  return (
    <View style={[styles.container, { padding: theme.spacing.lg }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surfaceElevated,
            borderRadius: theme.radius.lg,
            padding: theme.spacing.lg,
          },
        ]}
      >
        <Text
          style={[
            theme.typography.heading,
            { color: theme.colors.text, marginBottom: theme.spacing.sm },
          ]}
        >
          광고를 시청할까요?
        </Text>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.textSubtle, marginBottom: theme.spacing.sm },
          ]}
        >
          보상: {rewardType}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          확인 + 보상 지급은 태스크 13.4에서 연결돼요.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 360,
  },
});
