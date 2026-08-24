// src/db/schema.ts
//
// The complete shape of the on-device database: six tables, in TypeScript,
// checked by the compiler instead of only discovered when a raw SQL string
// fails at runtime. This file is the single source of truth — the actual
// SQLite file is generated from it via `npm run db:generate` (Section 2.7,
// 2.6 of the Phase 1 plan).
//
// Every table except `outbox` carries five columns in common. Rather than
// repeat them six times, `commonColumns()` builds that object once and each
// table spreads it in.

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Shared columns
// ---------------------------------------------------------------------------

/**
 * The five columns every entity table carries. See Section 4.1 of the
 * Phase 1 plan for why each one exists:
 *  - id            device-generated UUID, works with no server
 *  - created_at    epoch ms, for ordering and display
 *  - updated_at    epoch ms, Phase 3 compares these to resolve sync conflicts
 *  - deleted_at    epoch ms or null — a *soft* delete, so a delete can sync
 *  - sync_status   local/pending/syncing/synced/failed/conflict; Phase 3 drives it
 */
function commonColumns() {
  return {
    id: text("id").primaryKey(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
    syncStatus: text("sync_status").notNull().default("local"),
  };
}

// ---------------------------------------------------------------------------
// projects — a site or client engagement
// ---------------------------------------------------------------------------

export const projects = sqliteTable("projects", {
  ...commonColumns(),
  name: text("name").notNull(),
  clientName: text("client_name"),
  address: text("address"),
  latitude: integer("latitude", { mode: "number" }),
  longitude: integer("longitude", { mode: "number" }),
});

// ---------------------------------------------------------------------------
// templates — a reusable checklist definition
// ---------------------------------------------------------------------------

export const templates = sqliteTable("templates", {
  ...commonColumns(),
  name: text("name").notNull(),
  version: integer("version").notNull().default(1),
  // The JSON that Phase 2's form engine renders into fields. Phase 1 only
  // ever displays `name` — this column is stored now so Phase 2 doesn't
  // need a migration to add it.
  schemaJson: text("schema_json").notNull(),
});

// ---------------------------------------------------------------------------
// inspections — one visit to one site
// ---------------------------------------------------------------------------

export const INSPECTION_STATUSES = ["draft", "in_progress", "completed", "submitted"] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export const inspections = sqliteTable(
  "inspections",
  {
    ...commonColumns(),
    projectId: text("project_id").notNull(),
    templateId: text("template_id"),
    title: text("title").notNull(),
    // Stored as plain text, not a SQL enum — SQLite has no enum type.
    // `InspectionStatus` above is what keeps this constrained in TypeScript.
    status: text("status").$type<InspectionStatus>().notNull().default("draft"),
    inspectorName: text("inspector_name"),
    startedAt: integer("started_at"),
    completedAt: integer("completed_at"),
    latitude: integer("latitude", { mode: "number" }),
    longitude: integer("longitude", { mode: "number" }),
    notes: text("notes"),
  },
  (table) => [
    // "Which inspections belong to project X?" — asked on every Projects
    // detail screen and every filter. Without this index SQLite scans every
    // row; with it, a direct lookup.
    index("inspections_project_id_idx").on(table.projectId),
    // "Which inspections are still drafts?" — the status filter.
    index("inspections_status_idx").on(table.status),
    // Sorting the list by most-recently-changed first.
    index("inspections_updated_at_idx").on(table.updatedAt),
  ],
);

// ---------------------------------------------------------------------------
// answers — one row per answered field (Phase 2 writes here; created now so
// Phase 2 doesn't need its own migration)
// ---------------------------------------------------------------------------

export const answers = sqliteTable(
  "answers",
  {
    ...commonColumns(),
    inspectionId: text("inspection_id").notNull(),
    fieldKey: text("field_key").notNull(),
    valueText: text("value_text"),
    valueNumber: integer("value_number", { mode: "number" }),
    valueJson: text("value_json"),
  },
  (table) => [index("answers_inspection_id_idx").on(table.inspectionId)],
);

// ---------------------------------------------------------------------------
// attachments — photos and signatures (Phase 2)
// ---------------------------------------------------------------------------

export const attachments = sqliteTable(
  "attachments",
  {
    ...commonColumns(),
    inspectionId: text("inspection_id").notNull(),
    fieldKey: text("field_key").notNull(),
    // A file path on the device, never the image bytes themselves — storing
    // base64 blobs in SQLite wrecks both performance and memory (Section 4.2.5).
    localUri: text("local_uri").notNull(),
    remoteUrl: text("remote_url"),
    mimeType: text("mime_type"),
    byteSize: integer("byte_size", { mode: "number" }),
    width: integer("width", { mode: "number" }),
    height: integer("height", { mode: "number" }),
  },
  (table) => [index("attachments_inspection_id_idx").on(table.inspectionId)],
);

// ---------------------------------------------------------------------------
// outbox — the sync queue (Section 2.9). Deliberately does NOT share
// commonColumns(): an outbox row is never itself synced, edited or soft
// deleted, so updated_at/deleted_at/sync_status would be meaningless here.
// ---------------------------------------------------------------------------

export const OUTBOX_OPERATIONS = ["insert", "update", "delete"] as const;
export type OutboxOperation = (typeof OUTBOX_OPERATIONS)[number];

export const outbox = sqliteTable(
  "outbox",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    operation: text("operation").$type<OutboxOperation>().notNull(),
    payloadJson: text("payload_json").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    nextAttemptAt: integer("next_attempt_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    // Phase 3's sync worker asks "what's due to retry right now?" — this is
    // that query's index.
    index("outbox_next_attempt_at_idx").on(table.nextAttemptAt),
  ],
);

// ---------------------------------------------------------------------------
// Inferred TypeScript types — one source of truth, no hand-written duplicates
// ---------------------------------------------------------------------------

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;

export type Inspection = typeof inspections.$inferSelect;
export type NewInspection = typeof inspections.$inferInsert;

export type Answer = typeof answers.$inferSelect;
export type NewAnswer = typeof answers.$inferInsert;

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;

export type OutboxEntry = typeof outbox.$inferSelect;
export type NewOutboxEntry = typeof outbox.$inferInsert;
