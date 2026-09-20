// Guards docs/DESIGN.md D-041. saveAnswer used to delete EVERY outbox entry
// for an answer on each autosave — including a still-unsent INSERT — and queue
// an UPDATE in its place. The server's update matches by id, so an update for
// a row the server never received changes nothing: the answer stayed on the
// phone and never reached the server. Any answer saved twice before a sync
// (i.e. any text typed over a few seconds) was affected. Phase 3 never saw it
// because its checks pushed answers by script, not through saveAnswer.
//
// Real code, real (in-memory) SQLite, the project's own migrations — same
// approach as projects.integration.test.ts.

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { randomUUID as mockRandomUUID } from "node:crypto";

import * as schema from "@/db/schema";
import { createProject } from "./projects";
import { createInspection } from "./inspections";
import { saveAnswer } from "./answers";
import { deleteOutboxEntry, listOutboxForEntity } from "./outbox";

const mockClient = createClient({ url: ":memory:" });
const mockDb = drizzle(mockClient, { schema });

jest.mock("@/db/client", () => ({
  isDbAvailable: () => true,
  requireDb: () => mockDb,
}));
jest.mock("@/lib/id", () => ({
  newId: () => mockRandomUUID(),
}));

let inspectionId: string;

beforeAll(async () => {
  await migrate(mockDb, { migrationsFolder: "./drizzle" });
  const project = await createProject({ name: "P", clientName: null, address: null });
  const inspection = await createInspection({ title: "I", projectId: project.id });
  inspectionId = inspection.id;
});

/** Each test uses its own field key so tests don't share rows. */
let n = 0;
const nextKey = () => `field_${++n}`;

async function entriesFor(answerId: string) {
  return listOutboxForEntity(answerId);
}

async function answerIdFor(fieldKey: string): Promise<string> {
  const rows = await mockDb.select().from(schema.answers);
  return rows.find((r) => r.fieldKey === fieldKey)!.id;
}

test("the first save queues exactly one insert", async () => {
  const key = nextKey();
  const a = await saveAnswer(inspectionId, key, { text: "a" });
  const entries = await entriesFor(a.id);
  expect(entries).toHaveLength(1);
  expect(entries[0].operation).toBe("insert");
});

test("saving again BEFORE a sync keeps a single INSERT carrying the latest value", async () => {
  const key = nextKey();
  const first = await saveAnswer(inspectionId, key, { text: "he" });
  await saveAnswer(inspectionId, key, { text: "hel" });
  await saveAnswer(inspectionId, key, { text: "hello" });

  const entries = await entriesFor(first.id);
  expect(entries).toHaveLength(1);
  // The server has never seen this row, so it must still be an INSERT.
  expect(entries[0].operation).toBe("insert");
  const payload = JSON.parse(entries[0].payloadJson);
  expect(payload.id).toBe(first.id);
  expect(payload.inspectionId).toBe(inspectionId);
  expect(payload.fieldKey).toBe(key);
  expect(payload.valueText).toBe("hello");
});

test("clearing a value before the sync updates the queued insert to 'no answer'", async () => {
  const key = nextKey();
  const first = await saveAnswer(inspectionId, key, { number: 7 });
  await saveAnswer(inspectionId, key, { json: null });

  const entries = await entriesFor(first.id);
  expect(entries).toHaveLength(1);
  expect(entries[0].operation).toBe("insert");
  const payload = JSON.parse(entries[0].payloadJson);
  expect(payload.valueNumber).toBeNull();
  expect(payload.valueText).toBeNull();
});

test("after the insert has synced, an edit is a single UPDATE (and repeats coalesce)", async () => {
  const key = nextKey();
  const first = await saveAnswer(inspectionId, key, { text: "one" });
  // The sync engine deletes an entry once the server accepted it.
  for (const e of await entriesFor(first.id)) await deleteOutboxEntry(e.id);
  expect(await entriesFor(first.id)).toHaveLength(0);

  await saveAnswer(inspectionId, key, { text: "two" });
  await saveAnswer(inspectionId, key, { text: "three" });

  const entries = await entriesFor(first.id);
  expect(entries).toHaveLength(1);
  expect(entries[0].operation).toBe("update");
  expect(JSON.parse(entries[0].payloadJson).valueText).toBe("three");
});

test("answers on different fields never share or clobber each other's entries", async () => {
  const k1 = nextKey();
  const k2 = nextKey();
  await saveAnswer(inspectionId, k1, { text: "x" });
  await saveAnswer(inspectionId, k2, { text: "y" });
  await saveAnswer(inspectionId, k1, { text: "x2" });

  const e1 = await entriesFor(await answerIdFor(k1));
  const e2 = await entriesFor(await answerIdFor(k2));
  expect(e1).toHaveLength(1);
  expect(e2).toHaveLength(1);
  expect(JSON.parse(e1[0].payloadJson).valueText).toBe("x2");
  expect(JSON.parse(e2[0].payloadJson).valueText).toBe("y");
});
