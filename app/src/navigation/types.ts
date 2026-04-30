import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * Root stack hosts onboarding, the main tabs, and modal screens that can be
 * pushed from anywhere (Vocab Helper bottom sheet, Rewarded confirm, etc).
 *
 * Modals live on the root stack so they can appear over any tab without
 * embedding navigation state inside a tab. This preserves the rule
 * "Vocab Helper never becomes a standalone tab" (mobile-implementation.md).
 */
export type RootStackParamList = {
  Onboarding: undefined;
  RootTabs: NavigatorScreenParams<RootTabsParamList>;
  UnitList: { level: 'A1' | 'A2' | 'B1' };
  TrackASession: { unitId: string; unitTitle: string };
  VocabHelper: { word: string; sourceSentenceId?: string };
  RewardedConfirm: {
    rewardType: 'heart' | 'unlock' | 'drill-retry';
  };
  RecentWords: undefined;
};

export type RootTabsParamList = {
  Dashboard: undefined;
  TrackA: undefined;
  TrackB: undefined;
  Me: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type RootTabsScreenProps<T extends keyof RootTabsParamList> = CompositeScreenProps<
  BottomTabScreenProps<RootTabsParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

declare global {
  // Enables typed useNavigation() without explicit param list.
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
