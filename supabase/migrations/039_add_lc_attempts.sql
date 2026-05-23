-- =============================================================================
-- DSA Practice Companion
-- lc_attempts: one row per coaching session on a LeetCode problem
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.lc_attempts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id           uuid NOT NULL UNIQUE,      -- client-generated; idempotent POST
  user_id              uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  problem_slug         text NOT NULL,              -- LeetCode URL slug (e.g. 'contains-duplicate')
  phase_reached        text NOT NULL CHECK (phase_reached IN ('read','brute_force','pattern','code')),
  time_spent_sec       int  NOT NULL DEFAULT 0,
  hint_count           int  NOT NULL DEFAULT 0,
  hint_layers_revealed int[] NOT NULL DEFAULT '{}', -- e.g. {1,2} = layers 1 and 2 revealed
  language             text NOT NULL CHECK (language IN ('python','java','js')),
  timeline             jsonb,                      -- nullable; populated in Phase 2
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lc_attempts_user_slug
  ON public.lc_attempts (user_id, problem_slug);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.lc_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lc_attempts_select_own" ON public.lc_attempts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "lc_attempts_insert_own" ON public.lc_attempts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "lc_attempts_update_own" ON public.lc_attempts
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "lc_attempts_delete_own" ON public.lc_attempts
  FOR DELETE TO authenticated USING (user_id = auth.uid());
