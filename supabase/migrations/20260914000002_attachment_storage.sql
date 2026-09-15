-- Phase 3, Day 6 — the Storage bucket attachment files actually upload
-- into, plus object-level RLS so one user's photos are as private as their
-- database rows already are.
--
-- Object path convention: `{owner_id}/{attachment_id}{ext}` — e.g.
-- `3fae.../9c21....jpg`. `owner_id` as the FIRST path segment (a "folder")
-- is what lets a policy check ownership from the path alone, via Storage's
-- own `storage.foldername(name)` helper — the same `auth.uid() = owner_id`
-- shape every table's RLS already uses, just read out of the object path
-- instead of a column, because storage.objects has no owner_id column of
-- its own to compare against for THIS project's objects (Storage's schema
-- doesn't know this app's ownership model — the path is how we tell it).
--
-- Not public: `public.attachments.remote_url` stores the raw object PATH,
-- not a signable/browsable URL — a viewer calls
-- `supabase.storage.from('attachments').createSignedUrl(path, ttl)` to
-- actually view a photo, on demand, short-lived. Storing a public URL would
-- mean either making the bucket public (any inspection photo readable by
-- anyone with the link, forever) or storing a signed URL that silently
-- expires and stops working — both wrong for what's meant to be private
-- field-inspection photography.

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "attachments_storage_select_own"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "attachments_storage_insert_own"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- `upsert: true` on the client (src/lib/attachmentUpload.ts) is how a
-- killed-mid-upload retry safely re-sends the same bytes to the same path
-- (plan Section 3.6.2) — that re-send is an UPDATE of the object, not
-- another insert, so it needs its own policy, not just the insert one above.
create policy "attachments_storage_update_own"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "attachments_storage_delete_own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
