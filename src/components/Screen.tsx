// src/components/Screen.tsx
//
// The outermost wrapper every screen renders inside. It paints the correct
// background colour for the current theme and keeps content clear of the
// notch/home-indicator, so individual screens never have to think about
// either.

import { StyleSheet, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";

type ScreenProps = ViewProps & {
  /** Turn off if a screen wants to run its own scroll view edge-to-edge. */
  padded?: boolean;
};

export function Screen({ style, padded = true, children, ...rest }: ScreenProps) {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.bg }]} edges={["top"]}>
      <View
        style={[
          styles.container,
          { backgroundColor: theme.colors.bg },
          padded && { padding: theme.spacing.md },
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
