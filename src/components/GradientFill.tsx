// src/components/GradientFill.tsx
//
// Fills its parent with a gradient (soft colour ramps and the glossy highlight on
// cards). expo-linear-gradient is a NATIVE module: a phone build made before it
// was added doesn't contain it, and importing it there throws. So it's loaded in
// a try/catch, and when it isn't available this draws a flat colour instead —
// the app keeps working (just flatter) until the new build is installed.

import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

type LinearGradientType = typeof import("expo-linear-gradient").LinearGradient;

let LinearGradient: LinearGradientType | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native module, see header
  LinearGradient = require("expo-linear-gradient").LinearGradient;
} catch {
  LinearGradient = null;
}

type Props = {
  colors: readonly string[];
  /** Used when the native gradient isn't available. Defaults to the middle stop. */
  fallback?: string;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: StyleProp<ViewStyle>;
};

export function GradientFill({ colors, fallback, start, end, style }: Props) {
  if (LinearGradient && colors.length >= 2) {
    return (
      <LinearGradient
        colors={colors as unknown as readonly [string, string, ...string[]]}
        start={start}
        end={end}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, style]}
      />
    );
  }
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: fallback ?? colors[Math.floor(colors.length / 2)] }, style]}
    />
  );
}
