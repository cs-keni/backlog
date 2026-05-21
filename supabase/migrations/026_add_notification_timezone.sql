-- Store the IANA timezone used to evaluate notification quiet hours.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_timezone text DEFAULT 'UTC';

