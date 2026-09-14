// src/lib/conflictResolutionActions.ts
//
// What actually happens when a person picks a side in the manual
// resolution UI (Settings screen, plan Section 3.5.3): "record the choice
// as a normal edit so it syncs onward." Picking the server's value calls
// the entity's own normal update function — the exact same path a real
// screen edit takes — so the choice gets a fresh outbox entry and pushes
// like any other change. Picking "keep mine" needs no write at all: that
// value is already sitting in local storage with its own pending outbox
// entry already queued.

import { updateProject } from "@/repositories/projects";
import { updateInspection } from "@/repositories/inspections";
import { getAnswerById, saveAnswer } from "@/repositories/answers";
import { deleteConflict } from "@/repositories/conflicts";
import type { Conflict } from "@/db/schema";

export async function resolveConflictChoice(
  conflict: Conflict,
  choice: "local" | "server",
): Promise<void> {
  if (choice === "local") {
    // Nothing to write — this device's own pending edit already holds this
    // value and already has an outbox entry queued to push it.
    await deleteConflict(conflict.id);
    return;
  }

  const value = JSON.parse(conflict.serverValueJson);

  if (conflict.entityType === "project") {
    await updateProject(conflict.entityId, { [conflict.fieldKey]: value } as Record<
      string,
      unknown
    >);
  } else if (conflict.entityType === "inspection") {
    await updateInspection(conflict.entityId, { [conflict.fieldKey]: value } as Record<
      string,
      unknown
    >);
  } else if (conflict.entityType === "answer") {
    // Answers don't have a generic "update these fields" function — saving
    // one always goes through saveAnswer(inspectionId, fieldKey, value),
    // keyed by the field it actually stores in (value_text/value_number/
    // value_json), which the answer's OWN inspectionId/fieldKey (not the
    // conflict's fieldKey, which names the *column*, e.g. "valueText") supply.
    const answer = await getAnswerById(conflict.entityId);
    if (!answer) return; // the answer itself is gone — nothing left to resolve
    if (conflict.fieldKey === "valueNumber") {
      await saveAnswer(answer.inspectionId, answer.fieldKey, { number: value });
    } else if (conflict.fieldKey === "valueJson") {
      await saveAnswer(answer.inspectionId, answer.fieldKey, { json: value });
    } else {
      await saveAnswer(answer.inspectionId, answer.fieldKey, { text: value });
    }
  }

  await deleteConflict(conflict.id);
}
