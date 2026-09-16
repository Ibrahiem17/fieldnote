// src/repositories/projects.integration.test.ts
//
// Phase 4, Day 5 — the plan's own integration test (Section 3.5.3): "a
// repository test: create, read back, confirm the outbox row exists.
// Proves the layering rule holds."
//
// The real blocker this test had to solve: src/db/client.ts imports
// expo-sqlite at module scope, which throws outside a real Expo/RN
// runtime — no test can import ANY repository file without hitting that,
// and neither the mock store (no outbox concept at all) nor a bare Node
// script (confirmed broken in an earlier session) can stand in for it.
//
// The fix needs zero production code changes: jest.mock("@/db/client")
// replaces that one import, for this test file only, with a real,
// libsql-backed Drizzle instance — an in-memory SQLite database, migrated
// with this project's own real, already-generated `drizzle/` migration
// files (not a hand-written schema copy). Everything else — createProject,
// listOutboxForEntity, the transaction, the outbox write — is the real,
// completely unmodified repository code.
//
// Why @libsql/client and not the more common `better-sqlite3`: it was
// tried first and rejected for a real, confirmed reason — better-sqlite3
// is a SYNCHRONOUS driver, and its `db.transaction(cb)` throws
// ("Transaction function cannot return a promise") the moment `cb` is an
// `async` function, which every repository transaction in this codebase
// is (`db.transaction(async (tx) => { await tx.insert(...); await
// appendOutboxEntry(...) })`, src/repositories/projects.ts). @libsql/client
// is genuinely async, the same shape expo-sqlite's own driver is, so the
// real repository code runs completely unmodified against it.
//
// What this proves: the repository/transaction/outbox logic is correct.
// What it does NOT prove: that expo-sqlite itself (the real driver on a
// phone) behaves identically to libsql — that's a different claim,
// already covered by this project's live, on-device testing discipline in
// earlier phases, not something a unit test can stand in for
// (docs/DESIGN.md has the full reasoning for this day's entry).

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { randomUUID as mockRandomUUID } from "node:crypto";
import * as schema from "@/db/schema";
import { createProject } from "./projects";
import { listOutboxForEntity } from "./outbox";

// Named `mockClient`/`mockDb` (not `testDb`) because Jest hoists every
// `jest.mock(...)` call to the very top of the file, before any other
// code runs — a closed-over variable is only allowed inside the mock
// factory below if its name starts with "mock" (case-insensitive), Jest's
// own guard against referencing something that isn't initialized yet.
const mockClient = createClient({ url: ":memory:" });
const mockDb = drizzle(mockClient, { schema });

jest.mock("@/db/client", () => ({
  isDbAvailable: () => true,
  requireDb: () => mockDb,
}));

// createProject/appendOutboxEntry both call newId() (src/lib/id.ts), which
// calls expo-crypto's randomUUID() — another native module with nothing to
// back it in plain Node. Node's own built-in `crypto.randomUUID()` is the
// same algorithm (RFC 4122 v4) with none of the native-module baggage, so
// it's a faithful stand-in for what this test actually needs: SOME valid,
// unique UUID, not expo-crypto specifically.
jest.mock("@/lib/id", () => ({
  newId: () => mockRandomUUID(),
}));

// `migrate` is async (libsql's driver, unlike better-sqlite3's, does
// nothing synchronously) — runs once before the one test in this file,
// applying this project's own real migration files to the in-memory
// database so its schema matches the real app's exactly.
beforeAll(async () => {
  await migrate(mockDb, { migrationsFolder: "./drizzle" });
});

test("createProject writes the row and its outbox entry in one transaction (the layering rule)", async () => {
  const project = await createProject({
    name: "Integration Test Site",
    clientName: "Test Client",
    address: "1 Test Street",
  });

  // The row itself: does createProject persist what it was asked to?
  expect(project.name).toBe("Integration Test Site");
  expect(project.clientName).toBe("Test Client");
  expect(project.syncStatus).toBe("local");
  expect(project.id).toBeTruthy();

  // The read-back: was it actually written to SQLite, not just returned
  // in memory? Query the real table directly, not through the repository
  // function that just created it.
  const rows = await mockDb
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, project.id));
  expect(rows).toHaveLength(1);
  expect(rows[0].name).toBe("Integration Test Site");

  // The outbox entry: CLAUDE.md's own rule — "never write to an entity
  // table without also writing its outbox note in the same transaction."
  const outboxRows = await listOutboxForEntity(project.id);
  expect(outboxRows).toHaveLength(1);
  expect(outboxRows[0].entityType).toBe("project");
  expect(outboxRows[0].operation).toBe("insert");

  const payload = JSON.parse(outboxRows[0].payloadJson);
  expect(payload.name).toBe("Integration Test Site");
});
