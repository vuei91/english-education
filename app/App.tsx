import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';

import RootNavigator from './src/navigation/RootNavigator';
import { audioService } from './src/services/audio';
import { useHydrateUserStore } from './src/stores/useUserStore';
import { darkNavigationTheme, lightNavigationTheme, useTheme } from './src/theme';

// Keep splash visible while we load persisted state
SplashScreen.preventAutoHideAsync();

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

  useEffect(() => {
    if (hydrated) {
      // State loaded — hide the native splash screen
      SplashScreen.hideAsync();
    }
  }, [hydrated]);

  if (!hydrated) {
    // Keep showing native splash (don't render anything visible)
    return null;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <RootNavigator />
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
    </NavigationContainer>
  );
}
