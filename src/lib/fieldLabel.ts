// src/lib/fieldLabel.ts
//
// What a question is called on screen. A required question gets a " *" so a
// person can see BEFORE tapping "Mark as complete" which ones they must answer
// (previously nothing on the form said so, and the first hint was an error).

type FieldLike = { key?: string; label?: string; required?: boolean };

export function fieldLabel(field: FieldLike): string {
  const base = field.label ?? field.key ?? "";
  return field.required ? `${base} *` : base;
}

/** True if any question in the template must be answered (drives the "* required" legend). */
export function hasRequiredFields(schema: { sections?: { fields?: FieldLike[] }[] }): boolean {
  return (schema.sections ?? []).some((section) => (section.fields ?? []).some((f) => f.required));
}
