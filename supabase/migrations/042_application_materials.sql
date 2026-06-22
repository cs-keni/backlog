-- Migration 042: Application materials support for Handshake assistant
-- Adds cover letter style context to users and enriches the project catalog.

-- Cover letter style context extracted from user's sample PDFs
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS cover_letter_style_context text;

-- Enrich the project catalog with AI-usable fields
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS detailed_description text,
  ADD COLUMN IF NOT EXISTS impact              text,
  ADD COLUMN IF NOT EXISTS is_active           boolean NOT NULL DEFAULT true;

-- Unique index required for upsert-on-conflict in seed script
CREATE UNIQUE INDEX IF NOT EXISTS projects_user_id_name_unique
  ON public.projects (user_id, name);
