// src/lib/validation.test.ts
//
// Phase 4, Day 5. Tests the REAL runtime validator (src/lib/validation.ts),
// not the plan's literal "Zod schema generation" — this codebase never
// added Zod (already documented, docs/DESIGN.md D-027); buildValidator is
// hand-rolled, and only checks what it actually implements: required,
// number min/max, text/longtext maxLength, and select-options-as-enum.
// Nothing here asserts behavior for a check (e.g. a regex pattern, a
// minLength) that was never built.

import { buildValidator } from "./validation";

function schemaWith(fields: any[]) {
  return { sections: [{ id: "s1", title: "Section", fields }] };
}

test("a required field left empty is blocked", () => {
  const validate = buildValidator(
    schemaWith([{ key: "title", type: "text", label: "Title", required: true }]),
  );
  const errors = validate({});
  expect(errors.title).toBe("Required");
});

test("a required field that's answered passes", () => {
  const validate = buildValidator(
    schemaWith([{ key: "title", type: "text", label: "Title", required: true }]),
  );
  const errors = validate({ title: "Roof inspection" });
  expect(errors.title).toBeUndefined();
});

test("a number below min is blocked", () => {
  const validate = buildValidator(
    schemaWith([{ key: "age", type: "number", label: "Age", min: 0, max: 200 }]),
  );
  const errors = validate({ age: -5 });
  expect(errors.age).toBe("Minimum 0");
});

test("a number above max is blocked", () => {
  const validate = buildValidator(
    schemaWith([{ key: "age", type: "number", label: "Age", min: 0, max: 200 }]),
  );
  const errors = validate({ age: 500 });
  expect(errors.age).toBe("Maximum 200");
});

test("a number inside its bounds passes", () => {
  const validate = buildValidator(
    schemaWith([{ key: "age", type: "number", label: "Age", min: 0, max: 200 }]),
  );
  const errors = validate({ age: 42 });
  expect(errors.age).toBeUndefined();
});

test("text over its maxLength is blocked", () => {
  const validate = buildValidator(
    schemaWith([{ key: "notes", type: "longtext", label: "Notes", maxLength: 10 }]),
  );
  const errors = validate({ notes: "this is far more than ten characters" });
  expect(errors.notes).toBe("Maximum 10 characters");
});

test("a select value not in its options is rejected", () => {
  const validate = buildValidator(
    schemaWith([
      {
        key: "condition",
        type: "select",
        label: "Condition",
        options: [
          { value: "good", label: "Good" },
          { value: "poor", label: "Poor" },
        ],
      },
    ]),
  );
  const errors = validate({ condition: "excellent" }); // not one of the two real options
  expect(errors.condition).toBe("Invalid option");
});

test("a select value that IS one of its options passes", () => {
  const validate = buildValidator(
    schemaWith([
      {
        key: "condition",
        type: "select",
        label: "Condition",
        options: [
          { value: "good", label: "Good" },
          { value: "poor", label: "Poor" },
        ],
      },
    ]),
  );
  const errors = validate({ condition: "poor" });
  expect(errors.condition).toBeUndefined();
});

test("a visibleIf-hidden required field is excluded from validation entirely (shared src/lib/visibility.ts)", () => {
  const validate = buildValidator(
    schemaWith([
      {
        key: "roof_condition",
        type: "select",
        label: "Roof condition",
        options: [
          { value: "good", label: "Good" },
          { value: "poor", label: "Poor" },
        ],
      },
      {
        key: "damage_photos",
        type: "photo",
        label: "Damage photos",
        required: true,
        visibleIf: { field: "roof_condition", in: ["poor"] },
      },
    ]),
  );

  // roof_condition is "good" -> damage_photos stays hidden -> its own
  // `required: true` must never be checked at all.
  const errors = validate({ roof_condition: "good" });
  expect(errors.damage_photos).toBeUndefined();
});

test("the same field, once its visibleIf condition IS met, is validated normally", () => {
  const validate = buildValidator(
    schemaWith([
      {
        key: "roof_condition",
        type: "select",
        label: "Roof condition",
        options: [
          { value: "good", label: "Good" },
          { value: "poor", label: "Poor" },
        ],
      },
      {
        key: "roof_age",
        type: "number",
        label: "Roof age",
        required: true,
        visibleIf: { field: "roof_condition", in: ["poor"] },
      },
    ]),
  );

  const errors = validate({ roof_condition: "poor" }); // roof_age left unanswered, but now visible
  expect(errors.roof_age).toBe("Required");
});
