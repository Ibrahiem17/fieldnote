// src/components/Input.tsx
//
// A themed text field with an optional label and error message underneath.
// Phase 1 only needs plain single-line text (an inspection title). Phase 2's
// form engine will build richer field types on top of this, not replace it.

import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
};

export function Input({ label, error, style, ...rest }: InputProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.xs }}>
      {label ? (
        <Text variant="label" muted>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={theme.colors.textMuted}
        style={[
          styles.base,
          {
            color: theme.colors.text,
            borderColor: error ? theme.colors.danger : theme.colors.border,
            borderRadius: theme.radius.sm,
            padding: theme.spacing.sm,
            backgroundColor: theme.colors.surface,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" style={{ color: theme.colors.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1, fontSize: 16 },
});
