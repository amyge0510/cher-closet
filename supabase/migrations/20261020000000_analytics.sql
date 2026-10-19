-- Analytics: what signed-in people do (visits, BROWSE, DRESS ME, uploads...),
-- for the owner's dashboard at /#admin. People can add their own events but
-- can't read anyone's, their own included; only admins read them, through
-- the two functions below.

create table public.events (
  id bigint generated always as identity primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 40),
  detail jsonb not null default '{}'::jsonb,
  device text check (device in ('phone', 'computer')),
  created_at timestamptz not null default now()
);

create index events_owner_time on public.events (owner, created_at);

alter table public.events enable row level security;

create policy "own events: add" on public.events
  for insert with check (owner = auth.uid());

-- Who can see the dashboard. No policies: rows are only added in the SQL
-- editor, e.g.
--   insert into public.admins (user_id)
--   select id from auth.users where phone = '12135550123';
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

-- One row per account, with what they've done.
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
    count(*) filter (where e.detail ->> 'source' = 'pixel' and e.kind in ('browse', 'dress_me', 'auto_dress')),
    count(*) filter (where e.detail ->> 'source' = 'mine' and e.kind in ('browse', 'dress_me', 'auto_dress')),
    (array_agg(e.device order by e.created_at desc) filter (where e.device is not null))[1]
  from auth.users u
  left join public.events e on e.owner = u.id
  group by u.id
  order by 6 desc nulls last;
end;
$$;

-- One person's recent activity, newest first.
create or replace function public.admin_events(who uuid)
returns table (kind text, detail jsonb, device text, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not an admin' using errcode = '42501';
  end if;
  return query
  select e.kind, e.detail, e.device, e.created_at
  from public.events e
  where e.owner = who
  order by e.created_at desc
  limit 300;
end;
$$;

revoke all on function public.admin_users() from public, anon;
revoke all on function public.admin_events(uuid) from public, anon;
grant execute on function public.admin_users() to authenticated;
grant execute on function public.admin_events(uuid) to authenticated;
