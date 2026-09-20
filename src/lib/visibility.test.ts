// visibleIf operators. `in` was the only one for four phases; `equals` and
// `notEmpty` were named in the plan (Phase 2 Section 4.4) and added later
// (docs/DESIGN.md D-040). These pin down each operator's edge cases, since a
// wrong answer here silently hides or shows a field.

import { isFieldVisible } from "./visibility";

const rule = (visibleIf: Record<string, unknown>) => ({ visibleIf: { field: "ctl", ...visibleIf } });

describe("no rule", () => {
  it("is always visible", () => {
    expect(isFieldVisible({}, {})).toBe(true);
    expect(isFieldVisible({}, { anything: 1 })).toBe(true);
  });
});

describe("in", () => {
  const f = rule({ in: ["fair", "poor"] });
  it("shows when the controlling answer is listed", () => {
    expect(isFieldVisible(f, { ctl: "poor" })).toBe(true);
  });
  it("hides when it isn't listed, is missing, or is empty", () => {
    expect(isFieldVisible(f, { ctl: "good" })).toBe(false);
    expect(isFieldVisible(f, {})).toBe(false);
    expect(isFieldVisible(f, { ctl: "" })).toBe(false);
  });
  it("is case-sensitive — the exact bug select-as-free-text caused (D-034)", () => {
    expect(isFieldVisible(f, { ctl: "Poor" })).toBe(false);
  });
});

describe("equals", () => {
  it("matches a string exactly", () => {
    expect(isFieldVisible(rule({ equals: "yes" }), { ctl: "yes" })).toBe(true);
    expect(isFieldVisible(rule({ equals: "yes" }), { ctl: "no" })).toBe(false);
  });
  it("treats 0 as a real value, not as 'nothing'", () => {
    expect(isFieldVisible(rule({ equals: 0 }), { ctl: 0 })).toBe(true);
    expect(isFieldVisible(rule({ equals: 0 }), {})).toBe(false);
  });
  it("supports a ticked boolean, which is stored as 1", () => {
    expect(isFieldVisible(rule({ equals: 1 }), { ctl: 1 })).toBe(true);
    expect(isFieldVisible(rule({ equals: 1 }), { ctl: 0 })).toBe(false);
  });
  it("is strict: the string '1' is not the number 1", () => {
    expect(isFieldVisible(rule({ equals: 1 }), { ctl: "1" })).toBe(false);
  });
});

describe("notEmpty", () => {
  const f = rule({ notEmpty: true });
  it("shows for any real answer, including 0 and false-ish numbers", () => {
    expect(isFieldVisible(f, { ctl: "x" })).toBe(true);
    expect(isFieldVisible(f, { ctl: 0 })).toBe(true);
    expect(isFieldVisible(f, { ctl: ["a"] })).toBe(true);
  });
  it("hides for missing, null, empty string and empty list", () => {
    expect(isFieldVisible(f, {})).toBe(false);
    expect(isFieldVisible(f, { ctl: null })).toBe(false);
    expect(isFieldVisible(f, { ctl: "" })).toBe(false);
    expect(isFieldVisible(f, { ctl: [] })).toBe(false);
  });
  it("notEmpty: false adds no condition", () => {
    expect(isFieldVisible(rule({ notEmpty: false }), {})).toBe(true);
  });
});

describe("combined operators must all hold", () => {
  it("in + notEmpty", () => {
    const f = rule({ in: ["a", "b"], notEmpty: true });
    expect(isFieldVisible(f, { ctl: "a" })).toBe(true);
    expect(isFieldVisible(f, { ctl: "c" })).toBe(false);
  });
});
