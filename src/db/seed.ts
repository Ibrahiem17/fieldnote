// src/db/seed.ts
//
// Fills the database with realistic-sized fixture data: 8 projects, 3
// templates, 500 inspections. Section 3.5.2 explains why 500 and not 5 —
// with five rows every list looks fast whether it actually is or not.
//
// This is dev-only fixture data, not something a user did, so unlike every
// repository function it does NOT write outbox entries. If it did, TC-17
// ("check the outbox has exactly 3 rows after 3 manual actions") would be
// impossible to verify — the count would already include hundreds of rows
// nobody actually created.

import { inArray } from "drizzle-orm";

import { isDbAvailable, requireDb } from "./client";
import { projects, templates, inspections, answers, attachments, outbox } from "./schema";
import { newId } from "@/lib/id";
import { now } from "@/lib/time";
import type { InspectionStatus } from "./schema";
import * as mock from "./mockStore";
import { TEMPLATE_DEFS } from "./templateDefs";

const PROJECT_NAMES = [
  "Riverside Distribution Center",
  "Harborview Retail Fitout",
  "Maple Street Substation",
  "Crestline Apartments Phase 2",
  "Northgate Cold Storage",
  "Oakfield Solar Array",
  "Pinehill Water Treatment Plant",
  "Summit Ridge Data Center",
];

const CLIENT_NAMES = [
  "Alden Logistics",
  "BrightPath Retail Group",
  "Metro Power Co-op",
  "Crestline Development",
  "Northgate Holdings",
  "Oakfield Energy",
  "Pinehill Municipal Utilities",
  "Summit Cloud Partners",
];

const STATUSES: InspectionStatus[] = ["draft", "in_progress", "completed", "submitted"];
const INSPECTOR_NAMES = ["A. Rivera", "J. Chen", "M. Okafor", "S. Novak", "T. Haddad"];

function randomOf<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function daysAgo(days: number): number {
  return now() - days * 24 * 60 * 60 * 1000;
}

/** Splits an array into fixed-size chunks — SQLite has a per-statement bind-variable limit. */
function chunk<T>(list: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
}

/**
 * Removes ONLY the sample data made by resetAndReseed, keeping everything a
 * person actually created (docs/DESIGN.md D-045).
 *
 * How sample rows are told apart from real ones: the seed stamps rows
 * syncStatus "local" and writes them NO outbox entry, by design. A real row
 * also starts "local" — but it always has an outbox entry until it uploads, and
 * becomes "synced" afterwards. So "local AND nothing in the outbox" is exactly
 * the sample data. A sample project that has a real inspection inside it is kept.
 *
 * This is a HARD delete, unlike every other delete in the app: sample rows never
 * reached the server, so there is nothing to tombstone. Development builds only.
 */
export async function removeSampleData(): Promise<{ projects: number; inspections: number }> {
  if (!isDbAvailable()) return { projects: 0, inspections: 0 };
  const db = requireDb();

  return db.transaction(async (tx) => {
    const queued = new Set((await tx.select({ id: outbox.entityId }).from(outbox)).map((r) => r.id));
    const isSample = (row: { id: string; syncStatus: string }) =>
      row.syncStatus === "local" && !queued.has(row.id);

    const sampleInspectionIds = (await tx.select().from(inspections))
      .filter(isSample)
      .map((i) => i.id);
    for (const ids of chunk(sampleInspectionIds, 100)) {
      await tx.delete(answers).where(inArray(answers.inspectionId, ids));
      await tx.delete(attachments).where(inArray(attachments.inspectionId, ids));
      await tx.delete(inspections).where(inArray(inspections.id, ids));
    }

    // A sample project goes only if nothing (real) is left inside it.
    const stillUsed = new Set((await tx.select().from(inspections)).map((i) => i.projectId));
    const sampleProjectIds = (await tx.select().from(projects))
      .filter((p) => isSample(p) && !stillUsed.has(p.id))
      .map((p) => p.id);
    for (const ids of chunk(sampleProjectIds, 100)) {
      await tx.delete(projects).where(inArray(projects.id, ids));
    }

    return { projects: sampleProjectIds.length, inspections: sampleInspectionIds.length };
  });
}

/**
 * Deletes every row from every table, then inserts fresh fixture data.
 * Wired to the dev-only "Reset & reseed database" button in Settings
 * (Section 3.5.3) — you'll use this constantly during development.
 */
export async function resetAndReseed(): Promise<{
  projects: number;
  templates: number;
  inspections: number;
}> {
  // Preview mode (docs/DESIGN.md D-013): no real database to reset — reset
  // the in-memory mock store back to its own seed instead.
  if (!isDbAvailable()) return mock.resetAndReseed();
  const db = requireDb();

  await db.transaction(async (tx) => {
    // Order matters only in that it's tidy — none of these tables have a
    // real foreign-key constraint turned on on device, so any order works.
    await tx.delete(answers);
    await tx.delete(attachments);
    await tx.delete(outbox);
    await tx.delete(inspections);
    await tx.delete(templates);
    await tx.delete(projects);
  });

  const seededProjects = PROJECT_NAMES.map((name, i) => ({
    id: newId(),
    createdAt: daysAgo(60),
    updatedAt: daysAgo(Math.random() * 30),
    deletedAt: null,
    syncStatus: "local" as const,
    name,
    clientName: CLIENT_NAMES[i],
    address: `${100 + i * 12} Industrial Way`,
    latitude: null,
    longitude: null,
  }));

  const seededTemplates = TEMPLATE_DEFS.map((t) => ({
    id: t.dbId,
    createdAt: daysAgo(90),
    updatedAt: daysAgo(90),
    deletedAt: null,
    syncStatus: "local" as const,
    name: t.name,
    version: t.version,
    // Real template JSON for Phase 2's form renderer
    schemaJson: JSON.stringify(t.schema),
  }));

  await db.transaction(async (tx) => {
    await tx.insert(projects).values(seededProjects);
    await tx.insert(templates).values(seededTemplates);
  });

  const seededInspections = Array.from({ length: 500 }, (_, i) => {
    const project = randomOf(seededProjects);
    const template = randomOf(seededTemplates);
    const status = randomOf(STATUSES);
    const createdAt = daysAgo(Math.random() * 45);
    const startedAt = createdAt;
    const completedAt =
      status === "completed" || status === "submitted" ? createdAt + 3600_000 : null;

    return {
      id: newId(),
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      syncStatus: "local" as const,
      projectId: project.id,
      templateId: template.id,
      title: `${project.name} — Inspection #${i + 1}`,
      status,
      inspectorName: randomOf(INSPECTOR_NAMES),
      startedAt,
      completedAt,
      latitude: null,
      longitude: null,
      notes: null,
    };
  });

  await db.transaction(async (tx) => {
    for (const batch of chunk(seededInspections, 50)) {
      await tx.insert(inspections).values(batch);
    }
  });

  return {
    projects: seededProjects.length,
    templates: seededTemplates.length,
    inspections: seededInspections.length,
  };
}
