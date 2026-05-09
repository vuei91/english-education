import { createNativeStackNavigator } from '@react-navigation/native-stack';

import RecentWordsScreen from '../screens/RecentWordsScreen';
import RewardedConfirmModal from '../screens/RewardedConfirmModal';
import DayListScreen from '../screens/curriculum/DayListScreen';
import TrackASessionScreen from '../screens/TrackASessionScreen';
import VocabHelperSheet from '../screens/VocabHelperSheet';
import RootTabs from './RootTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root stack. 앱 실행 시 바로 RootTabs(학습 화면)로 진입한다.
 * Global modal routes (VocabHelper, RewardedConfirm) are registered here
 * as well so they can appear from any screen.
 */
export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerBackTitle: '',
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen
        name="RootTabs"
        component={RootTabs}
        options={{ headerShown: false, title: '' }}
      />
      <Stack.Screen
        name="RecentWords"
        component={RecentWordsScreen}
        options={{ title: '최근 본 단어' }}
      />
      <Stack.Screen name="DayList" component={DayListScreen} options={{ title: '30일 커리큘럼' }} />
      <Stack.Screen
        name="TrackASession"
        component={TrackASessionScreen}
        options={({ route }) => ({
          title: route.params.dayNumber ? `Day ${route.params.dayNumber}` : route.params.unitTitle,
        })}
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
