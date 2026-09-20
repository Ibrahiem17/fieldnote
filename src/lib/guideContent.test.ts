import { BANNED_GUIDE_WORDS, GUIDE } from "./guideContent";
import { INSPECTION_STATUSES } from "@/db/schema";

// Flatten every string the guide can show.
function allText(): string[] {
  return [
    GUIDE.purpose.title,
    ...GUIDE.purpose.paragraphs,
    GUIDE.steps.title,
    ...GUIDE.steps.items.flatMap((s) => [s.title, s.body]),
    GUIDE.offline.title,
    ...GUIDE.offline.items.flatMap((s) => [s.title, s.body]),
    GUIDE.labels.title,
    ...GUIDE.labels.items.map((s) => s.body),
    GUIDE.trouble.title,
    ...GUIDE.trouble.items.flatMap((s) => [s.title, s.body]),
    GUIDE.data.title,
    ...GUIDE.data.paragraphs,
    GUIDE.start,
  ];
}

describe("guide content", () => {
  it("has four steps, each with a title, a body and an icon", () => {
    expect(GUIDE.steps.items).toHaveLength(4);
    for (const step of GUIDE.steps.items) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(20);
      expect(step.icon).toBeTruthy();
    }
  });

  it("explains every inspection status the app has", () => {
    const explained = GUIDE.labels.items.map((i) => i.status).sort();
    expect([...INSPECTION_STATUSES].sort()).toEqual(explained);
  });

  it("never shows a first-time user developer words", () => {
    for (const text of allText()) {
      for (const word of BANNED_GUIDE_WORDS) {
        expect({ text, word, found: new RegExp(`\\b${word}\\b`, "i").test(text) }).toMatchObject({
          found: false,
        });
      }
    }
  });

  it("has no empty strings", () => {
    for (const text of allText()) expect(text.trim().length).toBeGreaterThan(0);
  });
});
