---
version: alpha
name: Fluen Design System
description: Supabase-inspired design language adapted for Fluen — clean white canvas, single emerald-green (#3ecf8e) as the only chromatic event, near-black ink (#171717), weight-500 display typography with negative letter-spacing, square-ish 6px button radii.

colors:
  primary: "#3ecf8e"
  primary-deep: "#24b47e"
  primary-soft: "#4ade80"
  ink: "#171717"
  ink-mute: "#707070"
  ink-mute-2: "#9a9a9a"
  ink-faint: "#b2b2b2"
  on-primary: "#171717"
  on-dark: "#ffffff"
  canvas: "#ffffff"
  canvas-soft: "#fafafa"
  canvas-night: "#1c1c1c"
  canvas-night-soft: "#202020"
  hairline: "#dfdfdf"
  hairline-strong: "#c7c7c7"
  hairline-cool: "#ededed"
  danger: "#ff2201"

typography:
  display-xl:
    fontSize: 48px
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: -1.44px
  display-lg:
    fontSize: 36px
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: -0.72px
  display-md:
    fontSize: 28px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: -0.42px
  heading-lg:
    fontSize: 22px
    fontWeight: 500
    lineHeight: 1.2
  heading-md:
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  button:
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.0
  caption:
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  pill: 9999px

spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  huge: 64px
---

## Fluen Design Principles

1. **White canvas commitment** — no atmospheric gradients, no dark hero bands on marketing surfaces.
2. **Single emerald primary** (`#3ecf8e`) — the only chromatic event. Used for CTAs and brand accent.
3. **Near-black ink** (`#171717`) — never pure black. Text on emerald is also near-black, not white.
4. **Weight 500 display** with negative letter-spacing for editorial density.
5. **Square-ish 6px button radii** — technical, never pill-shaped CTAs.
6. **Product UI is the decoration** — no stock photography, no illustrations.

## Do's
- Reserve emerald for filled CTAs only — one green button per viewport.
- Use `Inter` (or system sans) at weight 500 for display, 400 for body.
- Keep borders at 1px hairline grey.
- Dark mode inverts canvas to `#1c1c1c`, keeps emerald primary unchanged.

## Don'ts
- Don't use white text on emerald — always near-black on green.
- Don't introduce additional accent colors as system colors.
- Don't use pill-shaped buttons for primary actions.
- Don't bump display weight above 500.
