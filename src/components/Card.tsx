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
};

export function Card({ style, onPress, children, ...rest }: CardProps) {
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
