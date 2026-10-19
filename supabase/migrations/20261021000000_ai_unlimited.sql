-- People with no daily cap on AI pictures (the gemini-image function's
-- allowance). The owner (everyone in admins) starts on the list; add others
-- in the SQL editor:
--   insert into public.ai_unlimited (user_id)
--   select id from auth.users where phone = '12135550123';
-- Safe to run more than once (it was first run by hand in the SQL editor).

create table if not exists public.ai_unlimited (
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

-- The function counts today's pictures through the person's own view of
-- ai_usage; people on the list don't see their rows, so they never reach the
-- cap (this works even with an older copy of the function deployed). Their
-- pictures are still recorded.
drop policy if exists "own ai usage: read" on public.ai_usage;
create policy "own ai usage: read" on public.ai_usage
  for select using (owner = auth.uid() and not public.has_unlimited_ai());
