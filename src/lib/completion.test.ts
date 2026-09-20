import { listProblems, summarizeProblems } from "./completion";

const schema = {
  sections: [
    { fields: [{ key: "roof_condition", label: "Roof condition" }, { key: "roof_age", label: "Approximate age (years)" }] },
    { fields: [{ key: "notes", label: "Notes" }] },
  ],
};

test("problems come back in form order, labelled with what the person saw", () => {
  const problems = listProblems(schema, { notes: "Maximum 5 characters", roof_condition: "Required" });
  expect(problems.map((p) => p.label)).toEqual(["Roof condition", "Notes"]);
});

test("an error for a key the schema doesn't know is still reported", () => {
  const problems = listProblems(schema, { mystery: "Required" });
  expect(problems).toEqual([{ key: "mystery", label: "mystery", message: "Required" }]);
});

test("the summary is a readable bulleted list", () => {
  const text = summarizeProblems(listProblems(schema, { roof_condition: "Required", roof_age: "Minimum 0" }));
  expect(text).toBe("• Roof condition — needs an answer\n• Approximate age (years) — minimum 0");
});

test("no errors, no problems", () => {
  expect(listProblems(schema, {})).toEqual([]);
});
