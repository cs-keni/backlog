-- Phase 11c: Story Bank
-- A persistent, company-agnostic bank of STAR+Reflection narratives.
-- Stories are reused across multiple interview preps and cross-referenced by theme.

create table if not exists story_bank (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  theme       text not null check (theme in (
    'leadership', 'technical', 'conflict', 'failure',
    'collaboration', 'initiative', 'delivery', 'growth', 'other'
  )),
  situation   text,
  task        text,
  action      text,
  result      text,
  reflection  text,
  tags        text[] default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- RLS: users can only access their own stories
alter table story_bank enable row level security;

create policy "story_bank_owner" on story_bank
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
