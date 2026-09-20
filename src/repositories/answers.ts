// src/repositories/answers.ts
//
// Answer repository for Phase 2. Implements the rules in Section 5.2:
// - One transaction per save
// - Set updated_at
// - Insert or update the answers table (unique on inspectionId + fieldKey)
// - Append an outbox row, but avoid creating one per autosave by replacing
//   any existing pending outbox "update" entry for the same answer.

import { and, eq, isNull } from "drizzle-orm";
import { isDbAvailable, requireDb } from "@/db/client";
import { answers, outbox, type Answer, type NewAnswer, type SyncStatus } from "@/db/schema";
import { newId } from "@/lib/id";
import { now } from "@/lib/time";
import { appendOutboxEntry } from "./outbox";
import * as mock from "@/db/mockStore";

export async function getAnswers(inspectionId: string): Promise<Answer[]> {
  if (!isDbAvailable()) return mock.getAnswers(inspectionId);
  const db = requireDb();
  return db
    .select()
    .from(answers)
    .where(and(eq(answers.inspectionId, inspectionId), isNull(answers.deletedAt)));
}

/** Day 5: conflict resolution (src/lib/syncPull.ts) needs one answer row by its own id, not a whole inspection's worth. */
export async function getAnswerById(id: string): Promise<Answer | null> {
  if (!isDbAvailable()) return null;
  const db = requireDb();
  const rows = await db.select().from(answers).where(eq(answers.id, id));
  return rows[0] ?? null;
}

export async function saveAnswer(
  inspectionId: string,
  fieldKey: string,
  value: { text?: string | null; number?: number | null; json?: unknown | null },
): Promise<Answer> {
  if (!isDbAvailable()) return mock.saveAnswer(inspectionId, fieldKey, value as any);
  const db = requireDb();
  const updatedAt = now();

  return db.transaction(async (tx) => {
    // See if an answer row already exists for this inspection + field
    const existing = await tx
      .select()
      .from(answers)
      .where(and(eq(answers.inspectionId, inspectionId), eq(answers.fieldKey, fieldKey)));

    if (existing.length === 0) {
      const row: NewAnswer = {
        id: newId(),
        createdAt: updatedAt,
        updatedAt,
        deletedAt: null,
        syncStatus: "local",
        inspectionId,
        fieldKey,
        valueText: value.text ?? null,
        valueNumber: value.number ?? null,
        valueJson: value.json ? JSON.stringify(value.json) : null,
      } as NewAnswer;
      await tx.insert(answers).values(row);

      // append an insert outbox entry for the new answer
      await appendOutboxEntry(tx, {
        entityType: "answer",
        entityId: row.id,
        operation: "insert",
        payload: row,
      });

      return row as Answer;
    }

    // Update existing row
    const existingRow = existing[0] as Answer;
    const patch = {
      valueText: value.text ?? null,
      valueNumber: value.number ?? null,
      valueJson: value.json ? JSON.stringify(value.json) : null,
      updatedAt,
    };
    await tx.update(answers).set(patch).where(eq(answers.id, existingRow.id));

    // Keep the outbox compact: one pending entry per answer, holding the
    // latest state, instead of one per autosave.
    //
    // But the KIND of that entry matters (docs/DESIGN.md D-041). If an INSERT
    // for this answer hasn't been sent yet, the server has never seen the row,
    // so it must stay an INSERT — replacing it with an UPDATE (what this code
    // used to do, by deleting every entry for the answer) made the server's
    // update match nothing, and the answer never reached the server. So: fold
    // the new values into the pending insert's payload and stop.
    const pending = await tx.select().from(outbox).where(eq(outbox.entityId, existingRow.id));
    const pendingInsert = pending.find((o) => o.operation === "insert");
    if (pendingInsert) {
      const latestRow = { ...existingRow, ...patch };
      await tx
        .update(outbox)
        .set({ payloadJson: JSON.stringify(latestRow) })
        .where(eq(outbox.id, pendingInsert.id));
      return latestRow as Answer;
    }

    // Otherwise the server already has the row: replace any pending update
    // with a fresh one carrying the latest values.
    await tx.delete(outbox).where(eq(outbox.entityId, existingRow.id));

    // The outbox payload uses the exact same column names as `patch` above
    // (valueText/valueNumber/valueJson) — not the `saveAnswer(...)` caller's
    // own `{ text, number, json }` argument names. Phase 3's push logic
    // (src/lib/syncEngine.ts) reads this JSON straight into a SQL update by
    // column name; a mismatch here would silently write nothing server-side
    // (found and fixed during Phase 3 Day 2 — docs/DESIGN.md D-019).
    await appendOutboxEntry(tx, {
      entityType: "answer",
      entityId: existingRow.id,
      operation: "update",
      payload: { inspectionId, fieldKey, ...patch },
    });

    const updated = await tx.select().from(answers).where(eq(answers.id, existingRow.id));
    return updated[0] as Answer;
  });
}

/** Sync-engine only — see the identical note on `setProjectSyncStatus` in projects.ts. */
export async function setAnswerSyncStatus(id: string, status: SyncStatus): Promise<void> {
  if (!isDbAvailable()) return;
  const db = requireDb();
  await db.update(answers).set({ syncStatus: status }).where(eq(answers.id, id));
}

/** Sync-engine only (src/lib/syncPull.ts) — see the identical note on `applyPulledProject` in projects.ts. */
export async function applyPulledAnswer(row: Omit<NewAnswer, "syncStatus">): Promise<void> {
  if (!isDbAvailable()) return;
  const db = requireDb();
  const values: NewAnswer = { ...row, syncStatus: "synced" };
  await db.insert(answers).values(values).onConflictDoUpdate({ target: answers.id, set: values });
}

/** Day 5, sync-engine only — see the identical note on `applyServerFieldMerge` in projects.ts. */
export async function applyServerFieldMerge(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!isDbAvailable()) return;
  if (Object.keys(patch).length === 0) return;
  const db = requireDb();
  await db
    .update(answers)
    .set(patch as Partial<NewAnswer>)
    .where(eq(answers.id, id));
}
