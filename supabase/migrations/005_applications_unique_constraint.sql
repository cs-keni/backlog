-- Add UNIQUE constraint on (user_id, job_id) so that upsert ON CONFLICT works.
-- The API uses .upsert(..., { onConflict: 'user_id,job_id' }) which requires this.
ALTER TABLE public.applications
  ADD CONSTRAINT applications_user_id_job_id_key UNIQUE (user_id, job_id);
