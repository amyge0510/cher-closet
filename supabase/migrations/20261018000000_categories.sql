-- Garments are filed by category (tops, bottoms, skirts, shoes, or one the user
-- makes up). Only tops and bottoms go on the outfit machine, so slot is now
-- optional: accessories and custom categories leave it empty.

alter table public.garments add column category text not null default 'tops';
alter table public.garments alter column slot drop not null;

drop index if exists public.garments_owner_slot;
create index garments_owner_category on public.garments (owner, category) where status = 'ready';
