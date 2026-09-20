-- 20260920000002_seed_safety_walk_template.sql
--
-- Adds the third built-in template ("Site Safety Walk") to the server, with the
-- same fixed UUID the app uses (src/db/templateDefs.ts -> dbId). Same reasoning
-- as 20260920000001_seed_templates.sql (docs/DESIGN.md D-038, D-040): an
-- inspection's template_id is a uuid foreign key to public.templates(id), so the
-- row must exist here before an inspection using it can sync.
--
-- Clients only SELECT from templates, so the project owner runs this once in the
-- Supabase SQL editor. Idempotent. GENERATED from templateDefs.ts;
-- src/db/templateDefs.test.ts fails if this file and the app drift apart.

insert into public.templates (id, created_at, updated_at, name, version, schema_json)
values (
  'ed376cd2-b6be-4a1f-b9c4-22611faeceb0',
  (extract(epoch from now()) * 1000)::bigint,
  (extract(epoch from now()) * 1000)::bigint,
  'Site Safety Walk',
  1,
  $tmpl${"id":"site-safety-walk-v1","name":"Site Safety Walk","version":1,"sections":[{"id":"site","title":"Site","fields":[{"key":"site_location","type":"gps","label":"Site location"},{"key":"weather","type":"select","label":"Weather","options":[{"value":"clear","label":"Clear"},{"value":"rain","label":"Rain"},{"value":"wind","label":"High wind"}]},{"key":"walk_date","type":"date","label":"Walk date"},{"key":"crew_size","type":"number","label":"People on site","min":0,"max":500}]},{"id":"hazards","title":"Hazards","fields":[{"key":"ppe_worn","type":"boolean","label":"Everyone wearing required PPE"},{"key":"hazard_level","type":"select","label":"Hazard level","required":true,"options":[{"value":"none","label":"None"},{"value":"low","label":"Low"},{"value":"high","label":"High"}]},{"key":"hazard_notes","type":"longtext","label":"Describe the hazard","visibleIf":{"field":"hazard_level","in":["low","high"]}},{"key":"hazard_photos","type":"photo","label":"Photograph the hazard","maxCount":5,"visibleIf":{"field":"hazard_level","in":["high"]}}]},{"id":"signoff","title":"Sign-off","fields":[{"key":"walk_notes","type":"longtext","label":"Notes"},{"key":"inspector_signature","type":"signature","label":"Inspector signature"}]}]}$tmpl$
)
on conflict (id) do nothing;
