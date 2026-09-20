import { fieldLabel, hasRequiredFields } from "./fieldLabel";

test("a required question is marked with an asterisk, an optional one is not", () => {
  expect(fieldLabel({ key: "roof", label: "Roof condition", required: true })).toBe("Roof condition *");
  expect(fieldLabel({ key: "age", label: "Approximate age" })).toBe("Approximate age");
});

test("falls back to the key if a question has no label", () => {
  expect(fieldLabel({ key: "mystery" })).toBe("mystery");
});

test("the legend appears only when something is required", () => {
  expect(hasRequiredFields({ sections: [{ fields: [{ key: "a" }, { key: "b", required: true }] }] })).toBe(true);
  expect(hasRequiredFields({ sections: [{ fields: [{ key: "a" }] }] })).toBe(false);
  expect(hasRequiredFields({})).toBe(false);
});
