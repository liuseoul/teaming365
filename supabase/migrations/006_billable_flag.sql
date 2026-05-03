-- ============================================================
-- 006 — Add billable flag to time_logs
--       Default true; admins can mark entries as non-billable.
-- ============================================================
ALTER TABLE time_logs ADD COLUMN IF NOT EXISTS billable boolean NOT NULL DEFAULT true;
