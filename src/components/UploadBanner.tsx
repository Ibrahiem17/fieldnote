// src/components/UploadBanner.tsx
//
// A thin strip at the top of the main tabs saying whether the person's work has
// reached their account: "You're offline. 3 changes will upload when you have a
// signal." / "Uploading 2 changes…" / "1 change couldn't upload. Tap to try
// again." It shows nothing when everything is uploaded. Before this, the only
// place to see any of that was Settings, so someone without signal had no way
// to know their work was safe.

import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useNetInfo } from "@react-native-community/netinfo";

import { useTheme } from "@/theme/ThemeProvider";
import { getOutboxSummary } from "@/lib/syncEngine";
import { describeUpload } from "@/lib/uploadStatus";
import { Text } from "./Text";

const POLL_MS = 4000;

export function UploadBanner() {
  const theme = useTheme();
  const router = useRouter();
  const net = useNetInfo();
  const [counts, setCounts] = useState({ pending: 0, deadLettered: 0 });

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const summary = await getOutboxSummary();
        if (!cancelled) setCounts(summary);
      } catch (e) {
        console.error("UploadBanner: couldn't read the upload queue", e);
      }
    };
    void refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const online = Boolean(net.isConnected && net.isInternetReachable !== false);
  const message = describeUpload({ ...counts, online });
  if (!message) return null;

  const problem = message.tone === "problem";
  const { colors, radius, spacing } = theme.design;
  // Olive pill for "all fine, just waiting" (the design's highlight banner);
  // a light pill with a red dot when something needs attention.
  const fill = problem ? colors.surface : colors.highlightDeep;
  const ink = problem ? colors.danger : colors.onHighlight;
  return (
    <Pressable
      onPress={() => router.push("/settings")}
      accessibilityRole="button"
      accessibilityLabel={message.text}
      style={{
        marginHorizontal: spacing.gutter,
        marginTop: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        borderRadius: radius.pill,
        borderWidth: problem ? 1 : 0,
        borderColor: colors.danger,
        backgroundColor: fill,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
      }}
    >
      {problem ? (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.notification }} />
      ) : null}
      <Text variant="caption" style={{ color: ink, flexShrink: 1 }}>
        {message.text}
      </Text>
    </Pressable>
  );
}
