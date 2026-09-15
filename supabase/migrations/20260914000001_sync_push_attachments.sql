-- Phase 3, Day 6 — extends `sync_push` (20260913000003_sync_push.sql) with an
-- `attachment` branch. `create or replace function` needs the WHOLE body
-- restated, not a diff — Postgres has no "add one branch" migration
-- primitive for a function, so this file is the Day 2 function again, with
-- one new `elsif` block added where Day 2 deliberately left a placeholder
-- exception (docs/DESIGN.md D-019: "attachments are excluded on purpose").
--
-- Why attachment rows are safe to push now, when Day 2 said they weren't:
-- the row alone was the problem then (a synced row with no file behind it
-- would be a lie other devices might trust). Day 6's upload flow
-- (src/lib/attachmentUpload.ts) never marks the local outbox entry
-- consumed until the FILE has actually landed in Storage too — so by the
-- time this RPC's attachment branch is called for an insert, either (a)
-- it's this row's first attempt, the file hasn't uploaded yet, and the row
-- is pushed deliberately WITH `remote_url = null` (still "no file" — but
-- now truthfully so, matching what's actually happened), or (b) it's a
-- second, small "the file landed, here's the path" push for the SAME row,
-- which is a plain field update like any other.
--
-- local_uri is stored too (the `attachments` table already had the column
-- since Day 1's init_schema.sql) — purely informational, a path on one
-- specific device's filesystem that means nothing to any other device or
-- to the server itself; every other device only ever reads remote_url.

create or replace function public.sync_push(
  p_idempotency_key uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_operation text,
  p_payload jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_owner uuid := auth.uid();
  v_existing jsonb;
  v_response jsonb;
begin
  if v_owner is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_operation not in ('insert', 'update', 'delete') then
    raise exception 'unknown operation: %', p_operation using errcode = '22023';
  end if;

  select response into v_existing
    from public.sync_idempotency_keys
    where key = p_idempotency_key and owner_id = v_owner;

  if v_existing is not null then
    return jsonb_set(v_existing, '{duplicate}', 'true');
  end if;

  if p_entity_type = 'project' then

    if p_operation = 'insert' then
      insert into public.projects
        (id, owner_id, created_at, updated_at, deleted_at, name, client_name, address, latitude, longitude, notes)
      values (
        p_entity_id, v_owner,
        (p_payload->>'createdAt')::bigint,
        (p_payload->>'updatedAt')::bigint,
        nullif(p_payload->>'deletedAt', '')::bigint,
        p_payload->>'name',
        p_payload->>'clientName',
        p_payload->>'address',
        (p_payload->>'latitude')::double precision,
        (p_payload->>'longitude')::double precision,
        p_payload->>'notes'
      )
      on conflict (id) do nothing;
    else
      update public.projects t set
        name = case when p_payload ? 'name' then p_payload->>'name' else t.name end,
        client_name = case when p_payload ? 'clientName' then p_payload->>'clientName' else t.client_name end,
        address = case when p_payload ? 'address' then p_payload->>'address' else t.address end,
        latitude = case when p_payload ? 'latitude' then (p_payload->>'latitude')::double precision else t.latitude end,
        longitude = case when p_payload ? 'longitude' then (p_payload->>'longitude')::double precision else t.longitude end,
        notes = case when p_payload ? 'notes' then p_payload->>'notes' else t.notes end,
        deleted_at = case when p_payload ? 'deletedAt' then (p_payload->>'deletedAt')::bigint else t.deleted_at end,
        updated_at = coalesce((p_payload->>'updatedAt')::bigint, (p_payload->>'deletedAt')::bigint, t.updated_at)
      where t.id = p_entity_id and t.owner_id = v_owner;
    end if;

  elsif p_entity_type = 'inspection' then

    if p_operation = 'insert' then
      insert into public.inspections
        (id, owner_id, created_at, updated_at, deleted_at, project_id, template_id, title, status,
         inspector_name, started_at, completed_at, latitude, longitude, notes)
      values (
        p_entity_id, v_owner,
        (p_payload->>'createdAt')::bigint,
        (p_payload->>'updatedAt')::bigint,
        nullif(p_payload->>'deletedAt', '')::bigint,
        (p_payload->>'projectId')::uuid,
        nullif(p_payload->>'templateId', '')::uuid,
        p_payload->>'title',
        coalesce(p_payload->>'status', 'draft'),
        p_payload->>'inspectorName',
        (p_payload->>'startedAt')::bigint,
        (p_payload->>'completedAt')::bigint,
        (p_payload->>'latitude')::double precision,
        (p_payload->>'longitude')::double precision,
        p_payload->>'notes'
      )
      on conflict (id) do nothing;
    else
      update public.inspections t set
        title = case when p_payload ? 'title' then p_payload->>'title' else t.title end,
        status = case when p_payload ? 'status' then p_payload->>'status' else t.status end,
        inspector_name = case when p_payload ? 'inspectorName' then p_payload->>'inspectorName' else t.inspector_name end,
        completed_at = case when p_payload ? 'completedAt' then (p_payload->>'completedAt')::bigint else t.completed_at end,
        latitude = case when p_payload ? 'latitude' then (p_payload->>'latitude')::double precision else t.latitude end,
        longitude = case when p_payload ? 'longitude' then (p_payload->>'longitude')::double precision else t.longitude end,
        notes = case when p_payload ? 'notes' then p_payload->>'notes' else t.notes end,
        deleted_at = case when p_payload ? 'deletedAt' then (p_payload->>'deletedAt')::bigint else t.deleted_at end,
        updated_at = coalesce((p_payload->>'updatedAt')::bigint, (p_payload->>'deletedAt')::bigint, t.updated_at)
      where t.id = p_entity_id and t.owner_id = v_owner;
    end if;

  elsif p_entity_type = 'answer' then

    if p_operation = 'insert' then
      insert into public.answers
        (id, owner_id, created_at, updated_at, deleted_at, inspection_id, field_key, value_text, value_number, value_json)
      values (
        p_entity_id, v_owner,
        (p_payload->>'createdAt')::bigint,
        (p_payload->>'updatedAt')::bigint,
        nullif(p_payload->>'deletedAt', '')::bigint,
        (p_payload->>'inspectionId')::uuid,
        p_payload->>'fieldKey',
        p_payload->>'valueText',
        (p_payload->>'valueNumber')::double precision,
        p_payload->>'valueJson'
      )
      on conflict (id) do nothing;
    else
      update public.answers t set
        value_text = case when p_payload ? 'valueText' then p_payload->>'valueText' else t.value_text end,
        value_number = case when p_payload ? 'valueNumber' then (p_payload->>'valueNumber')::double precision else t.value_number end,
        value_json = case when p_payload ? 'valueJson' then p_payload->>'valueJson' else t.value_json end,
        deleted_at = case when p_payload ? 'deletedAt' then (p_payload->>'deletedAt')::bigint else t.deleted_at end,
        updated_at = coalesce((p_payload->>'updatedAt')::bigint, (p_payload->>'deletedAt')::bigint, t.updated_at)
      where t.id = p_entity_id and t.owner_id = v_owner;
    end if;

  elsif p_entity_type = 'attachment' then

    if p_operation = 'insert' then
      insert into public.attachments
        (id, owner_id, created_at, updated_at, deleted_at, inspection_id, field_key,
         local_uri, remote_url, mime_type, byte_size, width, height)
      values (
        p_entity_id, v_owner,
        (p_payload->>'createdAt')::bigint,
        (p_payload->>'updatedAt')::bigint,
        nullif(p_payload->>'deletedAt', '')::bigint,
        (p_payload->>'inspectionId')::uuid,
        p_payload->>'fieldKey',
        p_payload->>'localUri',
        p_payload->>'remoteUrl',
        p_payload->>'mimeType',
        (p_payload->>'byteSize')::integer,
        (p_payload->>'width')::integer,
        (p_payload->>'height')::integer
      )
      on conflict (id) do nothing;
    else
      -- Covers both the Day 6 "the file landed, here's remote_url" follow-up
      -- push (a plain field update, same `?`-guarded pattern as every other
      -- entity's update branch) and a soft-delete.
      update public.attachments t set
        remote_url = case when p_payload ? 'remoteUrl' then p_payload->>'remoteUrl' else t.remote_url end,
        mime_type = case when p_payload ? 'mimeType' then p_payload->>'mimeType' else t.mime_type end,
        byte_size = case when p_payload ? 'byteSize' then (p_payload->>'byteSize')::integer else t.byte_size end,
        width = case when p_payload ? 'width' then (p_payload->>'width')::integer else t.width end,
        height = case when p_payload ? 'height' then (p_payload->>'height')::integer else t.height end,
        deleted_at = case when p_payload ? 'deletedAt' then (p_payload->>'deletedAt')::bigint else t.deleted_at end,
        updated_at = coalesce((p_payload->>'updatedAt')::bigint, (p_payload->>'deletedAt')::bigint, t.updated_at)
      where t.id = p_entity_id and t.owner_id = v_owner;
    end if;

  else
    raise exception 'unsupported entity_type for push: %', p_entity_type
      using errcode = '22023';
  end if;

  v_response := jsonb_build_object(
    'ok', true,
    'entityType', p_entity_type,
    'entityId', p_entity_id,
    'operation', p_operation,
    'duplicate', false
  );

  insert into public.sync_idempotency_keys (key, owner_id, entity_type, entity_id, response)
  values (p_idempotency_key, v_owner, p_entity_type, p_entity_id, v_response);

  return v_response;
end;
$$;

grant execute on function public.sync_push(uuid, text, uuid, text, jsonb) to authenticated;
