
-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  bio text,
  avatar_url text,
  instagram_handle text,
  social_links jsonb not null default '{}'::jsonb,
  click_rate numeric not null default 1.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "Users can delete own profile"
  on public.profiles for delete using (auth.uid() = id);

-- POSTS
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  thumbnail_url text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.posts enable row level security;
create index posts_user_id_idx on public.posts(user_id);
create index posts_created_at_idx on public.posts(created_at desc);

create policy "Published posts viewable by everyone"
  on public.posts for select using (published = true or auth.uid() = user_id);
create policy "Users can create own posts"
  on public.posts for insert with check (auth.uid() = user_id);
create policy "Users can update own posts"
  on public.posts for update using (auth.uid() = user_id);
create policy "Users can delete own posts"
  on public.posts for delete using (auth.uid() = user_id);

-- AFFILIATE LINKS
create table public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  url text not null,
  position int not null default 0,
  clicks int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.affiliate_links enable row level security;
create index affiliate_links_post_id_idx on public.affiliate_links(post_id);

create policy "Affiliate links viewable by everyone"
  on public.affiliate_links for select using (true);
create policy "Users can create own links"
  on public.affiliate_links for insert with check (auth.uid() = user_id);
create policy "Users can update own links"
  on public.affiliate_links for update using (auth.uid() = user_id);
create policy "Users can delete own links"
  on public.affiliate_links for delete using (auth.uid() = user_id);
-- Public click tracking: anyone can increment clicks via RPC (see function below)

-- Increment clicks via SECURITY DEFINER function so visitors can track clicks safely
create or replace function public.increment_link_click(link_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.affiliate_links set clicks = clicks + 1 where id = link_id;
end;
$$;
grant execute on function public.increment_link_click(uuid) to anon, authenticated;

-- updated_at triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_set_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger posts_set_updated before update on public.posts
  for each row execute function public.set_updated_at();

-- Auto create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- STORAGE BUCKETS
insert into storage.buckets (id, name, public) values ('thumbnails', 'thumbnails', true);
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);

-- Storage policies: public read, owner write (files stored under {user_id}/...)
create policy "Public read thumbnails" on storage.objects for select using (bucket_id = 'thumbnails');
create policy "Users upload own thumbnails" on storage.objects for insert
  with check (bucket_id = 'thumbnails' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users update own thumbnails" on storage.objects for update
  using (bucket_id = 'thumbnails' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users delete own thumbnails" on storage.objects for delete
  using (bucket_id = 'thumbnails' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Public read avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy "Users upload own avatars" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users update own avatars" on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users delete own avatars" on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
