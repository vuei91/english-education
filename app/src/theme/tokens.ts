/**
 * Design tokens — Fluen design system.
 *
 * Based on DESIGN.md (Supabase-inspired):
 *  - Single emerald primary (#3ecf8e) as the only chromatic event
 *  - White canvas with greyscale hierarchy
 *  - Near-black ink (#171717), never pure black
 *  - Square-ish radii (6px buttons), never pill-shaped CTAs
 *  - Weight 500 display with negative letter-spacing
 */

export type ColorPalette = {
  /** Page background */
  bg: string;
  /** Card / section background */
  surface: string;
  /** Elevated card background */
  surfaceElevated: string;
  /** Default text — near-black or near-white */
  text: string;
  /** Secondary text */
  textSubtle: string;
  /** Muted / disabled text */
  textMuted: string;
  /** Faint text — placeholder */
  textFaint: string;
  /** Default border */
  border: string;
  /** Stronger border for emphasis */
  borderStrong: string;
  /** Emerald primary — CTA, brand accent */
  primary: string;
  /** Pressed state of primary */
  primaryDeep: string;
  /** Text on primary — near-black on green */
  primaryOn: string;
  /** Danger / error */
  danger: string;
  /** Success indicator */
  success: string;
  /** Pill/tag background */
  badgeBg: string;
  /** Pill/tag text */
  badgeText: string;
};

const lightColors: ColorPalette = {
  bg: '#ffffff',
  surface: '#fafafa',
  surfaceElevated: '#ffffff',
  text: '#171717',
  textSubtle: '#707070',
  textMuted: '#9a9a9a',
  textFaint: '#b2b2b2',
  border: '#dfdfdf',
  borderStrong: '#c7c7c7',
  primary: '#3ecf8e',
  primaryDeep: '#24b47e',
  primaryOn: '#171717',
  danger: '#ff2201',
  success: '#3ecf8e',
  badgeBg: '#fafafa',
  badgeText: '#171717',
};

const darkColors: ColorPalette = {
  bg: '#1c1c1c',
  surface: '#202020',
  surfaceElevated: '#262626',
  text: '#ffffff',
  textSubtle: '#9a9a9a',
  textMuted: '#707070',
  textFaint: '#4a4a4a',
  border: '#333333',
  borderStrong: '#444444',
  primary: '#3ecf8e',
  primaryDeep: '#24b47e',
  primaryOn: '#171717',
  danger: '#ff6369',
  success: '#4ade80',
  badgeBg: '#262626',
  badgeText: '#9a9a9a',
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  huge: 64,
} as const;

export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 9999,
} as const;

export const typography = {
  /** Hero / large display */
  displayXl: { fontSize: 48, fontWeight: '500' as const, lineHeight: 53, letterSpacing: -1.44 },
  /** Section title */
  displayLg: { fontSize: 36, fontWeight: '500' as const, lineHeight: 41, letterSpacing: -0.72 },
  /** Card title */
  displayMd: { fontSize: 28, fontWeight: '500' as const, lineHeight: 34, letterSpacing: -0.42 },
  /** Compact heading */
  headingLg: { fontSize: 22, fontWeight: '500' as const, lineHeight: 26, letterSpacing: 0 },
  /** Sub-heading */
  headingMd: { fontSize: 18, fontWeight: '500' as const, lineHeight: 25, letterSpacing: 0 },
  /** Body lead */
  bodyLg: { fontSize: 18, fontWeight: '400' as const, lineHeight: 28, letterSpacing: 0 },
  /** Default body */
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24, letterSpacing: 0 },
  /** Button label */
  button: { fontSize: 14, fontWeight: '500' as const, lineHeight: 14, letterSpacing: 0 },
  /** Caption / helper */
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 19, letterSpacing: 0 },
  /** Micro / pill label */
  micro: { fontSize: 12, fontWeight: '400' as const, lineHeight: 17, letterSpacing: 0 },
  /** Sentence card — reading rhythm */
  sentence: { fontSize: 20, fontWeight: '500' as const, lineHeight: 28, letterSpacing: -0.2 },
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
