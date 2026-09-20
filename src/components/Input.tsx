// src/components/Input.tsx
//
// A soft beige field with a big corner radius (design/DESIGN.md §7). It has no
// border until you focus it, then it gets a purple ring. The label sits above in
// the readable body font (not uppercase: question labels come from templates and
// can be long). An error swaps the ring to red and shows the message below.
// Any onFocus/onBlur a caller passes still runs (the form saves on blur).

import { useState } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
};

export function Input({ label, error, style, onFocus, onBlur, ...rest }: InputProps) {
  const { colors, radius, spacing, fonts, fontSize } = useTheme().design;
  const [focused, setFocused] = useState(false);

  const ringColor = error ? colors.danger : focused ? colors.primaryDeep : "transparent";

  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <Text variant="label" muted>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          {
            fontFamily: fonts.body,
            fontSize: fontSize.body,
            color: colors.text,
            backgroundColor: colors.beige,
            borderWidth: 2,
            borderColor: ringColor,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: 14,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
