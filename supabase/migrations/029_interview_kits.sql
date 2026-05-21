CREATE TABLE IF NOT EXISTS interview_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS interview_kits_application_id_idx ON interview_kits(application_id);

CREATE UNIQUE INDEX IF NOT EXISTS interview_kits_application_id_unique ON interview_kits(application_id);
