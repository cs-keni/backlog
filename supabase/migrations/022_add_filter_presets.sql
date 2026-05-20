-- Saved job-feed filter presets.
-- API performs validation first; the trigger below is the DB backstop for races.

CREATE TABLE IF NOT EXISTS public.filter_presets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name       varchar(50) NOT NULL,
  filters    jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT filter_presets_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT filter_presets_filters_version CHECK ((filters ->> 'version') = '1')
);

CREATE INDEX IF NOT EXISTS idx_filter_presets_user_created
  ON public.filter_presets(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.enforce_filter_preset_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.filter_presets
    WHERE user_id = NEW.user_id
  ) >= 20 THEN
    RAISE EXCEPTION 'filter preset limit reached'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS filter_presets_limit ON public.filter_presets;
CREATE TRIGGER filter_presets_limit
  BEFORE INSERT ON public.filter_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_filter_preset_limit();

ALTER TABLE public.filter_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "filter_presets_select_own"
  ON public.filter_presets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "filter_presets_insert_own"
  ON public.filter_presets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "filter_presets_delete_own"
  ON public.filter_presets FOR DELETE
  USING (auth.uid() = user_id);
