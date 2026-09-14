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

  const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    const isConnected = Boolean(state.isConnected && state.isInternetReachable !== false);
    // Fire only on the OFF -> ON transition ("regaining connection"), not on
    // every network event — NetInfo also reports Wi-Fi <-> cellular
    // handoffs, which aren't "reconnecting" in any sense worth syncing for.
    if (isConnected && wasConnected === false) {
      void triggerSync("reconnected");
    }
    wasConnected = isConnected;
  });

  const handleAppStateChange = (nextState: AppStateStatus) => {
    if (nextState === "active") {
      void triggerSync("foreground");
    }
  };
  const appStateSubscription = AppState.addEventListener("change", handleAppStateChange);

  return () => {
    unsubscribeNetInfo();
    appStateSubscription.remove();
  };
}
