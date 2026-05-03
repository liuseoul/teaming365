-- ============================================================
-- 008 — Feature 15: pre_alert_days on reminders
--       Feature 17: ensure todos.due_date exists
-- ============================================================

-- Feature 15: store which pre-alert milestones the user wants (30/7/1 days before)
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS pre_alert_days integer[] NOT NULL DEFAULT '{}';

-- Feature 17: todos due_date (idempotent — safe if already added)
ALTER TABLE todos ADD COLUMN IF NOT EXISTS due_date DATE;
