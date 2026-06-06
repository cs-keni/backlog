-- Capture the exact discovery channel for each job, beyond the coarse
-- source bucket (github | portal | manual). This powers a "how we found
-- this job" badge in the feed and a per-channel breakdown in analytics.
--
-- Nullable: existing rows ingested before this migration won't have a
-- value — the app falls back to the coarse `source` for those.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS source_detail text;

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_source_detail_check;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_source_detail_check
  CHECK (source_detail IS NULL OR source_detail IN (
    'github_repo',
    'brave_search',
    'greenhouse',
    'lever',
    'workday',
    'usajobs',
    'manual_url',
    'manual_entry',
    'extension'
  ));
