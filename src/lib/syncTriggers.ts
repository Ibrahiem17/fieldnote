// src/lib/syncTriggers.ts
//
// Automatic sync triggers (plan Section 3.3.3): run a full push-then-pull
// (src/lib/sync.ts) when connectivity returns and when the app comes back
// to the foreground, on top of the manual "Sync Now" button. Started once,
// from src/app/_layout.tsx, only once a session actually exists — there's
// nothing to sync before someone's signed in.

import NetInfo from "@react-native-community/netinfo";
import { AppState, type AppStateStatus } from "react-native";

import { runSync } from "./sync";
import { getOutboxSummary } from "./syncEngine";

// How often to check, while the app is open and online, for work waiting to
// upload. Sync used to run only on reconnect and on coming back to the
// foreground, so a change made while already online sat unsent until one of
// those happened, even though Settings said it uploads "by itself" (D-045).
const PERIODIC_CHECK_MS = 15_000;

let syncInFlight = false;

async function triggerSync(reason: string): Promise<void> {
  // Guards against two triggers firing close together (e.g. the app comes
  // to the foreground at the exact moment Wi-Fi reconnects) from starting
  // two overlapping syncs — both the push and pull sides already assume
  // they're the only thing touching the outbox/cursor at a time.
  if (syncInFlight) return;
  syncInFlight = true;
  try {
    const result = await runSync();
    if (result.push.synced > 0 || result.push.failed > 0 || result.pull.merged > 0) {
      console.log(
        `[sync] auto-sync (${reason}): pushed ${result.push.synced} (${result.push.failed} failed), pulled ${result.pull.merged}`,
      );
    }
  } catch (e) {
    console.error(`[sync] auto-sync (${reason}) threw`, e);
  } finally {
    syncInFlight = false;
  }
}

/**
 * Registers both triggers and returns a cleanup function — the same
 * "set up in an effect, tear down in its cleanup" shape already used for
 * AuthProvider's `onAuthStateChange` listener.
 */
export function startAutoSync(): () => void {
  let wasConnected: boolean | null = null;
  let connectedNow = false;

  const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    const isConnected = Boolean(state.isConnected && state.isInternetReachable !== false);
    // Fire only on the OFF -> ON transition ("regaining connection"), not on
    // every network event — NetInfo also reports Wi-Fi <-> cellular
    // handoffs, which aren't "reconnecting" in any sense worth syncing for.
    if (isConnected && wasConnected === false) {
      void triggerSync("reconnected");
    }
    wasConnected = isConnected;
    connectedNow = isConnected;
  });

  const handleAppStateChange = (nextState: AppStateStatus) => {
    if (nextState === "active") {
      void triggerSync("foreground");
    }
  };
  const appStateSubscription = AppState.addEventListener("change", handleAppStateChange);

  // Something to send while online? Send it now, instead of waiting for the next
  // foreground/reconnect. Offline checks cost nothing (D-042): no attempts spent.
  const periodic = setInterval(async () => {
    if (!connectedNow) return;
    try {
      const { pending } = await getOutboxSummary();
      if (pending > 0) void triggerSync("periodic");
    } catch (e) {
      console.error("[sync] periodic check failed", e);
    }
  }, PERIODIC_CHECK_MS);

  return () => {
    clearInterval(periodic);
    unsubscribeNetInfo();
    appStateSubscription.remove();
  };
}
