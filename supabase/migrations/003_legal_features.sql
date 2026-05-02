-- ============================================================
-- 003 — Legal-specific fields
--       1. reminders: add 4 legal event types to CHECK constraint
--       2. projects:  add matter_type column
--       3. projects:  add 'pending' and 'archived' to status CHECK
-- ============================================================

-- ── 1. reminders.type — expand CHECK to include legal types ──
ALTER TABLE reminders
  DROP CONSTRAINT IF EXISTS reminders_type_check;

ALTER TABLE reminders
  ADD CONSTRAINT reminders_type_check
  CHECK (type IN (
    'court_hearing',
    'filing_deadline',
    'consultation',
    'statute_of_limitations',
    'online_meeting',
    'visiting',
    'business_travel',
    'personal_leave',
    'visiting_reception',
    'others'
  ));

-- ── 2. projects.matter_type — new column (nullable, no CHECK) ─
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS matter_type TEXT DEFAULT NULL;

-- ── 3. projects.status — expand CHECK to include pending & archived ──
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('active', 'pending', 'completed', 'cancelled', 'delayed', 'archived'));
