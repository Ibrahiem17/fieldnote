// src/components/EmptyState.tsx
//
// What a screen shows when a list is empty (an invitation, not an apology) and,
// with `children`, when something went wrong ("Something went wrong" + a
// "Try again" button). The title is a fixed heading, so it's drawn as the
// two-tone uppercase headline; the message is calm body text.

import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { Text, TwoToneText } from "./Text";

type EmptyStateProps = {
  title: string;
  message?: string;
  /** An optional action or extra content below the message. */
  children?: ReactNode;
};

export function EmptyState({ title, message, children }: EmptyStateProps) {
  const { spacing } = useTheme().design;

  return (
    <View style={[styles.container, { padding: spacing.xl, gap: spacing.md }]}>
      <TwoToneText size={30} style={styles.center}>
        {title}
      </TwoToneText>
      {message ? (
        <Text muted style={[styles.center, { marginTop: spacing.xs }]}>
          {message}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  center: { textAlign: "center" },
});
