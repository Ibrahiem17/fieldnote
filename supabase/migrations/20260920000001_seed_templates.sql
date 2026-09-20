-- 20260920000001_seed_templates.sql
--
-- Puts the app's built-in templates on the server, with the SAME fixed UUIDs
-- the app seeds locally (src/db/templateDefs.ts -> dbId).
--
-- Why this exists (docs/DESIGN.md D-038): inspections.template_id is a uuid
-- foreign key to public.templates(id), but nothing ever inserted a template
-- row here, and the app's local template ids were human slugs
-- ("roof-inspection-v1"). Every inspection created in the app from a template
-- therefore failed to sync — first seen on a real phone, because earlier
-- verification pushed rows with no template.
--
-- Clients only SELECT from templates (RLS, 20260913000001), so this has to be
-- applied by the project owner — run it once in the Supabase SQL editor.
-- Idempotent: safe to run more than once. GENERATED from templateDefs.ts;
-- src/db/templateDefs.test.ts fails if this file and the app drift apart.

insert into public.templates (id, created_at, updated_at, name, version, schema_json)
values (
  'dfc5b06c-4463-4b74-a1b3-e2224b0d4d3b',
  (extract(epoch from now()) * 1000)::bigint,
  (extract(epoch from now()) * 1000)::bigint,
  'Roof Inspection',
  1,
  $tmpl${"id":"roof-inspection-v1","name":"Roof Inspection","version":1,"sections":[{"id":"exterior","title":"Exterior","fields":[{"key":"roof_condition","type":"select","label":"Roof condition","required":true,"options":[{"value":"good","label":"Good"},{"value":"fair","label":"Fair"},{"value":"poor","label":"Poor"}]},{"key":"damage_photos","type":"photo","label":"Photograph the damage","required":false,"maxCount":5,"visibleIf":{"field":"roof_condition","in":["fair","poor"]}},{"key":"roof_age","type":"number","label":"Approximate age (years)","min":0,"max":200}]},{"id":"interior","title":"Interior","fields":[{"key":"gutter_condition","type":"select","label":"Gutter condition","options":[{"value":"ok","label":"OK"},{"value":"blocked","label":"Blocked"}]},{"key":"notes","type":"longtext","label":"Notes"}]}]}$tmpl$
)
on conflict (id) do nothing;

insert into public.templates (id, created_at, updated_at, name, version, schema_json)
values (
  'faecdc99-0182-45ec-b42e-ba6e07e75ac9',
  (extract(epoch from now()) * 1000)::bigint,
  (extract(epoch from now()) * 1000)::bigint,
  'Equipment Check',
  1,
  $tmpl${"id":"equipment-check-v1","name":"Equipment Check","version":1,"sections":[{"id":"general","title":"General","fields":[{"key":"equipment_id","type":"text","label":"Equipment ID","required":true},{"key":"serial_number","type":"text","label":"Serial number"},{"key":"operational","type":"boolean","label":"Operational"}]},{"id":"measurements","title":"Measurements","fields":[{"key":"voltage","type":"number","label":"Voltage (V)","min":0,"max":1000},{"key":"temperature","type":"number","label":"Temperature (°C)","min":-50,"max":200},{"key":"notes","type":"longtext","label":"Notes"}]}]}$tmpl$
)
on conflict (id) do nothing;
