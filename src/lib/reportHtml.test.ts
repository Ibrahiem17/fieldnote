// Tests the report's HTML builder with hand-made data (no database, no
// device). This proves the data → HTML logic — what appears, what's escaped,
// what's omitted — NOT that a PDF renders on a phone; that still needs a real
// device (docs/TEST-RESULTS-PHASE-4.md TC-01..TC-07).

import { buildReportHtml } from "./reportHtml";
import type { ReportData } from "./report";

function makeData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    inspection: {
      id: "insp-1",
      title: "Roof check",
      status: "in_progress",
      inspectorName: "A. Inspector",
      completedAt: null,
      updatedAt: 1_700_000_000_000,
    },
    project: { name: "Harbor Site", clientName: "Acme", address: "1 Dock Rd" },
    templateName: "Roof Inspection",
    templateVersion: 1,
    sections: [
      {
        id: "exterior",
        title: "Exterior",
        fields: [
          { key: "roof_condition", label: "Roof condition", type: "select", displayValue: "Fair" },
          { key: "roof_age", label: "Approximate age (years)", type: "number", displayValue: "Not recorded" },
        ],
      },
    ],
    photoGroups: [],
    signatureAttachment: null,
    gps: null,
    generatedAt: 1_700_000_000_000,
    ...overrides,
  } as unknown as ReportData;
}

describe("buildReportHtml", () => {
  it("shows the header details and each answered field", async () => {
    const html = await buildReportHtml(makeData());
    expect(html).toContain("Roof check");
    expect(html).toContain("Roof Inspection");
    expect(html).toContain("v1");
    expect(html).toContain("In Progress");
    expect(html).toContain("Exterior");
    expect(html).toContain("Roof condition");
    expect(html).toContain(">Fair<");
  });

  it('marks an unanswered field "Not recorded" and styles it as such', async () => {
    const html = await buildReportHtml(makeData());
    expect(html).toMatch(/class="field-value not-recorded">Not recorded</);
  });

  it("does not style an answered field as not-recorded", async () => {
    const html = await buildReportHtml(makeData());
    expect(html).not.toMatch(/not-recorded">Fair</);
  });

  it("omits the Photos section and any <img> when there are no photos", async () => {
    const html = await buildReportHtml(makeData());
    expect(html).not.toContain("<h2>Photos</h2>");
    expect(html).not.toContain("<img");
  });

  it("omits the Photos section when a photo has no local file", async () => {
    const html = await buildReportHtml(
      makeData({
        photoGroups: [
          {
            fieldKey: "damage_photos",
            label: "Photograph the damage",
            attachments: [{ id: "a1", localUri: null, mimeType: "image/jpeg" } as never],
          },
        ],
      }),
    );
    expect(html).not.toContain("<h2>Photos</h2>");
  });

  it("escapes user-supplied text so it can't inject markup", async () => {
    const html = await buildReportHtml(
      makeData({
        inspection: {
          id: "x",
          title: '<script>alert("x")</script>',
          status: "draft",
          inspectorName: "A & B",
          completedAt: null,
          updatedAt: 1_700_000_000_000,
        } as never,
        sections: [
          {
            id: "s",
            title: "<b>Bold</b>",
            fields: [{ key: "k", label: "L<>", type: "text", displayValue: "5 > 3 & 2 < 4" }],
          },
        ],
      }),
    );
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<b>Bold</b>");
    expect(html).toContain("5 &gt; 3 &amp; 2 &lt; 4");
    expect(html).toContain("A &amp; B");
  });

  it('shows "Not recorded" for a missing project instead of crashing', async () => {
    const html = await buildReportHtml(makeData({ project: null }));
    expect(html).toContain("Not recorded");
    expect(html).toContain("Roof check");
  });

  it("includes the location block with 6-decimal coordinates and rounded accuracy", async () => {
    const html = await buildReportHtml(makeData({ gps: { latitude: 10.1234567, longitude: 20.7654321, accuracy: 99.6 } }));
    expect(html).toContain("<h2>Location</h2>");
    expect(html).toContain("10.123457, 20.765432");
    expect(html).toContain("&plusmn;100m");
  });

  it("omits the location block when there is no GPS reading", async () => {
    const html = await buildReportHtml(makeData({ gps: null }));
    expect(html).not.toContain("<h2>Location</h2>");
  });
});

// The PDF must not change when the app is restyled (design decision, D-046):
// it reads its own frozen palette, never the app's live theme.
describe("report styling is frozen", () => {
  it("still uses the original blue, not the app's new purple", async () => {
    const html = await buildReportHtml(makeData());
    expect(html).toContain("#2563EB"); // original primary
    expect(html).not.toContain("#8B63C9"); // the new brand purple
    expect(html).not.toContain("#F7F3E6"); // the new cream
  });
});
