import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type Theme } from './tokens';

/**
 * Returns the active theme based on the system color scheme.
 * Screens read `theme.colors.*` / `theme.spacing.*` and never reach for
 * hard-coded hex values.
 *
 * useColorScheme() returns null on web during SSR; we treat that as light.
 */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}
