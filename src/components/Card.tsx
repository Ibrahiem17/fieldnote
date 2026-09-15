// src/components/Card.tsx
//
// A rounded, bordered surface used for list rows and grouped content. Exists
// so "what a card looks like" is decided once, not re-styled at every call
// site.

import { Pressable, StyleSheet, View, type ViewProps } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

type CardProps = ViewProps & {
  /** If given, the whole card becomes tappable. */
  onPress?: () => void;
  /** Phase 4, Day 4: only meaningful (and only applied) when `onPress` is
   * set — a non-interactive Card has no role for a screen reader to
   * announce, so there's nothing for a label to attach to. */
  accessibilityLabel?: string;
};

export function Card({ style, onPress, accessibilityLabel, children, ...rest }: CardProps) {
  const theme = useTheme();

  const cardStyle = [
    styles.base,
    {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [...cardStyle, { opacity: pressed ? 0.7 : 1 }]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={cardStyle} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1 },
});
