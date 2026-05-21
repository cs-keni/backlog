ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS ats_platform text;
