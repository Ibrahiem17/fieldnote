import { parseNumberInput } from "./numberInput";

describe("parseNumberInput", () => {
  it("treats blank input as 'no answer', not zero", () => {
    expect(parseNumberInput("")).toEqual({ kind: "empty" });
    expect(parseNumberInput("   ")).toEqual({ kind: "empty" });
  });

  it("parses whole and decimal numbers", () => {
    expect(parseNumberInput("7")).toEqual({ kind: "number", value: 7 });
    expect(parseNumberInput("3.3")).toEqual({ kind: "number", value: 3.3 });
    expect(parseNumberInput("-2.5")).toEqual({ kind: "number", value: -2.5 });
    expect(parseNumberInput("0")).toEqual({ kind: "number", value: 0 });
  });

  it("accepts a trailing dot while typing (the value is what's typed so far)", () => {
    expect(parseNumberInput("3.")).toEqual({ kind: "number", value: 3 });
    expect(parseNumberInput(".5")).toEqual({ kind: "number", value: 0.5 });
  });

  it("accepts a comma as the decimal separator", () => {
    expect(parseNumberInput("3,3")).toEqual({ kind: "number", value: 3.3 });
  });

  it("does not turn unfinished or invalid text into a number", () => {
    expect(parseNumberInput("-")).toEqual({ kind: "partial" });
    expect(parseNumberInput(".")).toEqual({ kind: "partial" });
    expect(parseNumberInput("abc")).toEqual({ kind: "partial" });
    expect(parseNumberInput("1.2.3")).toEqual({ kind: "partial" });
    expect(parseNumberInput("12abc")).toEqual({ kind: "partial" });
  });
});
