CREATE TABLE prep_practice_responses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  question_id text NOT NULL,
  bank text CHECK (bank IN ('system-design', 'ai-engineer')) NOT NULL,
  response_text text NOT NULL,
  scores jsonb,
  feedback_text text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX ON prep_practice_responses(user_id, question_id, created_at DESC);

ALTER TABLE prep_practice_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own practice" ON prep_practice_responses
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
