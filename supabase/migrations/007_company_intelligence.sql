-- Phase 7 addendum: richer company intelligence fields

ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS mission          text,
  ADD COLUMN IF NOT EXISTS notable_products text[],
  ADD COLUMN IF NOT EXISTS website_url      text;
