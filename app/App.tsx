import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';

import RootNavigator from './src/navigation/RootNavigator';
import { audioService } from './src/services/audio';
import { useHydrateUserStore } from './src/stores/useUserStore';
import {
  darkNavigationTheme,
  lightNavigationTheme,
  useTheme,
} from './src/theme';

export default function App() {
  useEffect(() => {
    // Prime the audio session up front so the hardware volume keys
    // target the media stream (not the ringer) as soon as the user
    // launches the app. Without this, Android routes volume presses
    // to ringer volume until the first playback call.
    void audioService.primeAudioSession();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemedNavigation />
    </SafeAreaProvider>
  );
}

function ThemedNavigation() {
  const theme = useTheme();
  const hydrated = useHydrateUserStore();
  const navTheme = theme.mode === 'dark' ? darkNavigationTheme : lightNavigationTheme;

  if (!hydrated) {
    // Brief splash while we read persisted onboarding state from AsyncStorage.
    // Without this gate the navigator would flash the "start onboarding"
    // screen even for returning users.
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.bg,
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <RootNavigator />
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
    </NavigationContainer>
  );
}
