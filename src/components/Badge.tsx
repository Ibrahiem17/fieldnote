// src/components/Badge.tsx
//
// A small pill showing an inspection's status. Colour comes from the design's
// status colours (design/DESIGN.md §1) and the label is ALWAYS shown, so the
// meaning is never carried by colour alone.

import { View } from "react-native";

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
  const { statusColors, radius, spacing, fonts } = useTheme().design;
  const { fill, on } = statusColors[status];

  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: fill,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm + 4,
        paddingVertical: 4,
      }}
    >
      <Text upper style={{ color: on, fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14 }}>
        {LABELS[status]}
      </Text>
    </View>
  );
}
