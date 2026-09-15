// src/lib/backgroundSync.ts
//
// Day 6, plan Section 3.6.3 — deliberately the smallest piece of
// "background execution" this project can actually build inside Expo's
// MANAGED workflow: registering `runSync()` as a periodic background-fetch
// task via `expo-task-manager` + `expo-background-fetch`.
//
// What this genuinely is: a periodic timer the OS owns, that may wake the
// app for a few seconds every so often (iOS: "no sooner than ~15 minutes,
// and the OS decides the real schedule based on usage patterns and battery
// — sometimes far less often, sometimes not at all"; Android: similar, via
// WorkManager under the hood).
//
// What this deliberately is NOT, and why — the plan explicitly permits
// cutting this (Section on falling behind: "If you fall behind, cut in
// this order: 1. Background execution... A well-documented understanding
// of why background execution is unreliable is worth more in an interview
// than a half-working implementation"):
//
//   - NOT a real background URLSession (iOS) that keeps an upload actually
//     running after the app is suspended, surviving well past the few
//     seconds a background-fetch task gets. That needs a native iOS
//     extension/target and NSURLSessionDelegate wiring — outside Expo's
//     managed workflow entirely (a "bare" workflow / custom native module,
//     which this project is not set up as, and which nothing in this
//     environment can build or run without a Mac + Xcode + a real device
//     to test on anyway).
//   - NOT a real Android foreground service (a persistent, user-visible
//     notification while an upload runs). Same reason: a custom native
//     Android module, not something `expo-background-fetch` provides.
//   - NOT verifiable at all in this environment, even for what IS built
//     here: background fetch only ever actually runs on a real, physical,
//     signed dev-build install — Expo Go doesn't support it, and there is
//     no physical device available in this sandbox (D-010). This file is
//     typecheck/lint-clean and its task body calls the exact same
//     `runSync()` every other trigger already calls (live-verified server
//     side on Days 2-5) — but the REGISTRATION and SCHEDULING itself has
//     not run once, on any device, as of this commit.
//
// See docs/DESIGN.md D-024 for the full write-up of this scope decision.

import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";

import { runSync } from "./sync";

export const BACKGROUND_SYNC_TASK = "fieldnote-background-sync";

// A background-fetch task has to be `defineTask`'d at MODULE load time —
// the native side polls a task registry keyed by name, not something that
// can be deferred into a function call. This is safe to run unconditionally
// at import time on iOS/Android; this module is only ever imported from a
// native-only call site (src/app/_layout.tsx, behind a `Platform.OS !==
// "web"` check on a dynamic `import()`, not a static one) specifically so
// this line never executes on web at all — see D-018 for why this
// project doesn't assume an Expo native module degrades gracefully on web
// just because it usually does.
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const result = await runSync();
    const changedAnything = result.push.synced > 0 || result.pull.merged > 0;
    return changedAnything
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (e) {
    console.error("[backgroundSync] background task threw", e);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Called once, from `src/app/_layout.tsx`, only once a session exists and
 * only on a native platform — same gating as `startAutoSync`
 * (src/lib/syncTriggers.ts). Registering twice is harmless (checked below)
 * but pointless, so this checks first.
 */
export async function registerBackgroundSync(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
  if (isRegistered) return;

  await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
    // Fifteen minutes: a FLOOR, not a guarantee — the OS may run it far
    // less often (or not at all) depending on battery, usage patterns, and
    // how many other apps are also asking for background time. There is no
    // way to request "run every 15 minutes, reliably" on either platform;
    // that promise doesn't exist to make.
    minimumInterval: 15 * 60,
    stopOnTerminate: false,
    startOnBoot: true,
  });
}

/** The reverse of `registerBackgroundSync` — not called anywhere yet (no UI needs it), kept for symmetry and for Day 7's test pass. */
export async function unregisterBackgroundSync(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
  if (!isRegistered) return;
  await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
}
