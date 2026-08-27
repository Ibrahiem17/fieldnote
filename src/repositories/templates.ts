// src/repositories/templates.ts
//
// Templates are seeded, not authored in-app — Phase 1 only needs to list
// and read them, so it can offer a picker when creating an inspection.
// Create/update/delete arrive with the form engine in Phase 2.

import { and, eq, isNull } from "drizzle-orm";

import { isDbAvailable, requireDb } from "@/db/client";
import { templates, type Template } from "@/db/schema";
import * as mock from "@/db/mockStore";

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
