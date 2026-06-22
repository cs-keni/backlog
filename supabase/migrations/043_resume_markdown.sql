-- Migration 043: Store user's resume markdown for AI tailoring
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS resume_markdown text;
