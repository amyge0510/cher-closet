-- AMY'S CLOSET: the clothes of a showcase account, which everyone signed in
-- can see and play with (read-only: they can't change or delete them). It
-- starts as the admins' accounts; add or remove showcase accounts in the SQL
-- editor, e.g.
--   insert into public.showcase (owner) select id from auth.users where phone = '12135550123';
-- Only the clothes are shared: the showcase account's model photo stays private.

create table if not exists public.showcase (
  owner uuid primary key references auth.users (id) on delete cascade
);

alter table public.showcase enable row level security;

drop policy if exists "showcase: read" on public.showcase;
create policy "showcase: read" on public.showcase
  for select to authenticated using (true);

insert into public.showcase (owner) select user_id from public.admins on conflict do nothing;

-- the showcase's finished clothes, for everyone signed in
drop policy if exists "showcase garments: read" on public.garments;
create policy "showcase garments: read" on public.garments
  for select to authenticated
  using (status = 'ready' and owner in (select owner from public.showcase));

-- and their cut-outs (only the garments folder, not the model photo)
drop policy if exists "showcase closet files: read" on storage.objects;
create policy "showcase closet files: read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'closet'
    and (storage.foldername(name))[2] = 'garments'
    and (storage.foldername(name))[1] in (select owner::text from public.showcase)
  );

-- The dashboard counts AMY'S CLOSET where it used to count the pixel rack.
create or replace function public.admin_users()
returns table (
  id uuid,
  name text,
  phone_end text,
  wardrobe text,
  joined timestamptz,
  last_seen timestamptz,
  active_days bigint,
  visits bigint,
  browses bigint,
  dress_mes bigint,
  auto_dresses bigint,
  saves bigint,
  quizzes bigint,
  clothes_uploads bigint,
  me_uploads bigint,
  pieces bigint,
  pixel_uses bigint,
  mine_uses bigint,
  last_device text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not an admin' using errcode = '42501';
  end if;
  return query
  select
    u.id,
    coalesce(u.raw_user_meta_data ->> 'display_name', ''),
    right(coalesce(u.phone, ''), 4),
    coalesce(u.raw_user_meta_data ->> 'wardrobe', ''),
    u.created_at,
    greatest(u.last_sign_in_at, max(e.created_at)),
    count(distinct (e.created_at at time zone 'America/Los_Angeles')::date),
    count(*) filter (where e.kind = 'visit'),
    count(*) filter (where e.kind = 'browse'),
    count(*) filter (where e.kind = 'dress_me'),
    count(*) filter (where e.kind = 'auto_dress'),
    count(*) filter (where e.kind = 'save_look'),
    count(*) filter (where e.kind = 'style_quiz'),
    count(*) filter (where e.kind = 'upload_clothes'),
    count(*) filter (where e.kind = 'upload_me'),
    (select count(*) from public.garments g where g.owner = u.id),
    count(*) filter (where e.detail ->> 'source' in ('amy', 'pixel') and e.kind in ('browse', 'dress_me', 'auto_dress')),
    count(*) filter (where e.detail ->> 'source' = 'mine' and e.kind in ('browse', 'dress_me', 'auto_dress')),
    (array_agg(e.device order by e.created_at desc) filter (where e.device is not null))[1]
  from auth.users u
  left join public.events e on e.owner = u.id
  group by u.id
  order by 6 desc nulls last;
end;
$$;
