import { createNativeStackNavigator } from '@react-navigation/native-stack';

import OnboardingScreen from '../screens/OnboardingScreen';
import RecentWordsScreen from '../screens/RecentWordsScreen';
import RewardedConfirmModal from '../screens/RewardedConfirmModal';
import VocabHelperSheet from '../screens/VocabHelperSheet';
import { useUserStore } from '../stores';
import RootTabs from './RootTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root stack. The landing screen depends on whether the user has finished
 * onboarding — we read that flag from useUserStore (persisted via
 * AsyncStorage) so the choice survives app restarts. Global modal routes
 * (VocabHelper, RewardedConfirm) are registered here as well so they can
 * appear from any screen.
 */
export default function RootNavigator() {
  const onboardingCompleted = useUserStore((s) => s.onboardingCompleted);

  return (
    <Stack.Navigator initialRouteName={onboardingCompleted ? 'RootTabs' : 'Onboarding'}>
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RootTabs"
        component={RootTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RecentWords"
        component={RecentWordsScreen}
        options={{ title: '최근 본 단어' }}
      />
      <Stack.Group screenOptions={{ presentation: 'modal' }}>
        <Stack.Screen
          name="VocabHelper"
          component={VocabHelperSheet}
          options={{ headerShown: false, presentation: 'transparentModal' }}
        />
        <Stack.Screen
          name="RewardedConfirm"
          component={RewardedConfirmModal}
          options={{ title: '보상 광고' }}
        />
      </Stack.Group>
    </Stack.Navigator>
  );
}
