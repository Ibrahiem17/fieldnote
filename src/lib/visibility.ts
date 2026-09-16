// src/lib/visibility.ts
//
// Phase 4, Day 5 — the plan's own conditional-visibility logic
// (Phase 2 Section 4.4), pulled into one shared place. Before today this
// exact function existed as THREE separate, unexported copies —
// src/components/FormRenderer.tsx (rendering), src/lib/validation.ts
// (excluding a hidden field from validation), and src/lib/report.ts
// (deciding what a report shows) — found while writing this day's
// validation tests, since none of the three copies could be imported by
// a test as they stood. CLAUDE.md's own template-format rule already
// says the render and validate copies "must agree" — three copies free
// to drift apart is exactly the risk that rule exists to name. One
// function, three importers, is the fix.
//
// Only the `in` operator is implemented — the plan's Section 4.4 also
// names `equals` and `notEmpty`, but neither exists anywhere in this
// codebase (already documented as a deviation, docs/DESIGN.md D-027).

export function isFieldVisible(
  field: { visibleIf?: { field: string; in?: unknown[] } },
  answers: Record<string, unknown>,
): boolean {
  if (!field.visibleIf) return true;
  const other = answers[field.visibleIf.field];
  return Boolean(other) && Boolean(field.visibleIf.in?.includes(other));
}
