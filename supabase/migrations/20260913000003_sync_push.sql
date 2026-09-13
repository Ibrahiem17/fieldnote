-- Phase 3, Day 2 — the push endpoint, as a Postgres function (RPC) rather
-- than a hand-written HTTP server. supabase-js calls this the same way it
-- calls any other Supabase function: `supabase.rpc('sync_push', {...})`,
-- over HTTPS, with the caller's own auth token attached automatically.
--
-- Why an RPC and not a custom "POST /sync/push" server: this project has no
-- server of its own to run — Supabase's own infrastructure IS the backend.
-- A Postgres function is the one way to get server-side ATOMICITY (check
-- the idempotency key, apply the change, and record the key, all as one
-- transaction) without standing up and deploying a separate Edge Function
-- for what is, underneath, a single database operation.
--
-- Deliberately supports only project/inspection/answer for Day 2 —
-- attachments are excluded on purpose: an attachment ROW with no uploaded
-- FILE behind it (Day 6) would be misleading to sync now. See
-- docs/DESIGN.md D-019 for the full reasoning and what Day 2 does and
-- doesn't cover.

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

  -- Idempotency (plan Section 2.5): a repeat of a request already applied
  -- returns the SAME recorded response instead of re-applying the change.
  -- This is what makes "send the same request twice, confirm one row"
  -- actually true, rather than merely true the first time you try it.
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
      -- update or (soft) delete: only overwrite a column when the payload
      -- actually carries that key (`?` is jsonb's "has this key" operator).
      -- A patch like `{ id, status, updatedAt }` must leave every other
      -- column exactly as it was — this is what makes a partial local
      -- update push correctly instead of blanking every field it didn't
      -- mention.
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

  else
    raise exception 'unsupported entity_type for push: % (attachments sync from Day 6 onward)', p_entity_type
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
