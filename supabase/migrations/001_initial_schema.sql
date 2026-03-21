-- =============================================================================
-- Backlog — Initial Schema Migration
-- Run order: tables with no deps first, then tables with FKs
-- =============================================================================

-- ---------------------------------------------------------------------------
-- company_profiles (no FK deps)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_profiles (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  description          text,
  glassdoor_rating     numeric(2, 1),
  headcount_range      text,
  funding_stage        text,
  behavioral_questions text[],
  technical_questions  text[],
  last_updated         timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- sources (no FK deps)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sources (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text NOT NULL,
  type                    text NOT NULL DEFAULT 'github',
  url                     text NOT NULL,
  last_fetched_at         timestamptz,
  fetch_interval_minutes  integer DEFAULT 15
);

-- ---------------------------------------------------------------------------
-- jobs (FK → company_profiles)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text NOT NULL,
  company          text NOT NULL,
  company_id       uuid REFERENCES public.company_profiles(id) ON DELETE SET NULL,
  location         text,
  salary_min       integer,
  salary_max       integer,
  url              text UNIQUE NOT NULL,
  source           text NOT NULL DEFAULT 'github'
                     CHECK (source IN ('github', 'manual')),
  posted_at        timestamptz,
  fetched_at       timestamptz DEFAULT now(),
  description      text,
  tags             text[],
  is_remote        boolean DEFAULT false,
  experience_level text
);

-- ---------------------------------------------------------------------------
-- users (mirrors auth.users via trigger)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id                              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                           text,
  full_name                       text,
  phone                           text,
  address                         text,
  linkedin_url                    text,
  github_url                      text,
  portfolio_url                   text,
  citizenship_status              text,
  visa_sponsorship_required       boolean DEFAULT false,
  willing_to_relocate             boolean DEFAULT false,
  resume_text                     text,
  resume_url                      text,
  preferred_locations             text[],
  preferred_salary_min            integer,
  preferred_role_types            text[],
  remote_preference               text CHECK (remote_preference IN ('remote', 'hybrid', 'onsite', 'any')),
  skills                          text[],
  experience_level                text,
  years_of_experience             integer,
  notification_email              boolean DEFAULT true,
  notification_push               boolean DEFAULT false,
  notification_sms                boolean DEFAULT false,
  notification_quiet_hours_start  time,
  notification_quiet_hours_end    time,
  alert_match_threshold           integer DEFAULT 70,
  created_at                      timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- work_history (FK → users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company       text NOT NULL,
  title         text NOT NULL,
  start_date    date,
  end_date      date,
  is_current    boolean DEFAULT false,
  description   text,
  display_order integer DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- education (FK → users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.education (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school           text NOT NULL,
  degree           text,
  field_of_study   text,
  gpa              numeric(3, 2),
  graduation_year  integer,
  display_order    integer DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- saved_answers (FK → users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_answers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question   text NOT NULL,
  answer     text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- star_responses (FK → users, company_profiles nullable)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.star_responses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id     uuid REFERENCES public.company_profiles(id) ON DELETE SET NULL,
  question       text NOT NULL,
  situation      text,
  task           text,
  action         text,
  result         text,
  full_response  text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- push_subscriptions (FK → users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint   text NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- applications (FK → users, jobs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.applications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_id           uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'saved'
                     CHECK (status IN ('saved', 'applied', 'phone_screen', 'technical', 'final', 'offer', 'rejected')),
  applied_at       timestamptz,
  notes            jsonb,
  recruiter_name   text,
  recruiter_email  text,
  last_updated     timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- application_timeline (FK → applications)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.application_timeline (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  from_status     text,
  to_status       text NOT NULL,
  changed_at      timestamptz DEFAULT now(),
  note            text
);

-- ---------------------------------------------------------------------------
-- match_scores (FK → users, jobs; UNIQUE on user_id+job_id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.match_scores (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_id       uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  score        integer CHECK (score >= 0 AND score <= 100),
  rationale    text,
  computed_at  timestamptz DEFAULT now(),
  is_stale     boolean DEFAULT false,
  UNIQUE (user_id, job_id)
);

-- ---------------------------------------------------------------------------
-- cover_letters (FK → users, applications)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cover_letters (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  application_id  uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  template_type   text CHECK (template_type IN ('formal', 'casual', 'startup')),
  content         text,
  pdf_url         text,
  created_at      timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- resume_versions (FK → users, jobs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resume_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_id        uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  content_text  text,
  pdf_url       text,
  created_at    timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- notification_log (FK → users, jobs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_log (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_id   uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  channel  text CHECK (channel IN ('email', 'push', 'sms')),
  sent_at  timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- api_keys (FK → users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  key_hash     text NOT NULL,
  label        text,
  last_used_at timestamptz,
  created_at   timestamptz DEFAULT now(),
  revoked_at   timestamptz
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_jobs_posted_at    ON public.jobs (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_company_id   ON public.jobs (company_id);
CREATE INDEX IF NOT EXISTS idx_match_scores_user_job ON public.match_scores (user_id, job_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_user_job_channel
  ON public.notification_log (user_id, job_id, channel);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.company_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_history        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_answers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.star_responses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_scores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cover_letters       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_versions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys            ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- jobs — readable by all authenticated users; writable by service role only
-- ---------------------------------------------------------------------------
CREATE POLICY "jobs_select_authenticated"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- company_profiles — readable by all authenticated users; writable by service role only
-- ---------------------------------------------------------------------------
CREATE POLICY "company_profiles_select_authenticated"
  ON public.company_profiles FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- sources — readable by all authenticated users; writable by service role only
-- ---------------------------------------------------------------------------
CREATE POLICY "sources_select_authenticated"
  ON public.sources FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- users — own row only
-- ---------------------------------------------------------------------------
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_delete_own"
  ON public.users FOR DELETE
  TO authenticated
  USING (id = auth.uid());

-- ---------------------------------------------------------------------------
-- applications — own rows
-- ---------------------------------------------------------------------------
CREATE POLICY "applications_select_own"
  ON public.applications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "applications_insert_own"
  ON public.applications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "applications_update_own"
  ON public.applications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "applications_delete_own"
  ON public.applications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- application_timeline — access via parent application ownership
-- ---------------------------------------------------------------------------
CREATE POLICY "application_timeline_select_own"
  ON public.application_timeline FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_timeline.application_id
        AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "application_timeline_insert_own"
  ON public.application_timeline FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_timeline.application_id
        AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "application_timeline_update_own"
  ON public.application_timeline FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_timeline.application_id
        AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "application_timeline_delete_own"
  ON public.application_timeline FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_timeline.application_id
        AND a.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- match_scores — own rows
-- ---------------------------------------------------------------------------
CREATE POLICY "match_scores_select_own"
  ON public.match_scores FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "match_scores_insert_own"
  ON public.match_scores FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "match_scores_update_own"
  ON public.match_scores FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "match_scores_delete_own"
  ON public.match_scores FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- cover_letters — own rows
-- ---------------------------------------------------------------------------
CREATE POLICY "cover_letters_select_own"
  ON public.cover_letters FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "cover_letters_insert_own"
  ON public.cover_letters FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "cover_letters_update_own"
  ON public.cover_letters FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "cover_letters_delete_own"
  ON public.cover_letters FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- resume_versions — own rows
-- ---------------------------------------------------------------------------
CREATE POLICY "resume_versions_select_own"
  ON public.resume_versions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "resume_versions_insert_own"
  ON public.resume_versions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "resume_versions_update_own"
  ON public.resume_versions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "resume_versions_delete_own"
  ON public.resume_versions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- notification_log — own rows (read); service role writes
-- ---------------------------------------------------------------------------
CREATE POLICY "notification_log_select_own"
  ON public.notification_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- push_subscriptions — own rows
-- ---------------------------------------------------------------------------
CREATE POLICY "push_subscriptions_select_own"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "push_subscriptions_insert_own"
  ON public.push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_subscriptions_update_own"
  ON public.push_subscriptions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_subscriptions_delete_own"
  ON public.push_subscriptions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- star_responses — own rows
-- ---------------------------------------------------------------------------
CREATE POLICY "star_responses_select_own"
  ON public.star_responses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "star_responses_insert_own"
  ON public.star_responses FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "star_responses_update_own"
  ON public.star_responses FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "star_responses_delete_own"
  ON public.star_responses FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- work_history — own rows
-- ---------------------------------------------------------------------------
CREATE POLICY "work_history_select_own"
  ON public.work_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "work_history_insert_own"
  ON public.work_history FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "work_history_update_own"
  ON public.work_history FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "work_history_delete_own"
  ON public.work_history FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- education — own rows
-- ---------------------------------------------------------------------------
CREATE POLICY "education_select_own"
  ON public.education FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "education_insert_own"
  ON public.education FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "education_update_own"
  ON public.education FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "education_delete_own"
  ON public.education FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- saved_answers — own rows
-- ---------------------------------------------------------------------------
CREATE POLICY "saved_answers_select_own"
  ON public.saved_answers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "saved_answers_insert_own"
  ON public.saved_answers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "saved_answers_update_own"
  ON public.saved_answers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "saved_answers_delete_own"
  ON public.saved_answers FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- api_keys — own rows
-- ---------------------------------------------------------------------------
CREATE POLICY "api_keys_select_own"
  ON public.api_keys FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "api_keys_insert_own"
  ON public.api_keys FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "api_keys_update_own"
  ON public.api_keys FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "api_keys_delete_own"
  ON public.api_keys FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- TRIGGER: auto-create public.users row on auth.users INSERT
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
