// src/components/Badge.tsx
//
// A small coloured pill for showing an inspection's status at a glance in a
// list row. The colour is decided from a fixed map, not passed in freehand,
// so every "completed" badge in the app is the same colour without anyone
// having to remember which hex code that is.

import { StyleSheet, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";
import type { InspectionStatus } from "@/db/schema";

const LABELS: Record<InspectionStatus, string> = {
  draft: "Draft",
  in_progress: "In progress",
  completed: "Completed",
  submitted: "Submitted",
};

export function Badge({ status }: { status: InspectionStatus }) {
  const theme = useTheme();

  const colorFor: Record<InspectionStatus, string> = {
    draft: theme.colors.textMuted,
    in_progress: theme.colors.warning,
    completed: theme.colors.success,
    submitted: theme.colors.primary,
  };

  const color = colorFor[status];

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: color + "22", // 22 = ~13% opacity in hex alpha
          borderRadius: theme.radius.sm,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: 2,
        },
      ]}
    >
      <Text variant="caption" style={{ color, fontWeight: theme.fontWeight.semibold }}>
        {LABELS[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: "flex-start" },
});
