// src/lib/visibility.ts
//
// The plan's own conditional-visibility logic (Phase 2 Section 4.4), in one
// shared place. Before Phase 4 Day 5 this exact function existed as THREE
// separate, unexported copies — src/components/FormRenderer.tsx (rendering),
// src/lib/validation.ts (excluding a hidden field from validation), and
// src/lib/report.ts (deciding what a report shows) — none of which a test
// could import. CLAUDE.md's template-format rule says the render and validate
// copies "must agree"; one function, three importers, is how they do.
//
// Operators (all optional; if a rule names more than one, ALL must hold):
//   in:       [a, b]  — the controlling answer is one of these (and non-empty)
//   equals:   x       — the controlling answer is exactly x (0 and false are valid x)
//   notEmpty: true    — the controlling field has any answer at all
//
// Booleans are stored as 1 / 0 (FormRenderer), so "shown when the box is
// ticked" is `equals: 1`.

export type VisibleIf = {
  field: string;
  in?: unknown[];
  equals?: unknown;
  notEmpty?: boolean;
};

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function isFieldVisible(
  field: { visibleIf?: VisibleIf },
  answers: Record<string, unknown>,
): boolean {
  const rule = field.visibleIf;
  if (!rule) return true;
  const other = answers[rule.field];

  // `in` keeps its original meaning exactly: a falsy answer never matches.
  if (rule.in !== undefined && !(Boolean(other) && rule.in.includes(other))) return false;
  if (rule.equals !== undefined && other !== rule.equals) return false;
  if (rule.notEmpty === true && isEmpty(other)) return false;
  return true;
}
