-- Performance indexes for user-scoped data tables.
-- Every table filtered by user_id gets a btree index.
-- These are not required for correctness but prevent full-table scans
-- as users accumulate data.

CREATE INDEX IF NOT EXISTS idx_applications_user_id
  ON public.applications(user_id);

CREATE INDEX IF NOT EXISTS idx_work_history_user_id
  ON public.work_history(user_id);

CREATE INDEX IF NOT EXISTS idx_education_user_id
  ON public.education(user_id);

CREATE INDEX IF NOT EXISTS idx_saved_answers_user_id
  ON public.saved_answers(user_id);

CREATE INDEX IF NOT EXISTS idx_star_responses_user_id
  ON public.star_responses(user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_cover_letters_user_id
  ON public.cover_letters(user_id);

CREATE INDEX IF NOT EXISTS idx_resume_versions_user_id
  ON public.resume_versions(user_id);

CREATE INDEX IF NOT EXISTS idx_projects_user_id
  ON public.projects(user_id);

CREATE INDEX IF NOT EXISTS idx_story_bank_user_id
  ON public.story_bank(user_id);

-- Composite index for the common cover_letters lookup pattern:
-- application_id is always queried alongside user ownership check
CREATE INDEX IF NOT EXISTS idx_cover_letters_application_id
  ON public.cover_letters(application_id);

-- Composite for resume_versions job lookup
CREATE INDEX IF NOT EXISTS idx_resume_versions_user_job
  ON public.resume_versions(user_id, job_id);

-- notification_log is queried by (user_id, job_id, channel) together
CREATE INDEX IF NOT EXISTS idx_notification_log_user_job_channel
  ON public.notification_log(user_id, job_id, channel);
