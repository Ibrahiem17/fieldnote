// src/lib/sync.ts
//
// The one entry point everything else calls to "just sync" — the manual
// button and the automatic triggers alike — so the ordering rule (plan
// Section 4.3: "push before pull") lives in exactly one place instead of
// being repeated at every call site.
//
// Why push first: pushing first means this device's own pending changes
// reach the server before it asks "what's new?" — otherwise a pull could
// bring down a stale server version of something this device is about to
// overwrite anyway, for no reason, on every single sync.

import { drainOutbox, type DrainResult } from "./syncEngine";
import { pullChanges, type PullResult } from "./syncPull";

export type SyncResult = {
  push: DrainResult;
  pull: PullResult;
};

export async function runSync(): Promise<SyncResult> {
  const push = await drainOutbox();
  const pull = await pullChanges();
  return { push, pull };
}
