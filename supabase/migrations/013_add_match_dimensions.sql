-- Phase 11d: Multi-dimensional match scoring
-- Stores a 4-dimension score breakdown alongside the existing aggregate score.

alter table match_scores
  add column if not exists dimensions jsonb;
