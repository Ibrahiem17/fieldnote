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

import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

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

  // Phase 4, Day 4: rather than trying to interpolate smoothly BETWEEN two
  // of the six colours above (`interpolateColor` needs to know both
  // endpoints, awkward with six discrete states instead of a continuous
  // range), the dot pops — a brief scale-up-then-settle — every time
  // `status` changes, so a real state change is genuinely noticeable
  // instead of snapping to a new colour with no visual cue at all.
  const pop = useSharedValue(1);

  useEffect(() => {
    pop.value = withSequence(withTiming(1.6, { duration: 120 }), withTiming(1, { duration: 180 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `pop` is a stable Reanimated shared value, not state
  }, [status]);

  // A "worklet" — Reanimated's own term for a function tagged (here,
  // automatically, by useAnimatedStyle) to run on the UI thread instead of
  // the JS thread, so this animation stays smooth even if the JS thread is
  // busy elsewhere (e.g. mid-sync) — plan Section 2.7's whole reason
  // Reanimated exists rather than animating with plain React state.
  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Animated.View
        style={[
          { width: 6, height: 6, borderRadius: 3, backgroundColor: color },
          dotStyle,
        ]}
      />
      <Text variant="caption" muted>
        {LABELS[status]}
      </Text>
    </View>
  );
}
