import { formatDateInput, formatIsoDateForDisplay, isValidIsoDate, todayIso } from "./dates";

describe("formatDateInput (typed entry)", () => {
  it("inserts hyphens as digits are typed", () => {
    expect(formatDateInput("2")).toBe("2");
    expect(formatDateInput("2026")).toBe("2026");
    expect(formatDateInput("20260")).toBe("2026-0");
    expect(formatDateInput("202609")).toBe("2026-09");
    expect(formatDateInput("2026092")).toBe("2026-09-2");
    expect(formatDateInput("20260921")).toBe("2026-09-21");
  });
  it("ignores non-digits and caps at 8 digits", () => {
    expect(formatDateInput("2026-09-21")).toBe("2026-09-21");
    expect(formatDateInput("2026/09/21")).toBe("2026-09-21");
    expect(formatDateInput("abc")).toBe("");
    expect(formatDateInput("202609211234")).toBe("2026-09-21");
  });
  it("survives backspacing over an inserted hyphen", () => {
    expect(formatDateInput("2026-")).toBe("2026");
  });
});

describe("isValidIsoDate", () => {
  it("accepts real dates, including a leap day", () => {
    expect(isValidIsoDate("2026-09-21")).toBe(true);
    expect(isValidIsoDate("2028-02-29")).toBe(true);
  });
  it("rejects impossible dates", () => {
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2027-02-29")).toBe(false); // not a leap year
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("2026-00-10")).toBe(false);
    expect(isValidIsoDate("2026-09-00")).toBe(false);
    expect(isValidIsoDate("2026-04-31")).toBe(false);
  });
  it("rejects wrong shapes", () => {
    expect(isValidIsoDate("")).toBe(false);
    expect(isValidIsoDate("2026-9-1")).toBe(false);
    expect(isValidIsoDate("21-09-2026")).toBe(false);
    expect(isValidIsoDate("2026-09-21T00:00")).toBe(false);
  });
});

describe("formatIsoDateForDisplay", () => {
  it("writes the month as a word, so it can't be misread as day/month", () => {
    expect(formatIsoDateForDisplay("2026-09-21")).toBe("21 Sep 2026");
    expect(formatIsoDateForDisplay("2026-01-05")).toBe("5 Jan 2026");
  });
  it("returns invalid input unchanged rather than inventing a date", () => {
    expect(formatIsoDateForDisplay("nope")).toBe("nope");
    expect(formatIsoDateForDisplay("2026-02-30")).toBe("2026-02-30");
  });
});


describe("todayIso", () => {
  it("formats the phone's local date with zero padding", () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(todayIso(new Date(2026, 8, 21, 23, 59))).toBe("2026-09-21");
  });
  it("always produces a date the validator accepts", () => {
    expect(isValidIsoDate(todayIso(new Date(2028, 1, 29)))).toBe(true);
  });
});
