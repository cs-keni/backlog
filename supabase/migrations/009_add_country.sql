-- Add country column to jobs for geographic filtering
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS country text;

-- Backfill from location string patterns.
-- Order matters: more specific patterns first.

UPDATE public.jobs SET country = 'United Kingdom'
WHERE country IS NULL AND (
  location ILIKE '%, UK'
  OR location ILIKE '%, England'
  OR location ILIKE '%United Kingdom%'
  OR location ILIKE '%London, UK%'
  OR location ILIKE '%Manchester, UK%'
  OR location ILIKE '%Edinburgh, UK%'
  OR location ILIKE '%Cambridge, UK%'
  OR location ILIKE '%Oxford, UK%'
  OR location ILIKE '%Bristol, UK%'
);

UPDATE public.jobs SET country = 'Canada'
WHERE country IS NULL AND (
  location ILIKE '%, Canada'
  OR location ILIKE '%Canada%'
  OR location ILIKE '%Toronto%'
  OR location ILIKE '%Vancouver%'
  OR location ILIKE '%Montreal%'
  OR location ILIKE '%Calgary%'
  OR location ILIKE '%Ottawa%'
  OR location ILIKE '%Waterloo, ON%'
);

UPDATE public.jobs SET country = 'Germany'
WHERE country IS NULL AND (
  location ILIKE '%Germany%'
  OR location ILIKE '%, DE'
  OR location ILIKE '%Berlin%'
  OR location ILIKE '%Munich%'
  OR location ILIKE '%Frankfurt%'
  OR location ILIKE '%Hamburg%'
  OR location ILIKE '%Stuttgart%'
);

UPDATE public.jobs SET country = 'France'
WHERE country IS NULL AND (
  location ILIKE '%France%'
  OR location ILIKE '%, FR'
  OR location ILIKE '%Paris, FR%'
  OR location ILIKE '%Paris, France%'
);

UPDATE public.jobs SET country = 'Australia'
WHERE country IS NULL AND (
  location ILIKE '%Australia%'
  OR location ILIKE '%, AU'
  OR location ILIKE '%Sydney%'
  OR location ILIKE '%Melbourne%'
  OR location ILIKE '%Brisbane%'
);

UPDATE public.jobs SET country = 'Singapore'
WHERE country IS NULL AND (
  location ILIKE '%Singapore%'
  OR location ILIKE '%, SG'
);

UPDATE public.jobs SET country = 'India'
WHERE country IS NULL AND (
  location ILIKE '%India%'
  OR location ILIKE '%, IN'
  OR location ILIKE '%Bangalore%'
  OR location ILIKE '%Bengaluru%'
  OR location ILIKE '%Mumbai%'
  OR location ILIKE '%Hyderabad%'
  OR location ILIKE '%Pune%'
);

UPDATE public.jobs SET country = 'Netherlands'
WHERE country IS NULL AND (
  location ILIKE '%Netherlands%'
  OR location ILIKE '%Amsterdam%'
);

-- Everything remaining defaults to United States.
-- SimplifyJobs/New-Grad-Positions is a US-focused repo; unlabeled locations
-- (including "Remote") are overwhelmingly US roles.
UPDATE public.jobs SET country = 'United States'
WHERE country IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_country ON public.jobs (country);
