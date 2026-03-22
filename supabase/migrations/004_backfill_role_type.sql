-- Backfill role_type for existing GitHub-sourced jobs that were ingested before
-- the role_type column existed (those rows have role_type = NULL).
-- Heuristic: jobs with 'intern' in the title came from the internships repo,
-- everything else came from the new-grad repo and is full-time.
UPDATE public.jobs
SET role_type = CASE
  WHEN lower(title) LIKE '%intern%' THEN 'internship'
  ELSE 'full_time'
END
WHERE role_type IS NULL
  AND source = 'github';
