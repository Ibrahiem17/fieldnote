// src/repositories/syncState.ts
//
// The pull cursor (plan Section 2.7): "the server timestamp of the newest
// change we've already pulled." One row, looked up by a fixed key — see
// src/db/schema.ts's own comment on `syncState` for why this gets its own
// tiny table instead of living as a column on some other row.

import { eq } from "drizzle-orm";

import { isDbAvailable, requireDb } from "@/db/client";
import { syncState } from "@/db/schema";

const CURSOR_KEY = "lastSyncedAt";

/** `null` means "never successfully pulled" — the caller treats that as the epoch. */
export async function getLastSyncedAt(): Promise<string | null> {
  if (!isDbAvailable()) return null;
  const db = requireDb();
  const rows = await db.select().from(syncState).where(eq(syncState.key, CURSOR_KEY));
  return rows[0]?.value ?? null;
}

/**
 * Only ever called once an entire pull batch has been fully applied
 * (src/lib/syncPull.ts) — never partway through — so a crash mid-merge
 * leaves the cursor exactly where it was, and the next pull simply
 * re-fetches (and safely re-applies, since merging is an upsert) the same
 * rows instead of silently skipping any of them.
 */
export async function setLastSyncedAt(value: string): Promise<void> {
  if (!isDbAvailable()) return;
  const db = requireDb();
  await db
    .insert(syncState)
    .values({ key: CURSOR_KEY, value })
    .onConflictDoUpdate({ target: syncState.key, set: { value } });
}
