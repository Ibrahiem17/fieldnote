// Guards docs/DESIGN.md D-038: a template's database id must be a real UUID
// (inspections.template_id is a uuid foreign key on the server), and the
// server-side seed migration must carry exactly the same ids and schemas the
// app seeds locally. Both failed silently before, and only a real phone
// pushing a real inspection noticed.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { buildValidator } from "@/lib/validation";
import { TEMPLATE_DEFS } from "./templateDefs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Every template-seeding migration together (a new template ships with its own
// small migration file; applied migrations are never edited).
const migrationsDir = join(__dirname, "../../supabase/migrations");
const migration = readdirSync(migrationsDir)
  .filter((f) => f.includes("seed_") && f.endsWith(".sql"))
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
  .join("\n");

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

describe("templates only use field types the engine handles", () => {
  // The renderer's `case "..."` labels are the source of truth for what it
  // can draw. A template using anything else would silently render nothing.
  const renderer = readFileSync(join(__dirname, "../components/FormRenderer.tsx"), "utf8");
  const handled = new Set([...renderer.matchAll(/case "([a-z]+)":/g)].map((m) => m[1]));

  it("every field type used by every template has a renderer case", () => {
    for (const t of TEMPLATE_DEFS) {
      for (const section of t.schema.sections) {
        for (const field of section.fields) {
          expect({ template: t.id, key: field.key, type: field.type, handled: handled.has(String(field.type)) }).toEqual({
            template: t.id,
            key: field.key,
            type: field.type,
            handled: true,
          });
        }
      }
    }
  });

  it("field keys are unique within a template (answers are stored by key)", () => {
    for (const t of TEMPLATE_DEFS) {
      const keys = t.schema.sections.flatMap((sec) => sec.fields.map((f) => String(f.key)));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("every visibleIf points at a field that exists in the same template", () => {
    for (const t of TEMPLATE_DEFS) {
      const keys = new Set(t.schema.sections.flatMap((sec) => sec.fields.map((f) => String(f.key))));
      for (const section of t.schema.sections) {
        for (const field of section.fields) {
          const rule = field.visibleIf as { field: string } | undefined;
          if (rule) expect(keys.has(rule.field)).toBe(true);
        }
      }
    }
  });
});

describe("Site Safety Walk runs through the real validator with no template-specific code", () => {
  const safety = TEMPLATE_DEFS.find((t) => t.id === "site-safety-walk-v1")!;
  const validate = buildValidator(safety.schema as never);

  it("requires the hazard level", () => {
    expect(validate({}).hazard_level).toBe("Required");
    expect(validate({ hazard_level: "none" }).hazard_level).toBeUndefined();
  });

  it("rejects a hazard level that isn't one of the options", () => {
    expect(validate({ hazard_level: "Low" }).hazard_level).toBeDefined(); // wrong case
  });

  it("enforces the crew-size bounds", () => {
    expect(validate({ hazard_level: "none", crew_size: -1 }).crew_size).toBeDefined();
    expect(validate({ hazard_level: "none", crew_size: 501 }).crew_size).toBeDefined();
    expect(validate({ hazard_level: "none", crew_size: 12 }).crew_size).toBeUndefined();
  });

  it("a fully valid walk has no errors, and hidden fields never block it", () => {
    expect(validate({ hazard_level: "none", weather: "clear", crew_size: 4 })).toEqual({});
  });
});
