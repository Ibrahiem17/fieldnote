// src/components/SyncStatusDot.tsx
//
// A tiny coloured dot + label showing where a row stands with the SERVER
// (local/pending/syncing/synced/failed/conflict) — deliberately a separate,
// smaller component from Badge.tsx, which shows the inspection's own
// WORKFLOW status (draft/in progress/completed/submitted). Those are two
// unrelated ideas that happen to both render as a small coloured label; an
// inspection can be "Completed" and "pending" (finished, not yet synced) at
// the same time, which a single combined component would make awkward to
// express.

import { View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";
import type { SyncStatus } from "@/db/schema";

const LABELS: Record<SyncStatus, string> = {
  local: "Not yet synced",
  pending: "Pending",
  syncing: "Syncing…",
  synced: "Synced",
  failed: "Failed",
  conflict: "Conflict",
};

export function SyncStatusDot({ status }: { status: SyncStatus }) {
  const theme = useTheme();

  const colorFor: Record<SyncStatus, string> = {
    local: theme.colors.textMuted,
    pending: theme.colors.warning,
    syncing: theme.colors.primary,
    synced: theme.colors.success,
    failed: theme.colors.danger,
    conflict: theme.colors.danger,
  };
  const color = colorFor[status];

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text variant="caption" muted>
        {LABELS[status]}
      </Text>
    </View>
  );
}
