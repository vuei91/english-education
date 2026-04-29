import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import DashboardScreen from '../screens/DashboardScreen';
import MeScreen from '../screens/MeScreen';
import TrackASessionScreen from '../screens/TrackASessionScreen';
import TrackBSessionScreen from '../screens/TrackBSessionScreen';
import type { RootTabsParamList } from './types';

const Tab = createBottomTabNavigator<RootTabsParamList>();

/**
 * Bottom tab navigator — the 4 tabs defined in mobile-implementation.md.
 * Vocab Helper is intentionally NOT a tab (it's a modal sheet on the
 * root stack). Recent Words is reached from the Me tab, not from here.
 */
export default function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: '홈' }} />
      <Tab.Screen name="TrackA" component={TrackASessionScreen} options={{ title: '트랙 A' }} />
      <Tab.Screen name="TrackB" component={TrackBSessionScreen} options={{ title: '트랙 B' }} />
      <Tab.Screen name="Me" component={MeScreen} options={{ title: '내 정보' }} />
    </Tab.Navigator>
  );
}
