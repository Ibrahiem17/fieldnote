// src/theme/tokens.ts
//
// Compatibility layer. The design system itself lives in src/theme/design.ts
// (documented in design/DESIGN.md); this file re-exports it under the names the
// app's components already use (spacing, radius, fontSize, fontWeight,
// palettes), so restyling never needed a sweep of every import.
//
// The app is LIGHT ONLY (design decision): `palettes.dark` exists solely because
// the photo viewer draws a light "✕" on its black background.

import { colors, design, palette } from "./design";

export const spacing = design.spacing;

/** Old names kept (`sm`/`md`/`lg`); `lg` is now the pill radius the chips use. */
export const radius = {
  sm: design.radius.sm,
  md: design.radius.md,
  lg: design.radius.pill,
  card: design.radius.card,
  cardLg: design.radius.cardLg,
  sheet: design.radius.sheet,
  pill: design.radius.pill,
  icon: design.radius.icon,
} as const;

/** Old size scale (xs…xl) for the few places that still read it. */
export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 34,
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const palettes = {
  light: colors,
  dark: { ...colors, bg: palette.ink, text: palette.cream },
} as const;

export type ColorScheme = keyof typeof palettes;
export type Palette = typeof colors;
