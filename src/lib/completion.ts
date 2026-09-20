// src/lib/completion.ts
//
// When someone taps "Mark as complete", the validator (src/lib/validation.ts)
// returns errors keyed by the template's internal field key — `roof_condition:
// Required`. That's meaningless to a person. These helpers put the errors back
// in template order and swap each key for the label the person actually saw.

export type SchemaLike = {
  sections?: { fields?: { key: string; label?: string }[] }[];
};

export type Problem = { key: string; label: string; message: string };

/** Errors as readable problems, in the order the fields appear on the form. */
export function listProblems(schema: SchemaLike, errors: Record<string, string>): Problem[] {
  const problems: Problem[] = [];
  for (const section of schema.sections ?? []) {
    for (const field of section.fields ?? []) {
      const message = errors[field.key];
      if (message) problems.push({ key: field.key, label: field.label ?? field.key, message });
    }
  }
  // Anything the schema doesn't know about still gets reported, never dropped.
  const known = new Set(problems.map((p) => p.key));
  for (const [key, message] of Object.entries(errors)) {
    if (!known.has(key)) problems.push({ key, label: key, message });
  }
  return problems;
}

/** "Required" reads as a demand; in a sentence it should read as guidance. */
function friendlyMessage(message: string): string {
  return message === "Required" ? "needs an answer" : message.charAt(0).toLowerCase() + message.slice(1);
}

/** A bulleted list for an alert: "• Roof condition — needs an answer". */
export function summarizeProblems(problems: Problem[]): string {
  return problems.map((p) => `• ${p.label} — ${friendlyMessage(p.message)}`).join("\n");
}
