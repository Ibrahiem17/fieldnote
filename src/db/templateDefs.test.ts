// Guards docs/DESIGN.md D-038: a template's database id must be a real UUID
// (inspections.template_id is a uuid foreign key on the server), and the
// server-side seed migration must carry exactly the same ids and schemas the
// app seeds locally. Both failed silently before, and only a real phone
// pushing a real inspection noticed.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { TEMPLATE_DEFS } from "./templateDefs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const migration = readFileSync(
  join(__dirname, "../../supabase/migrations/20260920000001_seed_templates.sql"),
  "utf8",
);

describe("template ids", () => {
  it("every template has a valid UUID database id", () => {
    for (const t of TEMPLATE_DEFS) {
      expect(t.dbId).toMatch(UUID);
    }
  });

  it("database ids are unique", () => {
    const ids = TEMPLATE_DEFS.map((t) => t.dbId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("the database id is not the human-readable slug", () => {
    for (const t of TEMPLATE_DEFS) {
      expect(t.dbId).not.toBe(t.id);
    }
  });
});

describe("server seed migration matches the app's templates", () => {
  it("contains every template's UUID", () => {
    for (const t of TEMPLATE_DEFS) {
      expect(migration).toContain(`'${t.dbId}'`);
    }
  });

  it("contains every template's exact schema JSON", () => {
    for (const t of TEMPLATE_DEFS) {
      expect(migration).toContain(JSON.stringify(t.schema));
    }
  });
});
