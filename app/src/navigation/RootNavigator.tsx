import { createNativeStackNavigator } from '@react-navigation/native-stack';

import OnboardingScreen from '../screens/OnboardingScreen';
import RecentWordsScreen from '../screens/RecentWordsScreen';
import RewardedConfirmModal from '../screens/RewardedConfirmModal';
import UnitListScreen from '../screens/curriculum/UnitListScreen';
import TrackASessionScreen from '../screens/TrackASessionScreen';
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

  // React Navigation 팁: `initialRouteName` 은 네비게이터가 처음 마운트될
  // 때 한 번만 해석되므로, 이후 `onboardingCompleted` 값이 바뀌어도
  // 자동으로 재계산되지 않는다. 대신 조건에 따라 Screen 자체를
  // 등록/해제하면 스토어 변화에 따라 네비게이터가 자연스럽게 다음
  // 화면으로 전환해 준다 (온보딩 "학습 시작" 버튼 누른 뒤 RootTabs 로
  // 진입하는 경로가 여기서 완성된다).
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      {onboardingCompleted ? (
        <Stack.Screen
          name="RootTabs"
          component={RootTabs}
          options={{ headerShown: false }}
        />
      ) : (
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false }}
        />
      )}
      <Stack.Screen
        name="RecentWords"
        component={RecentWordsScreen}
        options={{ title: '최근 본 단어' }}
      />
      <Stack.Screen
        name="UnitList"
        component={UnitListScreen}
        options={({ route }) => ({ title: `${route.params.level} 단원` })}
      />
      <Stack.Screen
        name="TrackASession"
        component={TrackASessionScreen}
        options={({ route }) => ({ title: route.params.unitTitle })}
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
