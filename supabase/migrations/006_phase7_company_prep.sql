-- Phase 7: Company Intelligence & Interview Prep
-- Adds enriched_at and tech_stack to company_profiles

ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS enriched_at  timestamptz,
  ADD COLUMN IF NOT EXISTS tech_stack   text[];
