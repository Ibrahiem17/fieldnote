// A fresh install has no templates unless something puts them there. Before
// ensureBuiltInTemplates existed, the ONLY code that did was the dev
// "Reset & Reseed" button (which also wipes everything and creates 500 fake
// inspections), so a real user got a blank form with no fields
// (docs/DESIGN.md D-040). This runs the real function against a real
// in-memory SQLite database, migrated with the project's own migrations
// (same approach as projects.integration.test.ts).

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { randomUUID as mockRandomUUID } from "node:crypto";

import * as schema from "@/db/schema";
import { TEMPLATE_DEFS } from "@/db/templateDefs";
import { ensureBuiltInTemplates, listTemplates } from "./templates";

// Jest hoists jest.mock above everything; only variables starting with
// "mock" may be referenced inside the factory.
const mockClient = createClient({ url: ":memory:" });
const mockDb = drizzle(mockClient, { schema });

jest.mock("@/db/client", () => ({
  isDbAvailable: () => true,
  requireDb: () => mockDb,
}));

// templates.ts imports the web-preview mock store, which imports @/lib/id,
// which imports expo-crypto (a native module with nothing behind it in plain
// Node). Node's own crypto.randomUUID() is the same algorithm — same stand-in
// projects.integration.test.ts uses.
jest.mock("@/lib/id", () => ({
  newId: () => mockRandomUUID(),
}));

beforeAll(async () => {
  await migrate(mockDb, { migrationsFolder: "./drizzle" });
});

beforeEach(async () => {
  await mockDb.delete(schema.templates);
  await mockDb.delete(schema.outbox);
});

test("a fresh database gets every built-in template, keyed by its fixed UUID", async () => {
  expect(await listTemplates()).toHaveLength(0);

  await ensureBuiltInTemplates();

  const rows = await listTemplates();
  expect(rows).toHaveLength(TEMPLATE_DEFS.length);
  expect(rows.map((r) => r.id).sort()).toEqual(TEMPLATE_DEFS.map((t) => t.dbId).sort());
  for (const def of TEMPLATE_DEFS) {
    const row = rows.find((r) => r.id === def.dbId)!;
    expect(row.name).toBe(def.name);
    expect(row.version).toBe(def.version);
    expect(JSON.parse(row.schemaJson)).toEqual(def.schema);
  }
});

test("it is idempotent — running it again neither duplicates nor rewrites", async () => {
  await ensureBuiltInTemplates();
  const first = await listTemplates();

  await ensureBuiltInTemplates();
  const second = await listTemplates();

  expect(second).toHaveLength(TEMPLATE_DEFS.length);
  // Same version → the guarded update must not touch the row at all.
  expect(second.map((r) => r.updatedAt).sort()).toEqual(first.map((r) => r.updatedAt).sort());
});

test("it does not write outbox entries (templates are reference data, not a user action)", async () => {
  await ensureBuiltInTemplates();
  const outbox = await mockDb.select().from(schema.outbox);
  expect(outbox).toHaveLength(0);
});

test("a newer built-in version replaces an older stored one", async () => {
  const def = TEMPLATE_DEFS[0];
  await mockDb.insert(schema.templates).values({
    id: def.dbId,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    syncStatus: "synced",
    name: "Old name",
    version: def.version - 1,
    schemaJson: '{"old":true}',
  });

  await ensureBuiltInTemplates();

  const [row] = await mockDb.select().from(schema.templates).where(eq(schema.templates.id, def.dbId));
  expect(row.name).toBe(def.name);
  expect(row.version).toBe(def.version);
  expect(JSON.parse(row.schemaJson)).toEqual(def.schema);
});

test("it never downgrades: a stored version newer than the app's is left alone", async () => {
  const def = TEMPLATE_DEFS[0];
  await mockDb.insert(schema.templates).values({
    id: def.dbId,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    syncStatus: "synced",
    name: "From the future",
    version: def.version + 5,
    schemaJson: '{"future":true}',
  });

  await ensureBuiltInTemplates();

  const [row] = await mockDb.select().from(schema.templates).where(eq(schema.templates.id, def.dbId));
  expect(row.name).toBe("From the future");
  expect(row.version).toBe(def.version + 5);
});
