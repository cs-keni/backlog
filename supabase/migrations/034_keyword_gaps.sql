CREATE TABLE IF NOT EXISTS public.keyword_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gaps jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(application_id, user_id)
);

ALTER TABLE public.keyword_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own gaps" ON public.keyword_gaps
  FOR ALL USING (auth.uid() = user_id);
