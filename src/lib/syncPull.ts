// src/lib/syncPull.ts
//
// Pulls every row that changed on the server since the last pull, merges
// each into local SQLite, and only advances the cursor once the whole
// batch has applied. A row with no pending local edit is a plain upsert
// (Day 4). A row that DOES have a pending local edit is where Day 5's
// conflict policy (src/lib/conflict.ts, plan Section 5) actually runs:
// some fields resolve automatically, some get flagged for a person
// (src/repositories/conflicts.ts), and an incoming delete always wins over
// a stale local edit (the resurrection-prevention property, D-021).
//
// Unlike push (a single RPC, D-019), pull is plain reads through
// PostgREST — `supabase.from(table).select(...)` — because a read needs no
// atomicity across tables the way "check idempotency, then write" did.
// RLS already restricts every query to the signed-in user's own rows.

import { supabase } from "./supabase";
import { getLastSyncedAt, setLastSyncedAt } from "@/repositories/syncState";
import { listOutboxForEntity, deleteOutboxEntry } from "@/repositories/outbox";
import {
  getProject,
  applyPulledProject,
  applyServerFieldMerge as mergeProjectFields,
} from "@/repositories/projects";
import {
  getInspection,
  applyPulledInspection,
  applyServerFieldMerge as mergeInspectionFields,
} from "@/repositories/inspections";
import {
  getAnswerById,
  applyPulledAnswer,
  applyServerFieldMerge as mergeAnswerFields,
} from "@/repositories/answers";
import {
  getAttachmentById,
  applyPulledAttachment,
  applyServerFieldMerge as mergeAttachmentFields,
} from "@/repositories/attachments";
import { recordConflict, deleteConflictsForEntity } from "@/repositories/conflicts";
import { resolveConflict } from "./conflict";
import type { InspectionStatus, OutboxEntry } from "@/db/schema";

export type PullResult = {
  pulled: number;
  merged: number;
  /** R1/R2/R3 — resolved automatically, no local row was left alone. */
  autoResolved: number;
  /** R7 — flagged in the `conflicts` table for a person to look at. */
  flaggedForManualResolution: number;
};

// The one starting point before any real pull has ever run — "everything
// is new." Not epoch-ms (this project's usual timestamp shape) on purpose:
// this cursor is compared directly against Postgres's `server_updated_at`
// (a `timestamptz`), so it's stored and compared in that same ISO-8601
// shape end to end (src/db/schema.ts's `syncState` comment explains why).
const EPOCH_ISO = "1970-01-01T00:00:00.000Z";

// Columns that are never a meaningful "which side wins" question on their
// own — identifiers, timestamps, and (for inspections) the fields nothing
// in this app's UI actually lets two people edit concurrently in a way
// worth flagging. `deletedAt` is handled separately (resolveConflict's
// delete-wins/own-delete-proceeds branches) — never compared field-by-field.
const COMMON_IGNORE_FIELDS = ["id", "createdAt", "updatedAt", "deletedAt"];

type EntityHandlers<Row> = {
  entityType: OutboxEntry["entityType"];
  toLocalFields: (row: Row) => Record<string, unknown>;
  getLocalRow: (id: string) => Promise<Record<string, unknown> | null>;
  applyFullRow: (fields: Record<string, unknown>) => Promise<void>;
  applyFieldMerge: (id: string, patch: Record<string, unknown>) => Promise<void>;
  ignoreFields: string[];
};

async function pullTable<Row extends { id: string; server_updated_at: string }>(
  table: "projects" | "inspections" | "answers" | "attachments",
  cursor: string,
  handlers: EntityHandlers<Row>,
): Promise<{
  maxServerUpdatedAt: string;
  pulled: number;
  merged: number;
  autoResolved: number;
  flagged: number;
}> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .gt("server_updated_at", cursor)
    .order("server_updated_at", { ascending: true });

  if (error) {
    throw new Error(`Pull failed (${table}): ${error.message}`);
  }

  const rows = (data ?? []) as Row[];
  let maxServerUpdatedAt = cursor;
  let merged = 0;
  let autoResolved = 0;
  let flagged = 0;

  for (const row of rows) {
    // ISO-8601 timestamps in this fixed, UTC-offset shape sort correctly
    // as plain strings — the same property that lets `git log` timestamps
    // or log filenames sort right without parsing them back into dates
    // first. PostgREST returns every `timestamptz` in this project
    // consistently enough for that to hold.
    if (row.server_updated_at > maxServerUpdatedAt) {
      maxServerUpdatedAt = row.server_updated_at;
    }

    const serverFields = handlers.toLocalFields(row);
    const pendingEntries = await listOutboxForEntity(row.id);

    if (pendingEntries.length === 0) {
      // No local conflict of any kind — the plain Day 4 case.
      await handlers.applyFullRow(serverFields);
      merged += 1;
      continue;
    }

    const localRow = await handlers.getLocalRow(row.id);
    if (!localRow) {
      // Outbox row exists but the local entity itself is gone — nothing
      // sensible to reconcile against; treat it like the no-conflict case.
      await handlers.applyFullRow(serverFields);
      merged += 1;
      continue;
    }

    const dirtyFields = new Set<string>();
    let hasPendingDelete = false;
    for (const entry of pendingEntries) {
      if (entry.operation === "delete") hasPendingDelete = true;
      try {
        const payload = JSON.parse(entry.payloadJson) as Record<string, unknown>;
        for (const key of Object.keys(payload)) {
          if (!handlers.ignoreFields.includes(key)) dirtyFields.add(key);
        }
      } catch {
        // A malformed payload can't tell us which fields it touched —
        // src/lib/syncApi.ts already treats this as a permanent push
        // failure elsewhere; here it just contributes nothing to dirtyFields.
      }
    }
    const localPendingChangedAt = Math.max(...pendingEntries.map((e) => e.createdAt));

    const resolution = resolveConflict({
      localRow,
      serverRow: serverFields,
      dirtyFields,
      hasPendingDelete,
      localPendingChangedAt,
      serverUpdatedAtMs: new Date(row.server_updated_at).getTime(),
      ignoreFields: handlers.ignoreFields,
    });

    if (resolution.kind === "delete-wins") {
      // R4/R5: the server's tombstone wins outright. This device's pending
      // edit(s) for this entity are discarded — pushing them onward would
      // just be editing something that's already gone — and any open
      // manual-resolution conflicts on it stop mattering too.
      for (const entry of pendingEntries) {
        await deleteOutboxEntry(entry.id);
      }
      await deleteConflictsForEntity(row.id);
      await handlers.applyFullRow(serverFields);
      merged += 1;
      continue;
    }

    if (resolution.kind === "own-delete-proceeds") {
      // This device's own pending delete takes priority locally; let it
      // push normally on the next drain. Nothing to merge from the server
      // into a row that's about to be deleted anyway.
      continue;
    }

    // resolution.kind === "fields": apply whatever's safe now, flag the rest.
    const mergePatch: Record<string, unknown> = {};
    for (const fieldResolution of resolution.resolutions) {
      if (fieldResolution.action === "take-server") {
        mergePatch[fieldResolution.field] = fieldResolution.value;
      } else if (fieldResolution.action === "manual") {
        await recordConflict({
          entityType: handlers.entityType,
          entityId: row.id,
          fieldKey: fieldResolution.field,
          localValueJson: JSON.stringify(fieldResolution.localValue),
          serverValueJson: JSON.stringify(fieldResolution.serverValue),
        });
        flagged += 1;
      }
      // "keep-local" needs no write at all — local's pending value already
      // stands, and its own outbox entry is already queued to push it.
    }

    await handlers.applyFieldMerge(row.id, mergePatch);
    autoResolved += 1;
  }

  return { maxServerUpdatedAt, pulled: rows.length, merged, autoResolved, flagged };
}

type ProjectRow = {
  id: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  server_updated_at: string;
  name: string;
  client_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
};

type InspectionRow = {
  id: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  server_updated_at: string;
  project_id: string;
  template_id: string | null;
  title: string;
  status: string;
  inspector_name: string | null;
  started_at: number | null;
  completed_at: number | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
};

type AnswerRow = {
  id: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  server_updated_at: string;
  inspection_id: string;
  field_key: string;
  value_text: string | null;
  value_number: number | null;
  value_json: string | null;
};

const projectHandlers: EntityHandlers<ProjectRow> = {
  entityType: "project",
  ignoreFields: COMMON_IGNORE_FIELDS,
  toLocalFields: (row) => ({
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    name: row.name,
    clientName: row.client_name,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    notes: row.notes,
  }),
  getLocalRow: (id) => getProject(id) as Promise<Record<string, unknown> | null>,
  applyFullRow: (fields) => applyPulledProject(fields as Parameters<typeof applyPulledProject>[0]),
  applyFieldMerge: mergeProjectFields,
};

const inspectionHandlers: EntityHandlers<InspectionRow> = {
  entityType: "inspection",
  ignoreFields: [...COMMON_IGNORE_FIELDS, "projectId", "templateId"],
  toLocalFields: (row) => ({
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    projectId: row.project_id,
    templateId: row.template_id,
    title: row.title,
    // Server-side `status` is plain `text` (no SQL enum/CHECK, matching
    // this project's local schema convention) — narrowed to the real
    // union here, the same trust boundary `InspectionDetailScreen`
    // already crosses when it writes a status value in the first place.
    status: row.status as InspectionStatus,
    inspectorName: row.inspector_name,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    latitude: row.latitude,
    longitude: row.longitude,
    notes: row.notes,
  }),
  getLocalRow: (id) => getInspection(id) as Promise<Record<string, unknown> | null>,
  applyFullRow: (fields) =>
    applyPulledInspection(fields as Parameters<typeof applyPulledInspection>[0]),
  applyFieldMerge: mergeInspectionFields,
};

type AttachmentRow = {
  id: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  server_updated_at: string;
  inspection_id: string;
  field_key: string;
  local_uri: string | null;
  remote_url: string | null;
  mime_type: string | null;
  byte_size: number | null;
  width: number | null;
  height: number | null;
};

const answerHandlers: EntityHandlers<AnswerRow> = {
  entityType: "answer",
  ignoreFields: [...COMMON_IGNORE_FIELDS, "inspectionId", "fieldKey"],
  toLocalFields: (row) => ({
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    inspectionId: row.inspection_id,
    fieldKey: row.field_key,
    valueText: row.value_text,
    valueNumber: row.value_number,
    valueJson: row.value_json,
  }),
  getLocalRow: (id) => getAnswerById(id) as Promise<Record<string, unknown> | null>,
  applyFullRow: (fields) => applyPulledAnswer(fields as Parameters<typeof applyPulledAnswer>[0]),
  applyFieldMerge: mergeAnswerFields,
};

// Day 7 — plan Section 5.1's R6 ("Attachments — never conflict, unique
// IDs, keep both"). See src/repositories/attachments.ts#applyPulledAttachment
// for why this handler's `applyFieldMerge` branch is realistically dead
// code: an attachment id is generated once, on the device that captured
// it, so a pending LOCAL outbox entry for that same id can only ever exist
// on that SAME device — by the time any device pulls a given attachment
// row, the device that created it has already pushed it successfully and
// its own outbox entry is already gone. Every pull of an attachment is
// structurally the plain-upsert case, which is exactly what "never
// conflict, keep both" means in practice, not just by convention.
const attachmentHandlers: EntityHandlers<AttachmentRow> = {
  entityType: "attachment",
  ignoreFields: [...COMMON_IGNORE_FIELDS, "inspectionId", "fieldKey"],
  toLocalFields: (row) => ({
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    inspectionId: row.inspection_id,
    fieldKey: row.field_key,
    // Deliberately NO `localUri` here — a pulled row's `local_uri` is
    // another device's own filesystem path, meaningless (and actively
    // wrong) to store as if it described a file on THIS device.
    // `src/repositories/attachments.ts#applyPulledAttachment` decides the
    // right local_uri to store on its own (null for a genuinely new row,
    // untouched for one this device already knows about) — see its comment
    // and `src/db/schema.ts`'s D-025 for the full reasoning.
    remoteUrl: row.remote_url,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
  }),
  getLocalRow: (id) => getAttachmentById(id) as Promise<Record<string, unknown> | null>,
  applyFullRow: (fields) =>
    applyPulledAttachment(fields as Parameters<typeof applyPulledAttachment>[0]),
  applyFieldMerge: mergeAttachmentFields,
};

/**
 * Pulls and merges changes from every synced table, oldest cursor to
 * newest, then advances the local cursor to the newest `server_updated_at`
 * actually seen — but only after every table's rows have applied
 * successfully. If this throws partway through, the cursor is untouched:
 * the next pull re-fetches the same rows (a plain upsert, so re-applying
 * them is harmless) rather than silently skipping whatever didn't finish.
 */
export async function pullChanges(): Promise<PullResult> {
  const cursor = (await getLastSyncedAt()) ?? EPOCH_ISO;
  let newestSeen = cursor;
  const result: PullResult = {
    pulled: 0,
    merged: 0,
    autoResolved: 0,
    flaggedForManualResolution: 0,
  };

  // Parents before children — same principle as push (D-019's ordering
  // rule) — even though local SQLite enforces no real foreign key (D-005),
  // applying in this order means "does this project exist yet" is already
  // true for every inspection merged right after it.
  const projectsResult = await pullTable<ProjectRow>("projects", cursor, projectHandlers);
  const inspectionsResult = await pullTable<InspectionRow>(
    "inspections",
    cursor,
    inspectionHandlers,
  );
  const answersResult = await pullTable<AnswerRow>("answers", cursor, answerHandlers);
  // Attachments reference an inspection too (`inspection_id`) — same
  // parents-before-children reasoning, pulled after inspections.
  const attachmentsResult = await pullTable<AttachmentRow>(
    "attachments",
    cursor,
    attachmentHandlers,
  );

  for (const r of [projectsResult, inspectionsResult, answersResult, attachmentsResult]) {
    result.pulled += r.pulled;
    result.merged += r.merged;
    result.autoResolved += r.autoResolved;
    result.flaggedForManualResolution += r.flagged;
    if (r.maxServerUpdatedAt > newestSeen) newestSeen = r.maxServerUpdatedAt;
  }

  if (newestSeen !== cursor) {
    await setLastSyncedAt(newestSeen);
  }

  return result;
}
