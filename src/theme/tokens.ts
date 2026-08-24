// src/theme/tokens.ts
//
// Every colour, spacing value and radius the app uses, defined once, here.
// Nothing outside this file should hardcode a hex colour or a raw pixel gap —
// components reach for `spacing.md` or `theme.colors.primary`, never "#2563EB"
// or "16". Change a value here and it changes everywhere at once.

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

// Two full palettes, one per appearance. `useColorScheme()` tells us which
// one the phone is currently in; the ThemeProvider picks the matching object.
export const palettes = {
  light: {
    bg: "#FFFFFF",
    surface: "#F9FAFB",
    text: "#111827",
    textMuted: "#6B7280",
    primary: "#2563EB",
    primaryText: "#FFFFFF",
    border: "#E5E7EB",
    danger: "#DC2626",
    success: "#16A34A",
    warning: "#D97706",
  },
  dark: {
    bg: "#0B1220",
    surface: "#111827",
    text: "#F9FAFB",
    textMuted: "#9CA3AF",
    primary: "#60A5FA",
    primaryText: "#0B1220",
    border: "#1F2937",
    danger: "#F87171",
    success: "#4ADE80",
    warning: "#FBBF24",
  },
} as const;

export type ColorScheme = keyof typeof palettes;
export type Palette = (typeof palettes)[ColorScheme];
