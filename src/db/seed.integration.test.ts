// removeSampleData must delete the fixtures and NOTHING a person made
// (docs/DESIGN.md D-045). The rule it relies on: the seed writes rows as
// syncStatus "local" with no outbox entry; real rows always have an outbox entry
// until they upload, and are "synced" afterwards. Real code, real in-memory SQLite.

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { randomUUID as mockRandomUUID } from "node:crypto";

import * as schema from "@/db/schema";
import { createProject, listProjects, setProjectSyncStatus } from "@/repositories/projects";
import { createInspection, listInspections, setInspectionSyncStatus } from "@/repositories/inspections";
import { saveAnswer } from "@/repositories/answers";
import { deleteOutboxEntry, listAllOutboxEntries } from "@/repositories/outbox";
import { removeSampleData, resetAndReseed } from "./seed";

const mockClient = createClient({ url: ":memory:" });
const mockDb = drizzle(mockClient, { schema });

jest.mock("@/db/client", () => ({ isDbAvailable: () => true, requireDb: () => mockDb }));
jest.mock("@/lib/id", () => ({ newId: () => mockRandomUUID() }));

beforeAll(async () => {
  await migrate(mockDb, { migrationsFolder: "./drizzle" });
});

/** Fixtures, then a few things a person "really" did, in the states they'd be in. */
async function setUp() {
  await resetAndReseed(); // 8 sample projects, 500 sample inspections, no outbox
  const queued = await createProject({ name: "Real, still queued", clientName: null, address: null });
  const uploaded = await createProject({ name: "Real, uploaded", clientName: null, address: null });
  const realInspection = await createInspection({ title: "Real inspection", projectId: uploaded.id });
  await saveAnswer(realInspection.id, "note", { text: "keep me" });

  // Simulate the sync engine having delivered "uploaded" and its inspection.
  for (const e of await listAllOutboxEntries()) {
    if (e.entityId === uploaded.id || e.entityId === realInspection.id) await deleteOutboxEntry(e.id);
  }
  await setProjectSyncStatus(uploaded.id, "synced");
  await setInspectionSyncStatus(realInspection.id, "synced");
  return { queued, uploaded, realInspection };
}

test("removes every sample row and keeps everything a person made", async () => {
  const { queued, uploaded, realInspection } = await setUp();
  expect(await listInspections()).toHaveLength(501);

  const removed = await removeSampleData();

  expect(removed).toEqual({ projects: 8, inspections: 500 });
  const projectNames = (await listProjects()).map((p) => p.name).sort();
  expect(projectNames).toEqual(["Real, still queued", "Real, uploaded"]);
  expect((await listInspections()).map((i) => i.id)).toEqual([realInspection.id]);
  // The answer that belongs to a kept inspection is untouched.
  const answers = await mockDb.select().from(schema.answers).where(eq(schema.answers.inspectionId, realInspection.id));
  expect(answers).toHaveLength(1);
  expect(queued.id).toBeTruthy();
  expect(uploaded.id).toBeTruthy();
});

test("never touches the upload queue", async () => {
  await setUp();
  const before = (await listAllOutboxEntries()).map((e) => e.id).sort();
  await removeSampleData();
  const after = (await listAllOutboxEntries()).map((e) => e.id).sort();
  expect(after).toEqual(before);
});

test("keeps the built-in templates", async () => {
  await setUp();
  await removeSampleData();
  const templates = await mockDb.select().from(schema.templates);
  expect(templates.length).toBeGreaterThanOrEqual(3);
});

test("a sample project that a real inspection sits inside is kept", async () => {
  await resetAndReseed();
  const [sampleProject] = await listProjects();
  const real = await createInspection({ title: "Made by hand", projectId: sampleProject.id });

  await removeSampleData();

  expect((await listProjects()).map((p) => p.id)).toEqual([sampleProject.id]);
  expect((await listInspections()).map((i) => i.id)).toEqual([real.id]);
});

test("running it on an already-clean database is a no-op", async () => {
  await setUp();
  await removeSampleData();
  expect(await removeSampleData()).toEqual({ projects: 0, inspections: 0 });
});
