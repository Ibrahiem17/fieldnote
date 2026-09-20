// Deleting a project must take its inspections with it, and every deletion must
// be queued for sync (D-044). Real repositories, real in-memory SQLite.

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { randomUUID as mockRandomUUID } from "node:crypto";

import * as schema from "@/db/schema";
import { createProject, listProjects } from "@/repositories/projects";
import { createInspection, listInspections } from "@/repositories/inspections";
import { listAllOutboxEntries } from "@/repositories/outbox";
import { deleteProjectWithInspections } from "./deleteProject";

const mockClient = createClient({ url: ":memory:" });
const mockDb = drizzle(mockClient, { schema });

jest.mock("@/db/client", () => ({ isDbAvailable: () => true, requireDb: () => mockDb }));
jest.mock("@/lib/id", () => ({ newId: () => mockRandomUUID() }));

beforeAll(async () => {
  await migrate(mockDb, { migrationsFolder: "./drizzle" });
});

test("deleting a project also deletes its inspections, and leaves other projects alone", async () => {
  const doomed = await createProject({ name: "Doomed", clientName: null, address: null });
  const kept = await createProject({ name: "Kept", clientName: null, address: null });
  await createInspection({ title: "A", projectId: doomed.id });
  await createInspection({ title: "B", projectId: doomed.id });
  await createInspection({ title: "C", projectId: kept.id });

  const removed = await deleteProjectWithInspections(doomed.id);

  expect(removed).toBe(2);
  expect((await listProjects()).map((p) => p.name)).toEqual(["Kept"]);
  expect(await listInspections({ projectId: doomed.id })).toHaveLength(0);
  expect((await listInspections({ projectId: kept.id })).map((i) => i.title)).toEqual(["C"]);
});

test("every deletion is queued for sync, inspections before the project", async () => {
  const project = await createProject({ name: "Sync me", clientName: null, address: null });
  await createInspection({ title: "X", projectId: project.id });
  const before = (await listAllOutboxEntries()).length;

  await deleteProjectWithInspections(project.id);

  const deletes = (await listAllOutboxEntries()).slice(before).filter((e) => e.operation === "delete");
  expect(deletes.map((e) => e.entityType)).toEqual(["inspection", "project"]);
});

test("deleting an empty project works", async () => {
  const project = await createProject({ name: "Empty", clientName: null, address: null });
  expect(await deleteProjectWithInspections(project.id)).toBe(0);
});
