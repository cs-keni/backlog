ALTER TABLE users
  ADD COLUMN IF NOT EXISTS dsa_track text NOT NULL DEFAULT '150'
  CHECK (dsa_track IN ('75', '150', '250'));
