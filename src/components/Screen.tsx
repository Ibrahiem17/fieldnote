// src/components/Screen.tsx
//
// The outermost wrapper every screen renders inside. It paints the warm cream
// background and keeps content clear of the notch/status bar, so individual
// screens never have to think about either. `padded` uses the design's screen
// gutter (22px) rather than the generic small padding.

import { StyleSheet, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";

type ScreenProps = ViewProps & {
  /** Turn off if a screen wants to run its own scroll view edge-to-edge. */
  padded?: boolean;
};

export function Screen({ style, padded = true, children, ...rest }: ScreenProps) {
  const { colors, spacing } = useTheme().design;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>
      <View
        style={[
          styles.container,
          { backgroundColor: colors.bg },
          padded && { padding: spacing.gutter },
          style,
        ]}
        {...rest}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
});
