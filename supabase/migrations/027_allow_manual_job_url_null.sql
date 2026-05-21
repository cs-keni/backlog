-- Manual applications can be logged without a source posting URL.
ALTER TABLE public.jobs
  ALTER COLUMN url DROP NOT NULL;
