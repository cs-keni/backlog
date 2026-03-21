-- =============================================================================
-- Migration 002: Add last_sha to sources table
-- Used by the aggregation worker to detect new commits and skip no-op runs
-- =============================================================================

ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS last_sha text;
