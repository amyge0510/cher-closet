-- People with no daily cap on AI pictures (the gemini-image function's
-- allowance). Their use is still counted in ai_usage. The owner (everyone
-- in admins) starts on the list; add others in the SQL editor:
--   insert into public.ai_unlimited (user_id)
--   select id from auth.users where phone = '12135550123';

create table public.ai_unlimited (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- no policies: rows are only added in the SQL editor
alter table public.ai_unlimited enable row level security;

insert into public.ai_unlimited (user_id)
select user_id from public.admins
on conflict do nothing;

-- whether the person calling has no daily cap
create or replace function public.has_unlimited_ai() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.ai_unlimited where user_id = auth.uid()) $$;

revoke all on function public.has_unlimited_ai() from public, anon;
grant execute on function public.has_unlimited_ai() to authenticated;
