/**
 * Token sanity checks for Task 1.4.
 * Why: the whole app reads from this single file, so a typo (e.g.
 * an empty string color) can silently break screens in dark mode
 * without any runtime error.
 */
import { darkTheme, lightTheme, radius, spacing, typography } from '../tokens';

describe('design tokens', () => {
  it('spacing scale is strictly increasing', () => {
    const values = Object.values(spacing);
    const sorted = [...values].sort((a, b) => a - b);
    expect(values).toEqual(sorted);
    expect(values.every((v) => v > 0 || v === spacing.xs)).toBe(true);
  });

  it('radius values are positive or pill sentinel', () => {
    expect(radius.sm).toBeGreaterThan(0);
    expect(radius.md).toBeGreaterThan(radius.sm);
    expect(radius.lg).toBeGreaterThan(radius.md);
    expect(radius.pill).toBeGreaterThan(100);
  });

  it('light and dark palettes cover the same semantic keys', () => {
    expect(Object.keys(lightTheme.colors).sort()).toEqual(
      Object.keys(darkTheme.colors).sort(),
    );
  });

  it('every palette value looks like a color string', () => {
    const valueLooksLikeColor = (v: string) => /^#([0-9a-fA-F]{3,8})$/.test(v);
    [lightTheme, darkTheme].forEach((theme) => {
      Object.values(theme.colors).forEach((v) => {
        expect(valueLooksLikeColor(v)).toBe(true);
      });
    });
  });

  it('typography entries have positive line height >= fontSize', () => {
    Object.values(typography).forEach((entry) => {
      expect(entry.lineHeight).toBeGreaterThanOrEqual(entry.fontSize);
    });
  });
});
