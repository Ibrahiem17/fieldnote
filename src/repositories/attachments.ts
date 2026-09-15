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
