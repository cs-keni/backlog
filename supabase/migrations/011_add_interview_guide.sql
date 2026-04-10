-- Phase 11b: Add interview_guide column to company_profiles
-- Stores a rich, Claude-generated interview intelligence structure per company.
-- Falls back to legacy behavioral_questions / technical_questions for cached entries.

alter table company_profiles
  add column if not exists interview_guide jsonb;
