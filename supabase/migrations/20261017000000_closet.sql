-- Cher's Closet: per-user closets, garment cut-outs and full-body photos.
-- Every row and file belongs to one user; row-level security keeps it that way.

create table public.garments (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slot text not null check (slot in ('top', 'bottom')),
  name text not null default '',
  -- storage paths in the private "closet" bucket: <owner>/garments/<id>/...
  original_path text,
  cutout_path text,
  colors text[] not null default '{}',
  pattern text not null default 'solid' check (pattern in ('solid', 'plaid', 'stripe', 'print', 'knit')),
  styles text[] not null default '{}',
  set_name text,
  -- uploads are processed (background removal, tagging) before they appear
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  created_at timestamptz not null default now()
);

create index garments_owner_slot on public.garments (owner, slot) where status = 'ready';

create table public.body_photos (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  image_path text not null,
  -- where tops and bottoms sit, as fractions of the photo: {"top": {x,y,w,h}, "bottom": {...}}
  anchors jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index body_photos_one_active on public.body_photos (owner) where is_active;

alter table public.garments enable row level security;
alter table public.body_photos enable row level security;

create policy "own garments" on public.garments
  for all using (owner = auth.uid()) with check (owner = auth.uid());

create policy "own body photos" on public.body_photos
  for all using (owner = auth.uid()) with check (owner = auth.uid());

-- Private bucket; files live under a folder named after the owner's user id.
insert into storage.buckets (id, name, public)
values ('closet', 'closet', false)
on conflict (id) do nothing;

create policy "own closet files: read" on storage.objects
  for select using (bucket_id = 'closet' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own closet files: write" on storage.objects
  for insert with check (bucket_id = 'closet' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own closet files: update" on storage.objects
  for update using (bucket_id = 'closet' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own closet files: delete" on storage.objects
  for delete using (bucket_id = 'closet' and (storage.foldername(name))[1] = auth.uid()::text);
