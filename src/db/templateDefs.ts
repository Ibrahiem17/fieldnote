// src/db/templateDefs.ts
//
// The two real Phase 2 templates, as plain data — pulled out of seed.ts so
// this is the ONE place their JSON schema lives. seed.ts (real SQLite) and
// mockStore.ts (preview-mode fallback, D-013) both import from here.
//
// Why this file exists: before this, mockStore.ts had its own, separately
// hand-written template names/schemas that quietly drifted out of sync with
// seed.ts's real ones (caught once already for names — see docs/DESIGN.md
// D-014 — and a second time, worse, for the schema itself: the mock
// templates had `schemaJson: JSON.stringify({ fields: [] })`, no `sections`
// at all, which crashed FormRenderer.tsx's `schema.sections.map(...)` the
// moment you opened an inspection in the web preview). One shared file
// means there is no second copy left to drift.

export type TemplateDef = {
  id: string;
  name: string;
  version: number;
  schema: {
    id: string;
    name: string;
    version: number;
    sections: {
      id: string;
      title: string;
      fields: Record<string, unknown>[];
    }[];
  };
};

export const TEMPLATE_DEFS: TemplateDef[] = [
  {
    id: "roof-inspection-v1",
    name: "Roof Inspection",
    version: 1,
    schema: {
      id: "roof-inspection-v1",
      name: "Roof Inspection",
      version: 1,
      sections: [
        {
          id: "exterior",
          title: "Exterior",
          fields: [
            {
              key: "roof_condition",
              type: "select",
              label: "Roof condition",
              required: true,
              options: [
                { value: "good", label: "Good" },
                { value: "fair", label: "Fair" },
                { value: "poor", label: "Poor" },
              ],
            },
            {
              key: "damage_photos",
              type: "photo",
              label: "Photograph the damage",
              required: false,
              maxCount: 5,
              visibleIf: { field: "roof_condition", in: ["fair", "poor"] },
            },
            {
              key: "roof_age",
              type: "number",
              label: "Approximate age (years)",
              min: 0,
              max: 200,
            },
          ],
        },
        {
          id: "interior",
          title: "Interior",
          fields: [
            {
              key: "gutter_condition",
              type: "select",
              label: "Gutter condition",
              options: [
                { value: "ok", label: "OK" },
                { value: "blocked", label: "Blocked" },
              ],
            },
            { key: "notes", type: "longtext", label: "Notes" },
          ],
        },
      ],
    },
  },
  {
    id: "equipment-check-v1",
    name: "Equipment Check",
    version: 1,
    schema: {
      id: "equipment-check-v1",
      name: "Equipment Check",
      version: 1,
      sections: [
        {
          id: "general",
          title: "General",
          fields: [
            { key: "equipment_id", type: "text", label: "Equipment ID", required: true },
            { key: "serial_number", type: "text", label: "Serial number" },
            { key: "operational", type: "boolean", label: "Operational" },
          ],
        },
        {
          id: "measurements",
          title: "Measurements",
          fields: [
            { key: "voltage", type: "number", label: "Voltage (V)", min: 0, max: 1000 },
            { key: "temperature", type: "number", label: "Temperature (°C)", min: -50, max: 200 },
            { key: "notes", type: "longtext", label: "Notes" },
          ],
        },
      ],
    },
  },
];
