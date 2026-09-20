// src/lib/deleteProject.ts
//
// Deleting a project must also delete the inspections inside it. Without that,
// they'd stay in the list pointing at a project that no longer exists. Every
// delete here goes through the repositories' own soft-delete functions, so each
// one writes its outbox entry and the deletions sync like any other change.
// Inspections go first: the outbox drains oldest-first, so the server hears
// "these inspections are gone" before "the project is gone".

import { listInspections, softDeleteInspection } from "@/repositories/inspections";
import { softDeleteProject } from "@/repositories/projects";

/** Returns how many inspections were deleted along with the project. */
export async function deleteProjectWithInspections(projectId: string): Promise<number> {
  const inside = await listInspections({ projectId });
  for (const inspection of inside) {
    await softDeleteInspection(inspection.id);
  }
  await softDeleteProject(projectId);
  return inside.length;
}
