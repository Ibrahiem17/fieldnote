// src/lib/numberInput.ts
//
// Turns what someone has typed into a number field into a decision. The old
// code did `Number(text)` on every keystroke, which broke two things a phone
// keyboard exposes immediately (docs/DESIGN.md D-041):
//   - typing "3." became 3, so the dot vanished and "3.3" was impossible;
//   - clearing the box became 0 instead of "no answer".
// So: keep the raw text in the box while typing, and only store what parses.

export type ParsedNumberInput =
  | { kind: "empty" } //   nothing typed → store "no answer"
  | { kind: "number"; value: number } // a usable number → store it
  | { kind: "partial" }; //  "-", ".", "abc", "1.2.3" → don't store yet, keep typing

export function parseNumberInput(text: string): ParsedNumberInput {
  const t = text.trim();
  if (t === "") return { kind: "empty" };

  // Some keyboards/locales offer a comma as the decimal separator.
  const normalised = t.replace(",", ".");

  // Optional minus, digits, optional single dot, digits — and at least one digit.
  if (/^-?\d*\.?\d*$/.test(normalised) && /\d/.test(normalised)) {
    const n = Number(normalised); // "3." → 3, ".5" → 0.5, "-2.5" → -2.5
    if (Number.isFinite(n)) return { kind: "number", value: n };
  }
  return { kind: "partial" };
}
