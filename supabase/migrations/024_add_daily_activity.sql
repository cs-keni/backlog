-- Track daily DSA activity independently from lc_solves.
-- lc_solves.solved_at is overwritten on re-solve, so it cannot be used to count
-- first-time solves for a given day.

CREATE TABLE IF NOT EXISTS public.daily_activity (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  problem_slug   text NOT NULL,
  date           date NOT NULL,
  is_new_solve   boolean NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, problem_slug, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_activity_user_date_new
  ON public.daily_activity(user_id, date)
  WHERE is_new_solve = true;

ALTER TABLE public.daily_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_activity_select_own"
  ON public.daily_activity FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "daily_activity_insert_own"
  ON public.daily_activity FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
