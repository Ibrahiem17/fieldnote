// src/components/EmptyState.tsx
//
// What a list shows when it has nothing to show. Every list in this app
// (Projects, Inspections, filtered results) uses this instead of rendering
// nothing — a blank screen looks broken; an empty state explains itself.

import { StyleSheet, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";

type EmptyStateProps = {
  title: string;
  message?: string;
};

export function EmptyState({ title, message }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { padding: theme.spacing.xl }]}>
      <Text variant="subtitle" style={styles.center}>
        {title}
      </Text>
      {message ? (
        <Text variant="body" muted style={[styles.center, { marginTop: theme.spacing.xs }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  center: { textAlign: "center" },
});
