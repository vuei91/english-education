import { DarkTheme, DefaultTheme, type Theme as NavTheme } from '@react-navigation/native';

import { darkTheme, lightTheme, type Theme } from './tokens';

/**
 * Maps our token palette onto React Navigation's theme shape so headers,
 * tab bars, and default backgrounds pick up dark mode automatically.
 * Without this step, react-navigation forces its own white/dark backgrounds
 * regardless of what the screens render.
 */
function buildNavTheme(base: NavTheme, theme: Theme): NavTheme {
  return {
    ...base,
    colors: {
      ...base.colors,
      background: theme.colors.bg,
      card: theme.colors.surfaceElevated,
      text: theme.colors.text,
      border: theme.colors.border,
      primary: theme.colors.primary,
      notification: theme.colors.danger,
    },
  };
}

export const lightNavigationTheme = buildNavTheme(DefaultTheme, lightTheme);
export const darkNavigationTheme = buildNavTheme(DarkTheme, darkTheme);
