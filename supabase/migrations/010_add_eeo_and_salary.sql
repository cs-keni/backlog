-- EEO self-identification and salary preference fields for the browser extension auto-fill

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gender              text,
  ADD COLUMN IF NOT EXISTS race_ethnicity      text,
  ADD COLUMN IF NOT EXISTS hispanic_latino     text,
  ADD COLUMN IF NOT EXISTS veteran_status      text,
  ADD COLUMN IF NOT EXISTS disability_status   text,
  ADD COLUMN IF NOT EXISTS desired_salary      text;
