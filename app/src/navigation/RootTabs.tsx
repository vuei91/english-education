import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import DashboardScreen from '../screens/DashboardScreen';
import MeScreen from '../screens/MeScreen';
import LevelSelectScreen from '../screens/curriculum/LevelSelectScreen';
import TrackBSessionScreen from '../screens/TrackBSessionScreen';
import type { RootTabsParamList } from './types';

const Tab = createBottomTabNavigator<RootTabsParamList>();

/**
 * Map each tab route to a focused/unfocused Ionicons glyph.
 * Outline variants for the inactive state keep the bar calm; filled
 * variants flag the active tab without relying on color alone (helps
 * dark mode + a11y users who tune out color shifts).
 */
const TAB_ICONS: Record<
  keyof RootTabsParamList,
  { focused: keyof typeof Ionicons.glyphMap; unfocused: keyof typeof Ionicons.glyphMap }
> = {
  Dashboard: { focused: 'home', unfocused: 'home-outline' },
  // Track A = short conversational sentences → chat bubble conveys "speak-like" context
  TrackA: { focused: 'chatbubble-ellipses', unfocused: 'chatbubble-ellipses-outline' },
  // Track B = longer reading sentences → book
  TrackB: { focused: 'book', unfocused: 'book-outline' },
  Me: { focused: 'person-circle', unfocused: 'person-circle-outline' },
};

/**
 * Bottom tab navigator — the 4 tabs defined in mobile-implementation.md.
 * Vocab Helper is intentionally NOT a tab (it's a modal sheet on the
 * root stack). Recent Words is reached from the Me tab, not from here.
 */
export default function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const name = focused ? icons.focused : icons.unfocused;
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: '홈' }} />
      <Tab.Screen name="TrackA" component={LevelSelectScreen} options={{ title: '트랙 A' }} />
      <Tab.Screen name="TrackB" component={TrackBSessionScreen} options={{ title: '트랙 B' }} />
      <Tab.Screen name="Me" component={MeScreen} options={{ title: '내 정보' }} />
    </Tab.Navigator>
  );
}
