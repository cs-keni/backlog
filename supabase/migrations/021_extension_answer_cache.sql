-- Cache generated extension answers for repeated application questions.
-- saved_answers remains the user-curated source of truth and is checked first.

CREATE TABLE IF NOT EXISTS public.extension_answer_cache (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  normalized_question text NOT NULL,
  question            text NOT NULL,
  answer              text NOT NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE (user_id, normalized_question)
);

CREATE INDEX IF NOT EXISTS idx_extension_answer_cache_user_question
  ON public.extension_answer_cache(user_id, normalized_question);

ALTER TABLE public.extension_answer_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "extension_answer_cache_select_own"
  ON public.extension_answer_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "extension_answer_cache_insert_own"
  ON public.extension_answer_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "extension_answer_cache_update_own"
  ON public.extension_answer_cache FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "extension_answer_cache_delete_own"
  ON public.extension_answer_cache FOR DELETE
  USING (auth.uid() = user_id);
