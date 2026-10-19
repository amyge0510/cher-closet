-- One row per paid AI request (Gemini image redraws), so the gemini-image
-- Edge Function can cap how many each person makes per day. People can see
-- and add their own rows, but not delete them (that would reset the cap).

create table public.ai_usage (
  id bigint generated always as identity primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('tidy', 'pose')),
  created_at timestamptz not null default now()
);

create index ai_usage_owner_day on public.ai_usage (owner, kind, created_at);

alter table public.ai_usage enable row level security;

create policy "own ai usage: read" on public.ai_usage
  for select using (owner = auth.uid());

create policy "own ai usage: add" on public.ai_usage
  for insert with check (owner = auth.uid());
