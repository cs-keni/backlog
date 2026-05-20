-- Phase 8b: add difficulty rating to lc_reviews for adaptive SR intervals
alter table lc_reviews
  add column if not exists difficulty text check (difficulty in ('easy', 'hard'));
