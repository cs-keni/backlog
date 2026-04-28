-- =============================================================================
-- DSA Spaced Repetition Tracker
-- lc_solves: one row per (user, problem) representing the latest solve
-- lc_reviews: five scheduled review dates per solve
-- =============================================================================

-- ---------------------------------------------------------------------------
-- lc_solves
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lc_solves (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  problem_slug   text NOT NULL,
  problem_title  text NOT NULL,
  pattern        text NOT NULL,
  difficulty     text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  solved_at      date NOT NULL,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (user_id, problem_slug)
);

-- ---------------------------------------------------------------------------
-- lc_reviews
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lc_reviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  solve_id       uuid NOT NULL REFERENCES public.lc_solves(id) ON DELETE CASCADE,
  scheduled_for  date NOT NULL,
  completed_at   timestamptz
);

-- Verify user_id consistency: the solve must belong to the same user
CREATE OR REPLACE FUNCTION public.check_lc_review_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.lc_solves
    WHERE id = NEW.solve_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'lc_reviews.user_id must match lc_solves.user_id for the given solve_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_lc_review_user_id ON public.lc_reviews;
CREATE TRIGGER trg_check_lc_review_user_id
  BEFORE INSERT OR UPDATE ON public.lc_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.check_lc_review_user_id();

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_lc_solves_user_slug
  ON public.lc_solves (user_id, problem_slug);

CREATE INDEX IF NOT EXISTS idx_lc_reviews_user_scheduled
  ON public.lc_reviews (user_id, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_lc_reviews_solve_id
  ON public.lc_reviews (solve_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.lc_solves  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lc_reviews ENABLE ROW LEVEL SECURITY;

-- lc_solves — own rows
CREATE POLICY "lc_solves_select_own" ON public.lc_solves FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "lc_solves_insert_own" ON public.lc_solves FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "lc_solves_update_own" ON public.lc_solves FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "lc_solves_delete_own" ON public.lc_solves FOR DELETE TO authenticated USING (user_id = auth.uid());

-- lc_reviews — own rows
CREATE POLICY "lc_reviews_select_own" ON public.lc_reviews FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "lc_reviews_insert_own" ON public.lc_reviews FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "lc_reviews_update_own" ON public.lc_reviews FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "lc_reviews_delete_own" ON public.lc_reviews FOR DELETE TO authenticated USING (user_id = auth.uid());
