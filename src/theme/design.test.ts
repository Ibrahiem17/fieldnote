// Guards the accessibility rules in design/DESIGN.md §1. The colours came from a
// reference image that didn't all meet the 4.5:1 contrast minimum for small text,
// so the design deliberately uses deeper variants for text-bearing surfaces.
// If someone later "just tweaks a colour", these fail before it ships.

import { palette, splitTwoTone, statusColors, cardColors, tintedShadow } from "./design";

function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;

describe("text contrast (WCAG AA for normal-size text = 4.5:1)", () => {
  it("body text is readable on the cream and sheet backgrounds", () => {
    expect(contrast(palette.ink, palette.cream)).toBeGreaterThanOrEqual(AA);
    expect(contrast(palette.ink, palette.sheet)).toBeGreaterThanOrEqual(AA);
    expect(contrast(palette.inkMuted, palette.cream)).toBeGreaterThanOrEqual(AA);
    expect(contrast(palette.inkMuted, palette.sheet)).toBeGreaterThanOrEqual(AA);
    expect(contrast(palette.ink, palette.beige)).toBeGreaterThanOrEqual(AA);
  });

  it("small white text sits on the deep variants, which pass", () => {
    expect(contrast(palette.white, palette.purpleDeep)).toBeGreaterThanOrEqual(AA);
    expect(contrast(palette.white, palette.oliveDeep)).toBeGreaterThanOrEqual(AA);
    expect(contrast(palette.white, palette.red)).toBeGreaterThanOrEqual(AA);
  });

  it("text on amber is ink — white on amber fails", () => {
    expect(contrast(palette.ink, palette.amber)).toBeGreaterThanOrEqual(AA);
    expect(contrast(palette.white, palette.amber)).toBeLessThan(3);
    expect(cardColors.accent.on).toBe(palette.ink);
  });

  it("errors are readable on the backgrounds they appear on", () => {
    expect(contrast(palette.red, palette.cream)).toBeGreaterThanOrEqual(AA);
    expect(contrast(palette.red, palette.sheet)).toBeGreaterThanOrEqual(AA);
  });

  it("every status badge pairs its fill with a text colour that passes", () => {
    for (const { fill, on } of Object.values(statusColors)) {
      expect(contrast(on, fill)).toBeGreaterThanOrEqual(AA);
    }
  });

  it("the dark nav pill's light text passes", () => {
    expect(contrast(palette.cream, palette.ink)).toBeGreaterThanOrEqual(AA);
  });
});

describe("splitTwoTone (first word light, the rest bold)", () => {
  it("splits at the first space without changing the wording", () => {
    expect(splitTwoTone("Choose your fighter")).toEqual({ light: "Choose", bold: "your fighter" });
    expect(splitTwoTone("Site Safety Walk")).toEqual({ light: "Site", bold: "Safety Walk" });
  });
  it("a single word is just bold", () => {
    expect(splitTwoTone("Settings")).toEqual({ light: "", bold: "Settings" });
  });
  it("ignores surrounding spaces", () => {
    expect(splitTwoTone("  Hello world  ")).toEqual({ light: "Hello", bold: "world" });
  });
});

describe("tintedShadow", () => {
  it("casts the surface's own colour, not grey", () => {
    expect(tintedShadow(palette.purple, "card").shadowColor).toBe(palette.purple);
  });
  it("gets stronger from soft to float", () => {
    const soft = tintedShadow(palette.ink, "soft");
    const float = tintedShadow(palette.ink, "float");
    expect(float.shadowRadius as number).toBeGreaterThan(soft.shadowRadius as number);
    expect(float.elevation as number).toBeGreaterThan(soft.elevation as number);
  });
});
