-- Add role_type column to jobs table
-- Values: 'full_time' | 'internship' | 'contract'
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS role_type text
    CHECK (role_type IN ('full_time', 'internship', 'contract'));
