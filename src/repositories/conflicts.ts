// src/repositories/conflicts.ts
//
// The genuinely ambiguous cases plan Section 5's rule R7 flags for a
// person, one row per field — see src/db/schema.ts's own comment on
// `conflicts` and src/lib/conflict.ts for what does and doesn't end up
// here.

import { and, eq } from "drizzle-orm";

import { isDbAvailable, requireDb } from "@/db/client";
import { conflicts, type Conflict } from "@/db/schema";
import { newId } from "@/lib/id";
import { now } from "@/lib/time";

export async function listConflicts(): Promise<Conflict[]> {
  if (!isDbAvailable()) return [];
  const db = requireDb();
  return db.select().from(conflicts);
}

/**
 * Sync-engine only (src/lib/syncPull.ts). Avoids creating a duplicate row
 * for the same entity+field if a conflict on it is already sitting here
 * unresolved — a pull that runs again before the user has acted on the
 * first one shouldn't pile up repeats of the exact same question.
 */
export async function recordConflict(args: {
  entityType: string;
  entityId: string;
  fieldKey: string;
  localValueJson: string;
  serverValueJson: string;
}): Promise<void> {
  if (!isDbAvailable()) return;
  const db = requireDb();
  const existing = await db
    .select()
    .from(conflicts)
    .where(
      and(
        eq(conflicts.entityType, args.entityType),
        eq(conflicts.entityId, args.entityId),
        eq(conflicts.fieldKey, args.fieldKey),
      ),
    );
  if (existing.length > 0) return;

  await db.insert(conflicts).values({
    id: newId(),
    entityType: args.entityType,
    entityId: args.entityId,
    fieldKey: args.fieldKey,
    localValueJson: args.localValueJson,
    serverValueJson: args.serverValueJson,
    detectedAt: now(),
  });
}

/** Called once the user has picked a side (or the entity got deleted out from under the conflict) — see the resolution screen in Settings. */
export async function deleteConflict(id: string): Promise<void> {
  if (!isDbAvailable()) return;
  const db = requireDb();
  await db.delete(conflicts).where(eq(conflicts.id, id));
}

/** Sync-engine only — an incoming tombstone resolves every open conflict on that entity at once (R4/R5: delete wins, there's nothing left to pick a side on). */
export async function deleteConflictsForEntity(entityId: string): Promise<void> {
  if (!isDbAvailable()) return;
  const db = requireDb();
  await db.delete(conflicts).where(eq(conflicts.entityId, entityId));
}
