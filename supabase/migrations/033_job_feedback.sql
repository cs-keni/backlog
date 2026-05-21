CREATE TABLE IF NOT EXISTS public.job_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('not_my_level', 'too_far', 'wrong_stack', 'company_culture', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, job_id)
);

CREATE INDEX IF NOT EXISTS job_feedback_user_id_idx ON public.job_feedback(user_id);

ALTER TABLE public.job_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own feedback" ON public.job_feedback
  FOR ALL USING (auth.uid() = user_id);
