// src/repositories/outbox.ts
//
// The outbox pattern (Section 2.9): every mutation to a "real" entity also
// drops a note in this tray, recording what changed and in what order.
// Nothing reads the tray yet — Phase 3's sync engine is the postman. We
// build it now because retrofitting it later means revisiting every
// mutation in the codebase during the hardest week (Section 2.9, "why build
// it in Phase 1").
//
// `appendOutboxEntry` is called *from inside* the same transaction as the
// entity write it describes (Section 5.2) — never on its own from a screen.
// That's why it takes a `tx` (transaction handle) rather than using `db`
// directly: it must run as part of the caller's transaction, not start one
// of its own.

import { asc, eq, lte } from "drizzle-orm";

import { isDbAvailable, requireDb, type DrizzleDb } from "@/db/client";
import { outbox, type OutboxOperation, type OutboxEntry } from "@/db/schema";
import { newId } from "@/lib/id";
import { now } from "@/lib/time";

// `Parameters<DrizzleDb["transaction"]>[0]` reaches into Drizzle's own
// transaction() function type to pull out exactly the `tx` type it hands
// your callback — so this stays correct even if Drizzle's internal type
// changes shape later, instead of us guessing and hardcoding it. Built
// from the `DrizzleDb` type (not the possibly-null `db` value) so this
// still works while the real database is unavailable (D-013).
type Tx = Parameters<Parameters<DrizzleDb["transaction"]>[0]>[0];

export async function appendOutboxEntry(
  tx: Tx,
  args: {
    entityType: "project" | "inspection" | "template" | "answer" | "attachment";
    entityId: string;
    operation: OutboxOperation;
    payload: unknown;
  },
): Promise<void> {
  await tx.insert(outbox).values({
    id: newId(),
    entityType: args.entityType,
    entityId: args.entityId,
    operation: args.operation,
    // JSON.stringify turns the JS object into text, because SQLite columns
    // hold text/numbers, not objects. Phase 3's sync worker JSON.parses it
    // back before sending it to Supabase.
    payloadJson: JSON.stringify(args.payload),
    attempts: 0,
    nextAttemptAt: now(),
    createdAt: now(),
  });
}

/**
 * Dev-only: total outbox rows, shown on the Settings screen (TC-17).
 * In preview mode (D-013) there's no real outbox to count — 0 is the
 * honest answer, since mock mutations never write one.
 */
export async function countOutboxEntries(): Promise<number> {
  if (!isDbAvailable()) return 0;
  const db = requireDb();
  const rows = await db.select().from(outbox);
  return rows.length;
}

/** Dev-only: outbox rows for one entity, newest first — useful when debugging. */
export async function listOutboxForEntity(entityId: string): Promise<OutboxEntry[]> {
  if (!isDbAvailable()) return [];
  const db = requireDb();
  return db.select().from(outbox).where(eq(outbox.entityId, entityId));
}

/**
 * What the drain loop (src/lib/syncEngine.ts) actually reads: every row due
 * to be tried right now (`nextAttemptAt` has passed — always true today,
 * since nothing schedules a later retry until Day 3), oldest first. Oldest
 * first is not a style choice: a project's own "insert" row must reach the
 * server before an inspection created under it, or the inspection's insert
 * fails a foreign-key check server-side (plan Section 2.4/4.3 — "parents
 * before children").
 */
export async function listPendingOutboxEntries(limit = 50): Promise<OutboxEntry[]> {
  if (!isDbAvailable()) return [];
  const db = requireDb();
  return db
    .select()
    .from(outbox)
    .where(lte(outbox.nextAttemptAt, now()))
    .orderBy(asc(outbox.createdAt))
    .limit(limit);
}

/** Removes an outbox row once its change has been confirmed applied server-side. */
export async function deleteOutboxEntry(id: string): Promise<void> {
  if (!isDbAvailable()) return;
  const db = requireDb();
  await db.delete(outbox).where(eq(outbox.id, id));
}

/**
 * Day 2 scope only: record that a push attempt failed, without scheduling a
 * retry — Day 3 adds the actual backoff-with-jitter delay this same column
 * (`nextAttemptAt`) will drive. For now the row simply stays due immediately
 * and the drain loop will try it again next time it runs.
 */
export async function recordOutboxFailure(id: string, error: string): Promise<void> {
  if (!isDbAvailable()) return;
  const db = requireDb();
  const rows = await db.select().from(outbox).where(eq(outbox.id, id));
  const current = rows[0];
  if (!current) return;
  await db
    .update(outbox)
    .set({ attempts: current.attempts + 1, lastError: error })
    .where(eq(outbox.id, id));
}
