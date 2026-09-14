// src/lib/syncPull.ts
//
// Day 4: pulls every row that changed on the server since the last pull,
// merges each into local SQLite, and only advances the cursor once the
// whole batch has applied. No conflict resolution yet (Day 5) — a row with
// its own still-pending outbox entry is left completely alone, exactly as
// the plan requires: "never overwrite a local row with unsynced pending
// changes; leave it for conflict handling."
//
// Unlike push (a single RPC, D-019), pull is plain reads through
// PostgREST — `supabase.from(table).select(...)` — because a read needs no
// atomicity across tables the way "check idempotency, then write" did.
// RLS already restricts every query to the signed-in user's own rows.

import { supabase } from "./supabase";
import { getLastSyncedAt, setLastSyncedAt } from "@/repositories/syncState";
import { listOutboxForEntity } from "@/repositories/outbox";
import { applyPulledProject } from "@/repositories/projects";
import { applyPulledInspection } from "@/repositories/inspections";
import { applyPulledAnswer } from "@/repositories/answers";
import type { InspectionStatus } from "@/db/schema";

export type PullResult = {
  pulled: number;
  merged: number;
  /** Left untouched because this device has its own unsynced edit pending — Day 5's job. */
  skippedForPendingLocalChange: number;
};

// The one starting point before any real pull has ever run — "everything
// is new." Not epoch-ms (this project's usual timestamp shape) on purpose:
// this cursor is compared directly against Postgres's `server_updated_at`
// (a `timestamptz`), so it's stored and compared in that same ISO-8601
// shape end to end (src/db/schema.ts's `syncState` comment explains why).
const EPOCH_ISO = "1970-01-01T00:00:00.000Z";

async function pullTable<Row extends { id: string; server_updated_at: string }>(
  table: "projects" | "inspections" | "answers",
  cursor: string,
  applyRow: (row: Row) => Promise<void>,
): Promise<{ maxServerUpdatedAt: string; pulled: number; merged: number; skipped: number }> {
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
  let skipped = 0;

  for (const row of rows) {
    // ISO-8601 timestamps in this fixed, UTC-offset shape sort correctly
    // as plain strings — the same property that lets `git log` timestamps
    // or log filenames sort right without parsing them back into dates
    // first. PostgREST returns every `timestamptz` in this project
    // consistently enough for that to hold.
    if (row.server_updated_at > maxServerUpdatedAt) {
      maxServerUpdatedAt = row.server_updated_at;
    }

    const pendingLocalChanges = await listOutboxForEntity(row.id);
    if (pendingLocalChanges.length > 0) {
      // This row has an unsynced local edit sitting in the outbox — apply
      // the incoming server version and that edit would simply vanish
      // with no record it ever happened. Day 5 decides what actually
      // happens when both sides changed; Day 4's job is only to not make
      // that decision by accident.
      skipped += 1;
      continue;
    }

    await applyRow(row);
    merged += 1;
  }

  return { maxServerUpdatedAt, pulled: rows.length, merged, skipped };
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
  const result: PullResult = { pulled: 0, merged: 0, skippedForPendingLocalChange: 0 };

  // Parents before children — same principle as push (D-019's ordering
  // rule) — even though local SQLite enforces no real foreign key (D-005),
  // applying in this order means "does this project exist yet" is already
  // true for every inspection merged right after it.
  const projectsResult = await pullTable<ProjectRow>("projects", cursor, (row) =>
    applyPulledProject({
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
  );

  const inspectionsResult = await pullTable<InspectionRow>("inspections", cursor, (row) =>
    applyPulledInspection({
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
  );

  const answersResult = await pullTable<AnswerRow>("answers", cursor, (row) =>
    applyPulledAnswer({
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
  );

  for (const r of [projectsResult, inspectionsResult, answersResult]) {
    result.pulled += r.pulled;
    result.merged += r.merged;
    result.skippedForPendingLocalChange += r.skipped;
    if (r.maxServerUpdatedAt > newestSeen) newestSeen = r.maxServerUpdatedAt;
  }

  if (newestSeen !== cursor) {
    await setLastSyncedAt(newestSeen);
  }

  return result;
}
