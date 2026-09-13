-- Phase 3, Day 1 — the server-side mirror of src/db/schema.ts.
--
-- Every table below matches the on-device SQLite table of the same name,
-- plus two columns no local table has:
--   - owner_id           which account this row belongs to (RLS keys off this)
--   - server_updated_at  set by a trigger, using the SERVER's clock, never a
--                        client-supplied value. This is the ONLY timestamp
--                        conflict resolution is ever allowed to compare
--                        (docs/DESIGN.md D-017, plan Section 2.8) — a
--                        device's own clock can be wrong, or set on purpose.
--
-- id/created_at/updated_at/deleted_at keep the exact same meaning and shape
-- (epoch-millisecond integers, device-generated UUID primary keys) as the
-- local schema — see src/db/schema.ts's own comments for why each exists.
-- `outbox` is NOT mirrored here: it's a purely local queue of *pending*
-- changes, not data the server needs a copy of.

-- ---------------------------------------------------------------------------
-- Shared trigger: stamp server_updated_at with the server's own clock.
-- ---------------------------------------------------------------------------

create or replace function public.set_server_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.server_updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- templates — shared reference data, not owned by any one user.
--
-- Hand-authored, seeded server-side (Phase 2's CLAUDE.md rule — "no
-- template-editor UI" — carries forward: this project never gives clients
-- insert/update/delete on this table, only select).
-- ---------------------------------------------------------------------------

create table if not exists public.templates (
  id uuid primary key,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  server_updated_at timestamptz not null default now(),
  name text not null,
  version integer not null default 1,
  schema_json text not null
);

create trigger templates_set_server_updated_at
  before insert or update on public.templates
  for each row execute function public.set_server_updated_at();

alter table public.templates enable row level security;

create policy "templates_select_authenticated"
  on public.templates for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  server_updated_at timestamptz not null default now(),
  name text not null,
  client_name text,
  address text,
  latitude double precision,
  longitude double precision,
  notes text
);

create index if not exists projects_owner_id_idx on public.projects (owner_id);

create trigger projects_set_server_updated_at
  before insert or update on public.projects
  for each row execute function public.set_server_updated_at();

alter table public.projects enable row level security;

create policy "projects_select_own" on public.projects for select using (auth.uid() = owner_id);
create policy "projects_insert_own" on public.projects for insert with check (auth.uid() = owner_id);
create policy "projects_update_own" on public.projects for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "projects_delete_own" on public.projects for delete using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- inspections
-- ---------------------------------------------------------------------------

create table if not exists public.inspections (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  server_updated_at timestamptz not null default now(),
  project_id uuid not null references public.projects(id) on delete cascade,
  template_id uuid references public.templates(id),
  title text not null,
  status text not null default 'draft',
  inspector_name text,
  started_at bigint,
  completed_at bigint,
  latitude double precision,
  longitude double precision,
  notes text
);

create index if not exists inspections_owner_id_idx on public.inspections (owner_id);
create index if not exists inspections_project_id_idx on public.inspections (project_id);
create index if not exists inspections_status_idx on public.inspections (status);

create trigger inspections_set_server_updated_at
  before insert or update on public.inspections
  for each row execute function public.set_server_updated_at();

alter table public.inspections enable row level security;

create policy "inspections_select_own" on public.inspections for select using (auth.uid() = owner_id);
create policy "inspections_insert_own" on public.inspections for insert with check (auth.uid() = owner_id);
create policy "inspections_update_own" on public.inspections for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "inspections_delete_own" on public.inspections for delete using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- answers
-- ---------------------------------------------------------------------------

create table if not exists public.answers (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  server_updated_at timestamptz not null default now(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  field_key text not null,
  value_text text,
  value_number double precision,
  value_json text
);

create index if not exists answers_owner_id_idx on public.answers (owner_id);
create index if not exists answers_inspection_id_idx on public.answers (inspection_id);

create trigger answers_set_server_updated_at
  before insert or update on public.answers
  for each row execute function public.set_server_updated_at();

alter table public.answers enable row level security;

create policy "answers_select_own" on public.answers for select using (auth.uid() = owner_id);
create policy "answers_insert_own" on public.answers for insert with check (auth.uid() = owner_id);
create policy "answers_update_own" on public.answers for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "answers_delete_own" on public.answers for delete using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- attachments
--
-- local_uri is kept nullable and purely informational server-side — it's a
-- path on one specific device's filesystem, meaningless to any other device
-- or to the server itself. remote_url (filled after upload, Day 6) is the
-- one every other device actually reads.
-- ---------------------------------------------------------------------------

create table if not exists public.attachments (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  server_updated_at timestamptz not null default now(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  field_key text not null,
  local_uri text,
  remote_url text,
  mime_type text,
  byte_size integer,
  width integer,
  height integer
);

create index if not exists attachments_owner_id_idx on public.attachments (owner_id);
create index if not exists attachments_inspection_id_idx on public.attachments (inspection_id);

create trigger attachments_set_server_updated_at
  before insert or update on public.attachments
  for each row execute function public.set_server_updated_at();

alter table public.attachments enable row level security;

create policy "attachments_select_own" on public.attachments for select using (auth.uid() = owner_id);
create policy "attachments_insert_own" on public.attachments for insert with check (auth.uid() = owner_id);
create policy "attachments_update_own" on public.attachments for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "attachments_delete_own" on public.attachments for delete using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- sync_idempotency_keys — Day 2's table, created now while the migration
-- file is open. Records every push request's Idempotency-Key so a repeated
-- request (the response was lost, the client retried) can be answered from
-- this table instead of re-applying the change (plan Section 2.5, 4.1).
-- ---------------------------------------------------------------------------

create table if not exists public.sync_idempotency_keys (
  key uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  response jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.sync_idempotency_keys enable row level security;

create policy "idempotency_select_own" on public.sync_idempotency_keys for select using (auth.uid() = owner_id);
create policy "idempotency_insert_own" on public.sync_idempotency_keys for insert with check (auth.uid() = owner_id);
