ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS hide_from_feed boolean NOT NULL DEFAULT false;
