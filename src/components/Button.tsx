// src/components/Button.tsx
//
// A tappable button with three visual variants. Built on Pressable rather
// than the old TouchableOpacity, because Pressable is the version React
// Native now recommends and it gives us per-state styling (pressed/disabled)
// through a style function instead of manual state tracking.

import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";

type Variant = "primary" | "secondary" | "danger";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
}: ButtonProps) {
  const theme = useTheme();

  const backgroundFor: Record<Variant, string> = {
    primary: theme.colors.primary,
    secondary: theme.colors.surface,
    danger: theme.colors.danger,
  };
  const textColorFor: Record<Variant, string> = {
    primary: theme.colors.primaryText,
    secondary: theme.colors.text,
    danger: theme.colors.primaryText,
  };

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      // The style prop can take a function: React Native calls it with the
      // current press/hover state and we return different styles per state.
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: backgroundFor[variant],
          borderRadius: theme.radius.md,
          paddingVertical: theme.spacing.sm + 4,
          paddingHorizontal: theme.spacing.md,
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: theme.colors.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColorFor[variant]} />
      ) : (
        <Text style={{ color: textColorFor[variant] }} variant="label">
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
});
