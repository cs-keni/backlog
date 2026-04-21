create table if not exists public.projects (
  id           uuid          primary key default gen_random_uuid(),
  user_id      uuid          not null references auth.users(id) on delete cascade,
  name         text          not null,
  description  text,
  role         text,
  tech_stack   text[]        not null default '{}',
  url          text,
  highlights   text[]        not null default '{}',
  start_date   date,
  end_date     date,
  is_current   boolean       not null default false,
  display_order int          not null default 0,
  created_at   timestamptz   not null default now()
);

alter table public.projects enable row level security;

create policy "projects_select" on public.projects
  for select using (auth.uid() = user_id);

create policy "projects_insert" on public.projects
  for insert with check (auth.uid() = user_id);

create policy "projects_update" on public.projects
  for update using (auth.uid() = user_id);

create policy "projects_delete" on public.projects
  for delete using (auth.uid() = user_id);
