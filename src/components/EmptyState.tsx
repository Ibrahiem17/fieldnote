// src/components/EmptyState.tsx
//
// What a list shows when it has nothing to show. Every list in this app
// (Projects, Inspections, filtered results) uses this instead of rendering
// nothing — a blank screen looks broken; an empty state explains itself.

import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";

type EmptyStateProps = {
  title: string;
  message?: string;
  /** Phase 4, Day 4: an optional action below the message — this same
   * component now doubles as the app's error state (title "Something went
   * wrong", a "Try again" button here) as well as its empty-list state, so
   * one visual treatment covers both instead of building a second one. */
  children?: ReactNode;
};

export function EmptyState({ title, message, children }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { padding: theme.spacing.xl, gap: theme.spacing.md }]}>
      <Text variant="subtitle" style={styles.center}>
        {title}
      </Text>
      {message ? (
        <Text variant="body" muted style={[styles.center, { marginTop: theme.spacing.xs }]}>
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
