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

import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { outbox, type OutboxOperation, type OutboxEntry } from "@/db/schema";
import { newId } from "@/lib/id";
import { now } from "@/lib/time";

// `Parameters<typeof db.transaction>[0]` reaches into Drizzle's own
// transaction() function type to pull out exactly the `tx` type it hands
// your callback — so this stays correct even if Drizzle's internal type
// changes shape later, instead of us guessing and hardcoding it.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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

/** Dev-only: total outbox rows, shown on the Settings screen (TC-17). */
export async function countOutboxEntries(): Promise<number> {
  const rows = await db.select().from(outbox);
  return rows.length;
}

/** Dev-only: outbox rows for one entity, newest first — useful when debugging. */
export async function listOutboxForEntity(entityId: string): Promise<OutboxEntry[]> {
  return db.select().from(outbox).where(eq(outbox.entityId, entityId));
}
