// src/theme/ThemeProvider.tsx
//
// Hands the design system down through React context, so any component can call
// `useTheme()`. The app is light-only (design decision), so there is no
// light/dark switching here any more — the phone's dark-mode setting is ignored.

import { createContext, useContext, type ReactNode } from "react";

import { design } from "./design";
import { fontSize, fontWeight, radius, spacing, type Palette } from "./tokens";

type Theme = {
  scheme: "light";
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  /** The full design system: fonts, text styles, card colours, gradients, motion… */
  design: typeof design;
};

// One object, built once: nothing in it changes at runtime.
const theme: Theme = {
  scheme: "light",
  colors: design.colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  design,
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Thrown here, not returned as undefined, so a missing provider fails
    // loudly at the exact screen that forgot to wrap itself.
    throw new Error("useTheme() called outside <ThemeProvider>");
  }
  return ctx;
}
