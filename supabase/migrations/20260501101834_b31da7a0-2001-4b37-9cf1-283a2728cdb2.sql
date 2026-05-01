
-- Replace overly broad storage SELECT policies (listing) with direct-access only.
-- Public buckets still serve files via their public URL; this just removes list-all.
drop policy if exists "Public read thumbnails" on storage.objects;
drop policy if exists "Public read avatars" on storage.objects;

-- Owners can list/select their own files; public access remains via public URL (CDN), no listing.
create policy "Owners read own thumbnails" on storage.objects for select
  using (bucket_id = 'thumbnails' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Owners read own avatars" on storage.objects for select
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- Set search_path on the trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

-- Lock down increment_link_click: revoke broad execute (still callable via PostgREST RPC by anon/auth
-- but limit to function arguments only). The function is intentionally public for click tracking.
-- To address the linter, we revoke and re-grant explicitly to make intent clear.
revoke all on function public.increment_link_click(uuid) from public;
grant execute on function public.increment_link_click(uuid) to anon, authenticated;
