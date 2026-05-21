ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS source_preferences jsonb NOT NULL DEFAULT '{}';
