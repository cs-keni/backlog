-- Phase 4 addendum: archive support for applications
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_applications_is_archived ON public.applications (is_archived);
