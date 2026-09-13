-- Phase 3, Day 1 (fix) — base table privileges.
--
-- RLS policies (previous migration) decide WHICH ROWS a role can touch, but
-- Postgres still requires the ordinary GRANT system to say the role can
-- touch the TABLE at all, first. This project's Supabase instance didn't
-- have the usual `alter default privileges` auto-grant in place for new
-- tables, so every request came back "permission denied for table
-- projects" — not an RLS rejection, a missing grant, confirmed by actually
-- running the RLS test script and reading the real error rather than
-- assuming the policies alone were enough (docs/DESIGN.md D-018).

grant usage on schema public to authenticated, anon;

grant select, insert, update, delete on
  public.projects,
  public.inspections,
  public.answers,
  public.attachments
to authenticated;

grant select on public.templates to authenticated;

grant select, insert on public.sync_idempotency_keys to authenticated;
