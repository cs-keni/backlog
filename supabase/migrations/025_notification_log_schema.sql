-- Phase 1 notification dispatcher state.
--
-- A full unique constraint on (user_id, job_id, channel) would prevent failed
-- attempts from being retried. The dispatcher dedupes only successful sends, so
-- the uniqueness guarantee is partial: one sent row per user/job/channel.

ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS error text;

ALTER TABLE public.notification_log
  ALTER COLUMN channel SET NOT NULL;

ALTER TABLE public.notification_log
  DROP CONSTRAINT IF EXISTS notification_log_status_check;

ALTER TABLE public.notification_log
  ADD CONSTRAINT notification_log_status_check
  CHECK (status IN ('pending', 'sent', 'failed', 'expired'));

DROP INDEX IF EXISTS public.idx_notification_log_sent_unique;

CREATE UNIQUE INDEX idx_notification_log_sent_unique
  ON public.notification_log(user_id, job_id, channel)
  WHERE status = 'sent';

CREATE INDEX IF NOT EXISTS idx_notification_log_retry
  ON public.notification_log(user_id, channel, status, job_id)
  WHERE status IN ('pending', 'failed');
