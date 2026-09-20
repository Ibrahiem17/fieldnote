// src/repositories/templates.ts
//
// Templates are built in, not authored in-app: list, read, and make sure the
// built-in ones are present (ensureBuiltInTemplates, below).

import { and, eq, isNull, lt } from "drizzle-orm";

import { isDbAvailable, requireDb } from "@/db/client";
import { templates, type Template } from "@/db/schema";
import * as mock from "@/db/mockStore";
import { TEMPLATE_DEFS } from "@/db/templateDefs";
import { now } from "@/lib/time";

/**
 * Makes sure every built-in template exists locally. Run once at startup,
 * after migrations.
 *
 * Why this exists (docs/DESIGN.md D-040): the only code that used to put
 * templates on the phone was the dev "Reset & Reseed" button, so a fresh
 * install had none — New Inspection produced a blank form.
 *
 * - Keyed by each template's fixed UUID (`dbId`), the same id the server's
 *   seed migration uses, so an inspection's template_id is valid on both sides.
 * - Idempotent: inserts what's missing; replaces a stored row only when the
 *   app's built-in version is NEWER (`setWhere`), so a normal startup writes
 *   nothing and a stored newer version is never downgraded.
 * - No outbox entry: templates are shared reference data (read-only for
 *   clients on the server), not something a user did.
 */
export async function ensureBuiltInTemplates(): Promise<void> {
  // Web-preview fallback (D-013): the mock store already builds its templates
  // from the same TEMPLATE_DEFS.
  if (!isDbAvailable()) return;
  const db = requireDb();
  const timestamp = now();

  for (const def of TEMPLATE_DEFS) {
    const schemaJson = JSON.stringify(def.schema);
    await db
      .insert(templates)
      .values({
        id: def.dbId,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        syncStatus: "synced",
        name: def.name,
        version: def.version,
        schemaJson,
      })
      .onConflictDoUpdate({
        target: templates.id,
        set: {
          name: def.name,
          version: def.version,
          schemaJson,
          updatedAt: timestamp,
          deletedAt: null,
        },
        setWhere: lt(templates.version, def.version),
      });
  }
}

export async function listTemplates(): Promise<Template[]> {
  if (!isDbAvailable()) return mock.listTemplates();
  const db = requireDb();
  return db.select().from(templates).where(isNull(templates.deletedAt));
}

export async function getTemplate(id: string): Promise<Template | null> {
  if (!isDbAvailable()) return mock.getTemplate(id);
  const db = requireDb();
  const rows = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), isNull(templates.deletedAt)));
  return rows[0] ?? null;
}
