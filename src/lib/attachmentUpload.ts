// src/lib/attachmentUpload.ts
//
// Day 6, plan Section 3.6.1/3.6.2 — the special-cased push path for
// `entityType === "attachment"` outbox entries, called from
// `src/lib/syncEngine.ts#pushOne` instead of the plain `pushOutboxEntry`
// every other entity type uses.
//
// An attachment insert is really THREE things that all have to happen, not
// one:
//   1. Push the row itself (via `sync_push`'s `attachment` branch,
//      supabase/migrations/20260914000001_sync_push_attachments.sql) —
//      with `remoteUrl: null`, exactly matching what's actually true at
//      this point: the file hasn't uploaded yet.
//   2. Read the local file's bytes and upload them to Supabase Storage.
//   3. Push a second, small update — "the file landed, here's the path" —
//      filling `remote_url` for real.
//
// The whole three-step sequence is treated as ONE atomic-per-attempt
// operation: `pushOne` (syncEngine.ts) only deletes the outbox entry when
// this function returns `{ ok: true }`, which only happens after all three
// steps succeed. Kill the app — or lose connectivity — after step 1 but
// before step 3, and the outbox entry is simply still there, completely
// unmarked, exactly as if nothing had been attempted: the next drain redoes
// the whole sequence from the top. That replay is safe because every step
// is independently idempotent:
//   - Step 1 is `on conflict (id) do nothing` — a repeat is a no-op.
//   - Step 2 uploads with `upsert: true` — re-sending the same bytes to the
//     same path overwrites, it doesn't fail or duplicate.
//   - Step 3 sets `remote_url` to the same value it would already be, if a
//     previous attempt got that far — repeating it changes nothing.
// This is exactly plan Section 3.6.2's requirement: "confirm nothing is
// marked complete [after a killed upload] and the next run retries
// cleanly" — traced through the code, not exercised via an actual
// app-kill, since there's no physical device in this environment to kill
// (D-010). See docs/DESIGN.md D-023 for the full write-up, including the
// one deliberate loose end: step 3 uses a FRESH idempotency key on every
// retry (a real UUID, not reused), so a retried follow-up push leaves
// behind more than one row in `sync_idempotency_keys` for the same
// attachment. That's fine — that table is a dedup LOG, not user-facing
// data, and the update itself is naturally idempotent (setting the same
// remote_url twice is a no-op) — but it's not literally "one key per
// change" the way every other push in this app is, and that's worth being
// honest about rather than silently presenting it as identical to the rest.

import { supabase } from "./supabase";
import { pushRowOnly, pushOutboxEntry, type PushResult } from "./syncApi";
import { setAttachmentRemoteUrl } from "@/repositories/attachments";
import { newId } from "./id";
import { now } from "./time";
import type { OutboxEntry } from "@/db/schema";

const ATTACHMENTS_BUCKET = "attachments";

type AttachmentPayload = {
  id: string;
  inspectionId: string;
  fieldKey: string;
  localUri: string;
  remoteUrl: string | null;
  mimeType: string | null;
  byteSize: number | null;
  width: number | null;
  height: number | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

function extensionFromMimeType(mimeType: string | null | undefined): string {
  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      // Unknown/missing mime type: no extension rather than a guess that
      // could be wrong — the object still uploads and downloads fine
      // without one; it just won't get an OS-recognized file association
      // if someone downloads it directly from the Supabase dashboard.
      return "";
  }
}

export async function pushAndUploadAttachment(entry: OutboxEntry): Promise<PushResult> {
  // A pending DELETE for an attachment carries no file to upload — the row
  // tombstone is the whole story, so it goes through the same plain path
  // every other entity's delete already uses. (`createAttachment` never
  // produces an "update" outbox entry today — src/repositories/attachments.ts
  // only ever appends "insert" or "delete" — so this is the only branch.)
  if (entry.operation !== "insert") {
    return pushOutboxEntry(entry);
  }

  let payload: AttachmentPayload;
  try {
    payload = JSON.parse(entry.payloadJson) as AttachmentPayload;
  } catch (e) {
    return { ok: false, retryable: false, error: `Corrupt outbox payload: ${String(e)}` };
  }

  // Step 1: push the row (idempotent — see the file header).
  const rowResult = await pushRowOnly(entry.id, "attachment", entry.entityId, "insert", payload);
  if (!rowResult.ok) return rowResult;

  // Step 2: read the local file's bytes. Dynamic import — same reasoning as
  // src/lib/media.ts: this module must not crash to load in the web
  // preview, where native file access doesn't exist at all (D-010).
  let bytes: Uint8Array;
  try {
    const { File } = await import("expo-file-system");
    const file = new File(payload.localUri);
    if (!file.exists) {
      // The file is gone from this device (deleted, storage cleared) — no
      // retry will ever find it again. Permanent, not a network hiccup.
      return {
        ok: false,
        retryable: false,
        error: `Local file missing, can't upload: ${payload.localUri}`,
      };
    }
    bytes = await file.bytes();
  } catch (e) {
    // Anything else reading the file (a locked file, a transient FS error,
    // or expo-file-system genuinely not being available in this
    // environment) is treated as retryable — the next attempt may simply
    // work, and wrongly giving up drops a real photo silently, the worse
    // mistake (same reasoning src/lib/syncApi.ts#isRetryable documents).
    return { ok: false, retryable: true, error: `Could not read local file: ${String(e)}` };
  }

  // Step 3: who owns this upload? The storage path IS the ownership check
  // (supabase/migrations/20260914000002_attachment_storage.sql) — every
  // object lives under `{owner_id}/...`, so RLS can read ownership straight
  // out of the path with no owner_id column on storage.objects at all.
  // getSession() reads the stored session; getUser() makes a NETWORK call. With
  // getUser(), a signal that dropped between the row push above and this line
  // returned "Not signed in" as a PERMANENT failure and dead-lettered a good
  // photo (D-042).
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) {
    return { ok: false, retryable: false, error: "Not signed in — cannot upload attachment" };
  }
  const path = `${userId}/${entry.entityId}${extensionFromMimeType(payload.mimeType)}`;

  // Step 4: upload. `upsert: true` is what makes a retried upload safe —
  // see the file header.
  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(path, bytes, {
      contentType: payload.mimeType ?? "application/octet-stream",
      upsert: true,
    });
  if (uploadError) {
    // Storage errors that came from the server carry an HTTP status; one
    // without means the request never got an answer (no signal).
    const status = (uploadError as { status?: number; statusCode?: string | number }).status ??
      (uploadError as { statusCode?: string | number }).statusCode;
    return {
      ok: false,
      retryable: true,
      unreachable: status === undefined,
      error: `Upload failed: ${uploadError.message}`,
    };
  }

  // Step 5: "the file landed, here's remote_url" — a second, small push,
  // its own fresh idempotency key (see the file header for why reusing
  // `entry.id` isn't possible: that key already named the row INSERT).
  const followUpResult = await pushRowOnly(newId(), "attachment", entry.entityId, "update", {
    id: entry.entityId,
    remoteUrl: path,
    updatedAt: now(),
  });
  if (!followUpResult.ok) return followUpResult;

  // Mirror remote_url onto the local row too, so this device knows its own
  // upload succeeded without waiting for a pull to bring it back down.
  await setAttachmentRemoteUrl(entry.entityId, path);

  return { ok: true, duplicate: rowResult.duplicate };
}
