// src/repositories/attachments.ts
//
// Simple attachments repository for Phase 2. Responsible for creating and
// deleting attachment rows. File creation/deletion is handled by the UI
// layer (camera/compression) which writes a file and then calls this API to
// record it in SQLite (so every file has a DB row and an outbox entry).

import { eq } from "drizzle-orm";
import { isDbAvailable, requireDb } from "@/db/client";
import { attachments, type Attachment, type NewAttachment, type SyncStatus } from "@/db/schema";
import { newId } from "@/lib/id";
import { now } from "@/lib/time";
import { appendOutboxEntry } from "./outbox";
import * as mock from "@/db/mockStore";

export async function listAttachmentsForInspection(inspectionId: string): Promise<Attachment[]> {
  if (!isDbAvailable()) return mock.listAttachmentsForInspection(inspectionId);
  const db = requireDb();
  return db.select().from(attachments).where(eq(attachments.inspectionId, inspectionId));
}

export async function createAttachment(args: {
  inspectionId: string;
  fieldKey: string;
  localUri: string;
  mimeType?: string | null;
  byteSize?: number | null;
  width?: number | null;
  height?: number | null;
}): Promise<Attachment> {
  if (!isDbAvailable()) return mock.createAttachment(args as any);
  const db = requireDb();
  const row: NewAttachment = {
    id: newId(),
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
    syncStatus: "local",
    inspectionId: args.inspectionId,
    fieldKey: args.fieldKey,
    localUri: args.localUri,
    remoteUrl: null,
    mimeType: args.mimeType ?? null,
    byteSize: args.byteSize ?? null,
    width: args.width ?? null,
    height: args.height ?? null,
  } as NewAttachment;

  await db.transaction(async (tx) => {
    await tx.insert(attachments).values(row);
    await appendOutboxEntry(tx, {
      entityType: "attachment",
      entityId: row.id,
      operation: "insert",
      payload: row,
    });
  });

  return row as Attachment;
}

/**
 * Day 6, sync-engine only (src/lib/attachmentUpload.ts) — same shape and
 * same reasoning as `setProjectSyncStatus`: no transaction, no outbox
 * write. Reports how the push-and-upload attempt is going; doesn't
 * represent a new thing the user did.
 */
export async function setAttachmentSyncStatus(id: string, status: SyncStatus): Promise<void> {
  if (!isDbAvailable()) return;
  const db = requireDb();
  await db.update(attachments).set({ syncStatus: status }).where(eq(attachments.id, id));
}

/**
 * Day 6, sync-engine only — mirrors the storage object path this device's
 * OWN upload just wrote onto the local row, the moment the whole
 * push-and-upload sequence (src/lib/attachmentUpload.ts) succeeds. Not
 * strictly required for correctness (the server already has it, and a
 * later pull would bring it down too) but means this device doesn't have
 * to wait for a round-trip pull to know its own upload actually landed.
 * No transaction, no outbox entry — same reasoning as `setAttachmentSyncStatus`.
 */
export async function setAttachmentRemoteUrl(id: string, remoteUrl: string): Promise<void> {
  if (!isDbAvailable()) return;
  const db = requireDb();
  await db.update(attachments).set({ remoteUrl }).where(eq(attachments.id, id));
}

/**
 * Day 7, sync-engine only (src/lib/syncPull.ts) — the `getLocalRow` half of
 * an `EntityHandlers` entry, same role as `getProject`/`getInspection` play
 * for the other three synced entities. Deliberately does NOT filter
 * `isNull(deletedAt)` the way the public `listAttachmentsForInspection`
 * does — the pull loop needs to find a soft-deleted local row too, the same
 * reasoning `getAnswerById` (Day 4) already documents.
 */
export async function getAttachmentById(id: string): Promise<Attachment | null> {
  if (!isDbAvailable()) return null;
  const db = requireDb();
  const rows = await db.select().from(attachments).where(eq(attachments.id, id));
  return rows[0] ?? null;
}

/**
 * Day 7, sync-engine only (src/lib/syncPull.ts) — a full-row upsert for a
 * row that just arrived from the server, same role as `applyPulledProject`,
 * with ONE deliberate difference: `local_uri` is never written by this
 * function's UPDATE path, and always written as `null` on its INSERT path
 * — never copied from the server's copy of it. A server-side `local_uri` is
 * always some OTHER device's filesystem path (the one that originally
 * created this attachment) — meaningless, and actively wrong, to store as
 * if it described a file on THIS device (`src/db/schema.ts`'s D-025
 * comment). Concretely: a brand-new-to-this-device row inserts with
 * `local_uri = null` ("no local file exists here"); a row this device
 * already knows about (most commonly its OWN attachment, echoed back by a
 * later pull after its push already succeeded) keeps whatever `local_uri`
 * it already had, completely untouched by the conflict-branch UPDATE —
 * never overwritten with a foreign path, and never wrongly nulled out
 * either.
 *
 * Unlike the other three entities, this one is never actually expected to
 * run into the *conflicted* branch of `pullTable` at all — plan Section
 * 5.1's R6 ("Attachments — never conflict, unique IDs, keep both") holds
 * structurally here, not just by policy: an attachment's `id` is generated
 * once, on the device that captured it, and a row with a pending LOCAL
 * outbox entry for that same id can only exist on THAT same device — by the
 * time any other device could ever pull it, this device's own push has
 * already succeeded and its outbox entry is already gone. So every
 * attachment pull is structurally this plain-upsert case;
 * `applyServerFieldMerge` below exists only so `attachmentHandlers` has the
 * same shape as the other three entities' handlers, not because it's
 * expected to ever actually run.
 */
export async function applyPulledAttachment(
  row: Omit<NewAttachment, "syncStatus" | "localUri">,
): Promise<void> {
  if (!isDbAvailable()) return;
  const db = requireDb();
  const insertValues: NewAttachment = { ...row, localUri: null, syncStatus: "synced" };
  // Every column EXCEPT local_uri — deliberately left out of the ON
  // CONFLICT SET clause so an existing local row's own value survives.
  const { localUri: _localUriExcluded, ...updateOnConflict } = insertValues;
  await db
    .insert(attachments)
    .values(insertValues)
    .onConflictDoUpdate({ target: attachments.id, set: updateOnConflict });
}

/** Day 7, sync-engine only — see the note on `applyPulledAttachment` above for why this realistically never runs. Kept for shape-parity with the other three repositories' `EntityHandlers`. */
export async function applyServerFieldMerge(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!isDbAvailable()) return;
  if (Object.keys(patch).length === 0) return;
  const db = requireDb();
  await db
    .update(attachments)
    .set(patch as Partial<NewAttachment>)
    .where(eq(attachments.id, id));
}

export async function deleteAttachment(id: string): Promise<void> {
  if (!isDbAvailable()) return mock.deleteAttachment(id);
  const db = requireDb();
  const deletedAt = now();
  await db.transaction(async (tx) => {
    await tx
      .update(attachments)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(eq(attachments.id, id));
    await appendOutboxEntry(tx, {
      entityType: "attachment",
      entityId: id,
      operation: "delete",
      payload: { id, deletedAt },
    });
  });
}
