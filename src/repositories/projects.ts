// src/repositories/projects.ts
//
// The only file allowed to run Drizzle queries against the `projects`
// table (Section 2.8 — "one desk may open the filing cabinet"). Screens
// import these functions; they never import `db` or `schema` themselves.

import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { projects, type NewProject, type Project } from "@/db/schema";
import { newId } from "@/lib/id";
import { now } from "@/lib/time";
import { appendOutboxEntry } from "./outbox";

export type NewProjectInput = Pick<NewProject, "name" | "clientName" | "address"> &
  Partial<Pick<NewProject, "latitude" | "longitude">>;

/** Every project not soft-deleted, newest-updated first. */
export async function listProjects(): Promise<Project[]> {
  return db
    .select()
    .from(projects)
    .where(isNull(projects.deletedAt))
    .orderBy(desc(projects.updatedAt));
}

export async function getProject(id: string): Promise<Project | null> {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)));
  return rows[0] ?? null;
}

export async function createProject(input: NewProjectInput): Promise<Project> {
  const row: NewProject = {
    id: newId(),
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
    syncStatus: "local",
    name: input.name,
    clientName: input.clientName ?? null,
    address: input.address ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  };

  // Section 5.2: the row write and its outbox note happen in one
  // transaction. If the app crashed between the two writes, we'd have a
  // project that will never sync — this way that can't happen.
  await db.transaction(async (tx) => {
    await tx.insert(projects).values(row);
    await appendOutboxEntry(tx, {
      entityType: "project",
      entityId: row.id,
      operation: "insert",
      payload: row,
    });
  });

  return row as Project;
}

export async function updateProject(id: string, patch: Partial<NewProjectInput>): Promise<Project> {
  const updatedAt = now();

  await db.transaction(async (tx) => {
    await tx
      .update(projects)
      .set({ ...patch, updatedAt })
      .where(eq(projects.id, id));
    await appendOutboxEntry(tx, {
      entityType: "project",
      entityId: id,
      operation: "update",
      payload: { id, ...patch, updatedAt },
    });
  });

  const updated = await getProject(id);
  if (!updated) {
    throw new Error(`updateProject: project ${id} not found after update`);
  }
  return updated;
}

export async function softDeleteProject(id: string): Promise<void> {
  const deletedAt = now();

  await db.transaction(async (tx) => {
    await tx.update(projects).set({ deletedAt, updatedAt: deletedAt }).where(eq(projects.id, id));
    await appendOutboxEntry(tx, {
      entityType: "project",
      entityId: id,
      operation: "delete",
      payload: { id, deletedAt },
    });
  });
}
