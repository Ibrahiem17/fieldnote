// src/repositories/inspections.ts
//
// Matches the contract in Section 5.1 of the Phase 1 plan exactly. This is
// the busiest repository in the app — every screen in the Inspections tab
// goes through here, and Phase 2's answers/attachments repositories will
// follow the same shape.

import { and, desc, eq, isNull } from "drizzle-orm";

import { isDbAvailable, requireDb } from "@/db/client";
import {
  inspections,
  type Inspection,
  type InspectionStatus,
  type NewInspection,
} from "@/db/schema";
import { newId } from "@/lib/id";
import { now } from "@/lib/time";
import { appendOutboxEntry } from "./outbox";
import * as mock from "@/db/mockStore";

export type NewInspectionInput = Pick<NewInspection, "projectId" | "title"> &
  Partial<Pick<NewInspection, "templateId" | "inspectorName" | "notes">>;

export type InspectionFilter = {
  projectId?: string;
  status?: InspectionStatus;
};

/**
 * Every inspection not soft-deleted, optionally narrowed by project and/or
 * status, newest-updated first. `filter?` — the `?` makes the whole
 * argument optional, so `listInspections()` with nothing works too.
 */
export async function listInspections(filter?: InspectionFilter): Promise<Inspection[]> {
  // Preview mode (docs/DESIGN.md D-013): the real database couldn't open
  // (confirmed browser limitation, D-010) — every read/create/edit/delete
  // in this file falls back to an in-memory store instead, so the actual
  // screens still have something real to render.
  if (!isDbAvailable()) return mock.listInspections(filter);
  const db = requireDb();

  const conditions = [isNull(inspections.deletedAt)];
  if (filter?.projectId) {
    conditions.push(eq(inspections.projectId, filter.projectId));
  }
  if (filter?.status) {
    conditions.push(eq(inspections.status, filter.status));
  }

  return db
    .select()
    .from(inspections)
    .where(and(...conditions))
    .orderBy(desc(inspections.updatedAt));
}

export async function getInspection(id: string): Promise<Inspection | null> {
  if (!isDbAvailable()) return mock.getInspection(id);
  const db = requireDb();
  const rows = await db
    .select()
    .from(inspections)
    .where(and(eq(inspections.id, id), isNull(inspections.deletedAt)));
  return rows[0] ?? null;
}

export async function createInspection(input: NewInspectionInput): Promise<Inspection> {
  if (!isDbAvailable()) return mock.createInspection(input);
  const db = requireDb();

  const row: NewInspection = {
    id: newId(),
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
    syncStatus: "local",
    projectId: input.projectId,
    templateId: input.templateId ?? null,
    title: input.title,
    status: "draft",
    inspectorName: input.inspectorName ?? null,
    startedAt: now(),
    completedAt: null,
    latitude: null,
    longitude: null,
    notes: input.notes ?? null,
  };

  await db.transaction(async (tx) => {
    await tx.insert(inspections).values(row);
    await appendOutboxEntry(tx, {
      entityType: "inspection",
      entityId: row.id,
      operation: "insert",
      payload: row,
    });
  });

  return row as Inspection;
}

export async function updateInspection(
  id: string,
  patch: Partial<Pick<Inspection, "title" | "status" | "notes" | "inspectorName">>,
): Promise<Inspection> {
  if (!isDbAvailable()) return mock.updateInspection(id, patch);
  const db = requireDb();
  const updatedAt = now();

  await db.transaction(async (tx) => {
    await tx
      .update(inspections)
      .set({ ...patch, updatedAt })
      .where(eq(inspections.id, id));
    await appendOutboxEntry(tx, {
      entityType: "inspection",
      entityId: id,
      operation: "update",
      payload: { id, ...patch, updatedAt },
    });
  });

  const updated = await getInspection(id);
  if (!updated) {
    throw new Error(`updateInspection: inspection ${id} not found after update`);
  }
  return updated;
}

export async function softDeleteInspection(id: string): Promise<void> {
  if (!isDbAvailable()) {
    mock.softDeleteInspection(id);
    return;
  }
  const db = requireDb();
  const deletedAt = now();

  await db.transaction(async (tx) => {
    await tx
      .update(inspections)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(eq(inspections.id, id));
    await appendOutboxEntry(tx, {
      entityType: "inspection",
      entityId: id,
      operation: "delete",
      payload: { id, deletedAt },
    });
  });
}
