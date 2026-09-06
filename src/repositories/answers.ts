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
import { answers, outbox, type Answer, type NewAnswer } from "@/db/schema";
import { newId } from "@/lib/id";
import { now } from "@/lib/time";
import { appendOutboxEntry } from "./outbox";
import * as mock from "@/db/mockStore";

export async function getAnswers(inspectionId: string): Promise<Answer[]> {
  if (!isDbAvailable()) return mock.getAnswers(inspectionId);
  const db = requireDb();
  return db.select().from(answers).where(and(eq(answers.inspectionId, inspectionId), isNull(answers.deletedAt)));
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

    const payload: any = { inspectionId, fieldKey, updatedAt, ...value };

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
    await tx
      .update(answers)
      .set({
        valueText: value.text ?? null,
        valueNumber: value.number ?? null,
        valueJson: value.json ? JSON.stringify(value.json) : null,
        updatedAt,
      })
      .where(eq(answers.id, existingRow.id));

    // Instead of appending a new outbox row per autosave, remove any existing
    // pending "update" outbox entries for this answer and append a fresh one.
    // This keeps the outbox compact while preserving the latest state.
    // (Phase 3 could also choose to dedupe on drain; either is acceptable.)
    await tx.delete(outbox).where(eq(outbox.entityId, existingRow.id));

    await appendOutboxEntry(tx, {
      entityType: "answer",
      entityId: existingRow.id,
      operation: "update",
      payload,
    });

    const updated = await tx.select().from(answers).where(eq(answers.id, existingRow.id));
    return updated[0] as Answer;
  });
}
