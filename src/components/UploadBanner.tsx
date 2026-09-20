// src/components/UploadBanner.tsx
//
// A thin strip at the top of the main tabs saying whether the person's work has
// reached their account: "You're offline. 3 changes will upload when you have a
// signal." / "Uploading 2 changes…" / "1 change couldn't upload. Tap to try
// again." It shows nothing when everything is uploaded. Before this, the only
// place to see any of that was Settings, so someone without signal had no way
// to know their work was safe.

import { useEffect, useState } from "react";
import { Pressable } from "react-native";
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
  return (
    <Pressable
      onPress={() => router.push("/settings")}
      accessibilityRole="button"
      accessibilityLabel={message.text}
      style={{
        marginHorizontal: theme.spacing.md,
        marginTop: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: problem ? theme.colors.danger : theme.colors.border,
        backgroundColor: theme.colors.surface,
      }}
    >
      <Text variant="caption" style={{ color: problem ? theme.colors.danger : theme.colors.textMuted }}>
        {message.text}
      </Text>
    </Pressable>
  );
}
