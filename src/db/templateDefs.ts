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
  /**
   * The template's DATABASE primary key — a fixed UUID, identical on every
   * device and on the server (supabase/migrations/20260920000001_seed_templates.sql
   * inserts the same rows). Not the same thing as `id` below, which is the
   * human-readable slug that's part of the template JSON format itself.
   * inspections.template_id points at THIS value, and on the server that column
   * is a uuid foreign key — so a slug here made every inspection unsyncable
   * (docs/DESIGN.md D-038). Never change one once shipped.
   */
  dbId: string;
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
    dbId: "dfc5b06c-4463-4b74-a1b3-e2224b0d4d3b",
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
    dbId: "faecdc99-0182-45ec-b42e-ba6e07e75ac9",
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
  // A third template, written using ONLY field types the engine already had
  // (select, boolean, number, longtext, photo, gps, signature, visibleIf "in") —
  // adding it touched no renderer, validator or report code, which is the
  // plan's "a new template needs zero code changes" claim, actually run
  // (docs/DESIGN.md D-040). It is also the first shipped template that uses
  // `gps` and `signature`, so both are reachable from the real UI.
  {
    dbId: "ed376cd2-b6be-4a1f-b9c4-22611faeceb0",
    id: "site-safety-walk-v1",
    name: "Site Safety Walk",
    version: 1,
    schema: {
      id: "site-safety-walk-v1",
      name: "Site Safety Walk",
      version: 1,
      sections: [
        {
          id: "site",
          title: "Site",
          fields: [
            { key: "site_location", type: "gps", label: "Site location" },
            {
              key: "weather",
              type: "select",
              label: "Weather",
              options: [
                { value: "clear", label: "Clear" },
                { value: "rain", label: "Rain" },
                { value: "wind", label: "High wind" },
              ],
            },
            { key: "crew_size", type: "number", label: "People on site", min: 0, max: 500 },
          ],
        },
        {
          id: "hazards",
          title: "Hazards",
          fields: [
            { key: "ppe_worn", type: "boolean", label: "Everyone wearing required PPE" },
            {
              key: "hazard_level",
              type: "select",
              label: "Hazard level",
              required: true,
              options: [
                { value: "none", label: "None" },
                { value: "low", label: "Low" },
                { value: "high", label: "High" },
              ],
            },
            {
              key: "hazard_notes",
              type: "longtext",
              label: "Describe the hazard",
              visibleIf: { field: "hazard_level", in: ["low", "high"] },
            },
            {
              key: "hazard_photos",
              type: "photo",
              label: "Photograph the hazard",
              maxCount: 5,
              visibleIf: { field: "hazard_level", in: ["high"] },
            },
          ],
        },
        {
          id: "signoff",
          title: "Sign-off",
          fields: [
            { key: "walk_notes", type: "longtext", label: "Notes" },
            { key: "inspector_signature", type: "signature", label: "Inspector signature" },
          ],
        },
      ],
    },
  },
];
