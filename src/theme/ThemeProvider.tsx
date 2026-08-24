// src/theme/ThemeProvider.tsx
//
// Reads the phone's light/dark setting and hands the matching palette down
// through React context, so any component can call `useTheme()` instead of
// re-reading `useColorScheme()` and re-picking a palette itself.

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import {
  palettes,
  radius,
  spacing,
  fontSize,
  fontWeight,
  type ColorScheme,
  type Palette,
} from "./tokens";

type Theme = {
  scheme: ColorScheme;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // useColorScheme() can return "light", "dark", "unspecified" (some
  // Android configurations) or null (device can't tell us). Anything that
  // isn't exactly "dark" falls back to "light" — a safe, explicit default.
  const rawScheme = useColorScheme();
  const scheme: ColorScheme = rawScheme === "dark" ? "dark" : "light";

  // useMemo re-builds this object only when `scheme` actually changes,
  // instead of on every render — cheap here, but the right habit for
  // anything read by many components.
  const theme = useMemo<Theme>(
    () => ({
      scheme,
      colors: palettes[scheme],
      spacing,
      radius,
      fontSize,
      fontWeight,
    }),
    [scheme],
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Thrown here, not returned as undefined, so a missing provider fails
    // loudly at the exact screen that forgot to wrap itself, not with a
    // mysterious "cannot read colors of undefined" three files away.
    throw new Error("useTheme() called outside <ThemeProvider>");
  }
  return ctx;
}
