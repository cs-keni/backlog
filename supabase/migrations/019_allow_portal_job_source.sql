-- Allow worker portal-discovered jobs to be written explicitly.
-- The initial schema only allowed github/manual, but the worker writes direct
-- Greenhouse/Lever and Brave-discovered direct job pages as source='portal'.

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_source_check;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_source_check
  CHECK (source IN ('github', 'portal', 'manual'));
