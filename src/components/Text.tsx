// src/components/Text.tsx
//
// A themed replacement for React Native's built-in <Text>. The built-in one
// has no colour by default, which is how "white text on a white background
// in dark mode" bugs happen. This one always has a colour, and offers a
// `variant` shorthand for the handful of text styles the app actually uses.

import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

type Variant = "title" | "subtitle" | "body" | "caption" | "label";

type TextProps = RNTextProps & {
  variant?: Variant;
  /** Use the muted grey instead of the main text colour. */
  muted?: boolean;
  color?: string;
};

export function Text({ variant = "body", muted, color, style, ...rest }: TextProps) {
  const theme = useTheme();

  const variantStyle = {
    title: { fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold },
    subtitle: { fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold },
    body: { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.regular },
    caption: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.regular },
    label: { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium },
  }[variant];

  const resolvedColor = color ?? (muted ? theme.colors.textMuted : theme.colors.text);

  return <RNText style={[variantStyle, { color: resolvedColor }, style]} {...rest} />;
}
