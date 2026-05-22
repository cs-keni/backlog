CREATE TABLE prep_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  question_id text NOT NULL,
  bank text CHECK (bank IN ('system-design', 'ai-engineer')) NOT NULL,
  CHECK ((bank='system-design' AND question_id LIKE 'sd-%') OR (bank='ai-engineer' AND question_id LIKE 'ai-%')),
  interval_days integer DEFAULT 1,
  next_review_at date NOT NULL,
  last_difficulty text CHECK (last_difficulty IN ('easy', 'hard')),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX ON prep_reviews(user_id, question_id);

CREATE OR REPLACE FUNCTION set_prep_reviews_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prep_reviews_updated
BEFORE UPDATE ON prep_reviews
FOR EACH ROW EXECUTE FUNCTION set_prep_reviews_updated();

ALTER TABLE prep_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own reviews" ON prep_reviews
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
