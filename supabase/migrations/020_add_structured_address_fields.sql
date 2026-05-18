-- Add structured address fields for reliable ATS autofill.
-- Keep the legacy users.address field as a display/fallback value.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS street_address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS postal_code text;

COMMENT ON COLUMN public.users.street_address IS 'Street address line 1 for application autofill.';
COMMENT ON COLUMN public.users.city IS 'City for application autofill.';
COMMENT ON COLUMN public.users.state IS 'State, province, or region for application autofill.';
COMMENT ON COLUMN public.users.postal_code IS 'Postal or ZIP code for application autofill.';
