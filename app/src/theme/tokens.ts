/**
 * Design tokens — single source of truth for colors, spacing, typography.
 *
 * Why tokens:
 *  - Dark mode support without scattering conditional styles across screens.
 *  - Consistent rhythm: spacing.md here ≠ hard-coded 16 over there.
 *  - Easier to evolve visual identity; touch this file only.
 *
 * Usage: import `useTheme` from '../theme' and read `theme.colors.*`,
 * `theme.spacing.*`, `theme.typography.*`.
 */

export type ColorPalette = {
  bg: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textSubtle: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryOn: string;
  accent: string;
  danger: string;
  success: string;
  /** Pill/tag background used for "Ad" label, CEFR chips, etc. */
  badgeBg: string;
  badgeText: string;
};

const lightColors: ColorPalette = {
  bg: '#FFFFFF',
  surface: '#F7F8FA',
  surfaceElevated: '#FFFFFF',
  text: '#101114',
  textSubtle: '#4A4E57',
  textMuted: '#8A8F99',
  border: '#E3E5EA',
  primary: '#3B6EF6',
  primaryOn: '#FFFFFF',
  accent: '#F2B441',
  danger: '#E5484D',
  success: '#30A46C',
  badgeBg: '#EEF1F8',
  badgeText: '#4A4E57',
};

const darkColors: ColorPalette = {
  bg: '#0E1013',
  surface: '#151821',
  surfaceElevated: '#1C2029',
  text: '#F1F2F5',
  textSubtle: '#B4B8C0',
  textMuted: '#7C818B',
  border: '#262A33',
  primary: '#6F91FA',
  primaryOn: '#0E1013',
  accent: '#F2B441',
  danger: '#FF6369',
  success: '#4CC38A',
  badgeBg: '#262A33',
  badgeText: '#B4B8C0',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  pill: 9999,
} as const;

export const typography = {
  /** Section titles inside screens. */
  heading: { fontSize: 24, fontWeight: '700' as const, lineHeight: 30 },
  /** Body text default. */
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  /** Secondary hint / description copy. */
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  /** Sentence card — larger than body to support reading rhythm. */
  sentence: { fontSize: 20, fontWeight: '500' as const, lineHeight: 28 },
  /** Button labels. */
  button: { fontSize: 16, fontWeight: '600' as const, lineHeight: 20 },
} as const;

export type Theme = {
  mode: 'light' | 'dark';
  colors: ColorPalette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
};

export const lightTheme: Theme = {
  mode: 'light',
  colors: lightColors,
  spacing,
  radius,
  typography,
};

export const darkTheme: Theme = {
  mode: 'dark',
  colors: darkColors,
  spacing,
  radius,
  typography,
};
