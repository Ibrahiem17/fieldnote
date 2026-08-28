// src/db/mockStore.ts
//
// A tiny, in-memory stand-in for the real database, used ONLY when
// `dbInitError` (src/db/client.ts) is set — meaning `openDatabaseSync`
// itself failed. See docs/DESIGN.md D-013 for the full reasoning; the
// short version: this project's sandboxed web preview cannot open a real
// database at all (D-010), and without something to fall back to, that
// environment couldn't render a single real screen.
//
// What this deliberately is NOT: a second implementation of the real data
// layer. It doesn't validate, doesn't filter by status/project beyond the
// simplest case, doesn't persist past a page reload, and every repository
// function that uses it is clearly marked. It exists purely so the actual
// screens — the real ones, unmodified — have something to render while
// `dbInitError` is set, so visual/UI changes stay checkable in this one
// broken environment. It is never reached on Android, iOS, or a browser
// where the real database opened successfully.

import { newId } from "@/lib/id";
import { now } from "@/lib/time";
import type {
  Project,
  NewProject,
  Template,
  Inspection,
  NewInspection,
  InspectionStatus,
} from "./schema";

function daysAgo(days: number): number {
  return now() - days * 24 * 60 * 60 * 1000;
}

function seedProjects(): Project[] {
  return [
    {
      id: "mock-project-1",
      createdAt: daysAgo(40),
      updatedAt: daysAgo(2),
      deletedAt: null,
      syncStatus: "local",
      name: "Riverside Distribution Center",
      clientName: "Alden Logistics",
      address: "100 Industrial Way",
      latitude: null,
      longitude: null,
      notes: null,
    },
    {
      id: "mock-project-2",
      createdAt: daysAgo(35),
      updatedAt: daysAgo(5),
      deletedAt: null,
      syncStatus: "local",
      name: "Harborview Retail Fitout",
      clientName: "BrightPath Retail Group",
      address: "112 Industrial Way",
      latitude: null,
      longitude: null,
      notes: null,
    },
    {
      id: "mock-project-3",
      createdAt: daysAgo(20),
      updatedAt: daysAgo(1),
      deletedAt: null,
      syncStatus: "local",
      name: "Maple Street Substation",
      clientName: "Metro Power Co-op",
      address: "124 Industrial Way",
      latitude: null,
      longitude: null,
      notes: null,
    },
  ];
}

function seedTemplates(): Template[] {
  // Names match src/db/seed.ts's real TEMPLATE_DEFS (found out of sync during
  // Phase 1's web-preview test pass — see docs/DESIGN.md D-013 addendum).
  return [
    {
      id: "mock-template-1",
      createdAt: daysAgo(60),
      updatedAt: daysAgo(60),
      deletedAt: null,
      syncStatus: "local",
      name: "General Site Safety Checklist",
      version: 1,
      schemaJson: JSON.stringify({ fields: [] }),
    },
    {
      id: "mock-template-2",
      createdAt: daysAgo(60),
      updatedAt: daysAgo(60),
      deletedAt: null,
      syncStatus: "local",
      name: "Electrical Systems Inspection",
      version: 2,
      schemaJson: JSON.stringify({ fields: [] }),
    },
  ];
}

function seedInspections(projectList: Project[], templateList: Template[]): Inspection[] {
  const statuses: InspectionStatus[] = ["draft", "in_progress", "completed", "submitted"];
  return Array.from({ length: 6 }, (_, i) => {
    const project = projectList[i % projectList.length];
    const template = templateList[i % templateList.length];
    const status = statuses[i % statuses.length];
    const createdAt = daysAgo(i * 3);
    return {
      id: `mock-inspection-${i + 1}`,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      syncStatus: "local",
      projectId: project.id,
      templateId: template.id,
      title: `${project.name} — Inspection #${i + 1}`,
      status,
      inspectorName: "A. Rivera",
      startedAt: createdAt,
      completedAt: status === "completed" || status === "submitted" ? createdAt + 3_600_000 : null,
      latitude: null,
      longitude: null,
      notes: null,
    };
  });
}

// Module-level mutable state — deliberately not persisted anywhere. A page
// reload calls this file fresh and starts over from the seed, same as
// dev-mode "Reset & Reseed" always producing the same starting point.
let projectsStore: Project[] = seedProjects();
let templatesStore: Template[] = seedTemplates();
let inspectionsStore: Inspection[] = seedInspections(projectsStore, templatesStore);

export function listProjects(): Project[] {
  return projectsStore.filter((p) => !p.deletedAt);
}

export function getProject(id: string): Project | null {
  return projectsStore.find((p) => p.id === id && !p.deletedAt) ?? null;
}

export function listTemplates(): Template[] {
  return templatesStore.filter((t) => !t.deletedAt);
}

export function getTemplate(id: string): Template | null {
  return templatesStore.find((t) => t.id === id && !t.deletedAt) ?? null;
}

export function listInspections(filter?: {
  projectId?: string;
  status?: InspectionStatus;
}): Inspection[] {
  return inspectionsStore
    .filter((i) => !i.deletedAt)
    .filter((i) => !filter?.projectId || i.projectId === filter.projectId)
    .filter((i) => !filter?.status || i.status === filter.status)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getInspection(id: string): Inspection | null {
  return inspectionsStore.find((i) => i.id === id && !i.deletedAt) ?? null;
}

export function createInspection(
  input: Pick<NewInspection, "projectId" | "title"> &
    Partial<Pick<NewInspection, "templateId" | "inspectorName" | "notes">>,
): Inspection {
  const row: Inspection = {
    id: newId(),
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
    syncStatus: "local",
    projectId: input.projectId,
    templateId: input.templateId ?? null,
    title: input.title,
    status: "draft",
    inspectorName: input.inspectorName ?? null,
    startedAt: now(),
    completedAt: null,
    latitude: null,
    longitude: null,
    notes: input.notes ?? null,
  };
  inspectionsStore = [row, ...inspectionsStore];
  return row;
}

export function updateInspection(
  id: string,
  patch: Partial<Pick<Inspection, "title" | "status" | "notes" | "inspectorName">>,
): Inspection {
  const updatedAt = now();
  let updated: Inspection | null = null;
  inspectionsStore = inspectionsStore.map((i) => {
    if (i.id !== id) return i;
    updated = { ...i, ...patch, updatedAt };
    return updated;
  });
  if (!updated) {
    throw new Error(`mockStore.updateInspection: inspection ${id} not found`);
  }
  return updated;
}

export function softDeleteInspection(id: string): void {
  const deletedAt = now();
  inspectionsStore = inspectionsStore.map((i) =>
    i.id === id ? { ...i, deletedAt, updatedAt: deletedAt } : i,
  );
}

export function createProject(input: Pick<NewProject, "name" | "clientName" | "address">): Project {
  const row: Project = {
    id: newId(),
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
    syncStatus: "local",
    name: input.name,
    clientName: input.clientName ?? null,
    address: input.address ?? null,
    latitude: null,
    longitude: null,
    notes: null,
  };
  projectsStore = [row, ...projectsStore];
  return row;
}

/** Mirrors src/db/seed.ts#resetAndReseed for the mock store — same button, same effect, no real database. */
export function resetAndReseed(): { projects: number; templates: number; inspections: number } {
  projectsStore = seedProjects();
  templatesStore = seedTemplates();
  inspectionsStore = seedInspections(projectsStore, templatesStore);
  return {
    projects: projectsStore.length,
    templates: templatesStore.length,
    inspections: inspectionsStore.length,
  };
}
