// src/lib/validation.ts
// Lightweight runtime validator for template-based forms. This avoids adding a
// new dependency (Zod) while still providing the Phase 2-required runtime
// checks for `required`, `min`, `max`, and `maxLength`.

export type TemplateField = any;

export function buildValidator(schema: { sections: Array<{ fields: TemplateField[] }> }) {
  // Returns a function that accepts a map of answers (fieldKey -> value)
  // and returns an object of errors: { fieldKey: "error message" }
  return function validate(answers: Record<string, any>) {
    const errors: Record<string, string> = {};
    for (const section of schema.sections ?? []) {
      for (const field of section.fields ?? []) {
        // Skip hidden fields if their field has a `visibleIf` that isn't met;
        // the caller must filter those out before calling this validator if
        // they want hidden fields excluded. For now we do a simple check:
        if (field.visibleIf) {
          const other = answers[field.visibleIf.field];
          if (!other || !field.visibleIf.in?.includes(other)) {
            continue; // field hidden, skip validation
          }
        }

        const v = answers[field.key];
        if (field.required) {
          const isEmpty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
          if (isEmpty) {
            errors[field.key] = "Required";
            continue;
          }
        }

        if (field.type === "number" && v !== undefined && v !== null && v !== "") {
          const n = Number(v);
          if (isNaN(n)) {
            errors[field.key] = "Must be a number";
            continue;
          }
          if (typeof field.min === "number" && n < field.min) {
            errors[field.key] = `Minimum ${field.min}`;
            continue;
          }
          if (typeof field.max === "number" && n > field.max) {
            errors[field.key] = `Maximum ${field.max}`;
            continue;
          }
        }

        if ((field.type === "text" || field.type === "longtext") && typeof field.maxLength === "number") {
          const len = typeof v === "string" ? v.length : 0;
          if (len > field.maxLength) {
            errors[field.key] = `Maximum ${field.maxLength} characters`;
            continue;
          }
        }

        if (field.type === "select" && field.options && v) {
          const allowed = field.options.map((o: any) => o.value);
          if (!allowed.includes(v)) {
            errors[field.key] = "Invalid option";
            continue;
          }
        }
      }
    }
    return errors;
  };
}
