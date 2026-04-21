-- Track how many times we've attempted to enrich a job (fetch URL → extract salary/description).
-- Backfiller skips rows where enrichment_attempts >= 3 to stop hammering dead URLs.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS enrichment_attempts integer NOT NULL DEFAULT 0;

-- Index so the backfiller query (salary IS NULL + attempts < 3) stays fast as the table grows.
CREATE INDEX IF NOT EXISTS jobs_backfill_candidates
  ON jobs (enrichment_attempts)
  WHERE salary_min IS NULL AND salary_max IS NULL AND description IS NULL;
