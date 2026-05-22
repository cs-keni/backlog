CREATE TABLE question_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  question_id text NOT NULL,
  bank text CHECK (bank IN ('system-design', 'ai-engineer')) NOT NULL,
  CHECK ((bank='system-design' AND question_id LIKE 'sd-%') OR (bank='ai-engineer' AND question_id LIKE 'ai-%')),
  status text CHECK (status IN ('unstudied', 'studied', 'needs-review')) DEFAULT 'unstudied',
  last_reviewed_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX ON question_progress(user_id, question_id);

CREATE OR REPLACE FUNCTION set_question_progress_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_question_progress_updated
BEFORE UPDATE ON question_progress
FOR EACH ROW EXECUTE FUNCTION set_question_progress_updated();

ALTER TABLE question_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own progress" ON question_progress
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
