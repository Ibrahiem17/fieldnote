// src/lib/syncEngine.ts
//
// Day 2 scope only: read every pending outbox row, oldest first, push each
// one, and either mark it synced or record why it failed. No retry
// scheduling yet (Day 3), no pull (Day 4), no conflict handling (Day 5) —
// see docs/SYNC.md's status table for exactly what's built versus not.

import {
  listPendingOutboxEntries,
  deleteOutboxEntry,
  recordOutboxFailure,
} from "@/repositories/outbox";
import { markProjectSynced } from "@/repositories/projects";
import { markInspectionSynced } from "@/repositories/inspections";
import { markAnswerSynced } from "@/repositories/answers";
import { pushOutboxEntry } from "./syncApi";
import type { OutboxEntry } from "@/db/schema";

export type DrainResult = {
  synced: number;
  failed: number;
  errors: { entityType: string; entityId: string; error: string }[];
};

// Which repository function stamps `syncStatus: "synced"` for a given
// entity type, once its push has actually succeeded. `template` has no
// entry — templates are never created by this app (Phase 2's CLAUDE.md
// rule), so an outbox row for one should never exist in practice.
const markSyncedByEntityType: Partial<
  Record<OutboxEntry["entityType"], (id: string) => Promise<void>>
> = {
  project: markProjectSynced,
  inspection: markInspectionSynced,
  answer: markAnswerSynced,
};

/**
 * Drains the outbox: sends every pending row to the server, one at a time,
 * in order — not in parallel. Pushing in parallel could let a child
 * entity's request reach the server before its parent's, exactly the race
 * "parents before children" (plan Section 2.4/4.3) exists to prevent.
 */
export async function drainOutbox(): Promise<DrainResult> {
  const pending = await listPendingOutboxEntries();
  const result: DrainResult = { synced: 0, failed: 0, errors: [] };

  for (const entry of pending) {
    const outcome = await pushOne(entry);
    if (outcome.ok) {
      result.synced += 1;
    } else {
      result.failed += 1;
      result.errors.push({
        entityType: entry.entityType,
        entityId: entry.entityId,
        error: outcome.error,
      });
    }
  }

  return result;
}

async function pushOne(entry: OutboxEntry): Promise<{ ok: true } | { ok: false; error: string }> {
  const pushResult = await pushOutboxEntry(entry);

  if (!pushResult.ok) {
    await recordOutboxFailure(entry.id, pushResult.error);
    return { ok: false, error: pushResult.error };
  }

  const markSynced = markSyncedByEntityType[entry.entityType];
  if (markSynced) {
    await markSynced(entry.entityId);
  }
  // Only reached on real success — deleting the outbox row is the queue
  // saying "this note has been delivered," never done before the server
  // actually confirmed it.
  await deleteOutboxEntry(entry.id);
  return { ok: true };
}
