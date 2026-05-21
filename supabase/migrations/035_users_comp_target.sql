ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS comp_target integer;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS comp_location_tier text DEFAULT 'tier1'
  CHECK (comp_location_tier IN ('tier1', 'tier2', 'tier3', 'remote'));
