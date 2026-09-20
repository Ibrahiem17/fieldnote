// The sync engine (drainOutbox / backoff / dead-lettering) had no tests. This
// runs the REAL engine and the REAL repositories against a real in-memory
// SQLite (the project's own migrations), with only the network call
// (syncApi.pushOutboxEntry) replaced by a controllable fake.
//
// It also pins down docs/DESIGN.md D-042: a failure to REACH the server (no
// signal) must never count against an entry's retry budget. Before, every
// foreground event while offline burned an attempt, and after MAX_ATTEMPTS
// (~4 minutes of foreground use) good data was dead-lettered and needed a
// manual Retry — the exact situation this app exists for.

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { randomUUID as mockRandomUUID } from "node:crypto";

import * as schema from "@/db/schema";
import { createProject } from "@/repositories/projects";
import { createInspection } from "@/repositories/inspections";
import { listAllOutboxEntries } from "@/repositories/outbox";
import { drainOutbox, getOutboxSummary, retryDeadLetters } from "./syncEngine";
import { MAX_ATTEMPTS } from "./backoff";

const mockClient = createClient({ url: ":memory:" });
const mockDb = drizzle(mockClient, { schema });
const mockPush = jest.fn();

jest.mock("@/db/client", () => ({ isDbAvailable: () => true, requireDb: () => mockDb }));
jest.mock("@/lib/id", () => ({ newId: () => mockRandomUUID() }));
// The real syncApi/attachmentUpload import the Supabase client (native storage
// modules) — replaced wholesale; only the push result matters here.
jest.mock("./syncApi", () => ({ pushOutboxEntry: (...args: unknown[]) => mockPush(...args) }));
jest.mock("./attachmentUpload", () => ({ pushAndUploadAttachment: jest.fn() }));

const OK = { ok: true, duplicate: false } as const;
const retryable = (error = "boom") => ({ ok: false, retryable: true, error }) as const;
const permanent = (error = "nope") => ({ ok: false, retryable: false, error }) as const;
const unreachable = () =>
  ({ ok: false, retryable: true, unreachable: true, error: "Network request failed" }) as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  await migrate(mockDb, { migrationsFolder: "./drizzle" });
});

beforeEach(async () => {
  mockPush.mockReset();
  for (const t of [schema.outbox, schema.answers, schema.attachments, schema.inspections, schema.projects]) {
    await mockDb.delete(t);
  }
});

/** Makes every queued entry due right now (skips the backoff wait). */
async function makeAllDue() {
  await mockDb.update(schema.outbox).set({ nextAttemptAt: 0 });
}

async function projectStatus(id: string) {
  const [row] = await mockDb.select().from(schema.projects).where(eq(schema.projects.id, id));
  return row.syncStatus;
}

test("a successful push marks the row synced and empties the outbox", async () => {
  const p = await createProject({ name: "P", clientName: null, address: null });
  mockPush.mockResolvedValue(OK);

  const result = await drainOutbox();

  expect(result).toMatchObject({ synced: 1, failed: 0 });
  expect(await listAllOutboxEntries()).toHaveLength(0);
  expect(await projectStatus(p.id)).toBe("synced");
});

test("parents are pushed before children, oldest first", async () => {
  const p = await createProject({ name: "P", clientName: null, address: null });
  await sleep(3); // distinct createdAt so the order is unambiguous
  await createInspection({ title: "I", projectId: p.id });
  mockPush.mockResolvedValue(OK);

  await drainOutbox();

  const order = mockPush.mock.calls.map((c) => (c[0] as { entityType: string }).entityType);
  expect(order).toEqual(["project", "inspection"]);
});

test("a retryable failure keeps the row, counts one attempt, and backs off", async () => {
  const p = await createProject({ name: "P", clientName: null, address: null });
  mockPush.mockResolvedValue(retryable("server hiccup"));

  const result = await drainOutbox();

  expect(result.failed).toBe(1);
  const [entry] = await listAllOutboxEntries();
  expect(entry.attempts).toBe(1);
  expect(entry.lastError).toBe("server hiccup");
  expect(entry.nextAttemptAt).toBeGreaterThan(Date.now()); // waits before retrying
  expect(await projectStatus(p.id)).toBe("pending");
  expect(await getOutboxSummary()).toEqual({ pending: 1, deadLettered: 0 });
});

test("a permanent failure is dead-lettered on the first attempt", async () => {
  const p = await createProject({ name: "P", clientName: null, address: null });
  mockPush.mockResolvedValue(permanent("RLS said no"));

  await drainOutbox();

  expect(await getOutboxSummary()).toEqual({ pending: 0, deadLettered: 1 });
  expect(await projectStatus(p.id)).toBe("failed");
});

test("a server that keeps rejecting dead-letters after MAX_ATTEMPTS, not before", async () => {
  await createProject({ name: "P", clientName: null, address: null });
  mockPush.mockResolvedValue(retryable());

  for (let i = 1; i < MAX_ATTEMPTS; i++) {
    await makeAllDue();
    await drainOutbox();
    expect((await getOutboxSummary()).deadLettered).toBe(0);
  }
  await makeAllDue();
  await drainOutbox();
  expect((await getOutboxSummary()).deadLettered).toBe(1);
});

test("'Retry Failed' gives a dead-lettered row a fresh start and delivers it", async () => {
  const p = await createProject({ name: "P", clientName: null, address: null });
  mockPush.mockResolvedValueOnce(permanent());
  await drainOutbox();
  expect((await getOutboxSummary()).deadLettered).toBe(1);

  mockPush.mockResolvedValue(OK);
  const result = await retryDeadLetters();

  expect(result.synced).toBe(1);
  expect(await listAllOutboxEntries()).toHaveLength(0);
  expect(await projectStatus(p.id)).toBe("synced");
});

// --- D-042: no signal is not a failure of the data ---------------------------

test("an unreachable server does not count as an attempt and leaves the row pending", async () => {
  const p = await createProject({ name: "P", clientName: null, address: null });
  mockPush.mockResolvedValue(unreachable());

  await drainOutbox();

  const [entry] = await listAllOutboxEntries();
  expect(entry.attempts).toBe(0);
  expect(await projectStatus(p.id)).toBe("pending");
  expect(await getOutboxSummary()).toEqual({ pending: 1, deadLettered: 0 });
});

test("staying offline through many sync attempts never dead-letters anything", async () => {
  await createProject({ name: "P", clientName: null, address: null });
  mockPush.mockResolvedValue(unreachable());

  for (let i = 0; i < MAX_ATTEMPTS * 3; i++) {
    await drainOutbox();
  }

  expect(await getOutboxSummary()).toEqual({ pending: 1, deadLettered: 0 });
  const [entry] = await listAllOutboxEntries();
  expect(entry.attempts).toBe(0);
});

test("when the server is unreachable the drain stops instead of trying every entry", async () => {
  const p = await createProject({ name: "P", clientName: null, address: null });
  await sleep(3);
  await createInspection({ title: "I", projectId: p.id });
  mockPush.mockResolvedValue(unreachable());

  await drainOutbox();

  expect(mockPush).toHaveBeenCalledTimes(1); // the second entry was not attempted
});

test("once the signal returns, entries queued while offline are delivered exactly once", async () => {
  const p = await createProject({ name: "P", clientName: null, address: null });
  await sleep(3);
  await createInspection({ title: "I", projectId: p.id });

  mockPush.mockResolvedValue(unreachable());
  await drainOutbox();
  await drainOutbox();

  mockPush.mockReset();
  mockPush.mockResolvedValue(OK);
  const result = await drainOutbox();

  expect(result.synced).toBe(2);
  expect(mockPush).toHaveBeenCalledTimes(2);
  expect(await listAllOutboxEntries()).toHaveLength(0);
});
