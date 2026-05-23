alter table lc_attempts
  add column if not exists nudge_count int not null default 0;
