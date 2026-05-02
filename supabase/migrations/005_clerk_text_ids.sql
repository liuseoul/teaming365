-- ============================================================
-- 005 — Change profiles.id and all FK references UUID → TEXT
--       Clerk user IDs are strings like "user_xxx", not UUIDs.
-- ============================================================

-- ── 1. Drop FK constraints referencing profiles.id ────────────
ALTER TABLE group_members DROP CONSTRAINT IF EXISTS group_members_user_id_fkey;
ALTER TABLE projects      DROP CONSTRAINT IF EXISTS projects_created_by_fkey;
ALTER TABLE work_records  DROP CONSTRAINT IF EXISTS work_records_author_id_fkey;
ALTER TABLE work_records  DROP CONSTRAINT IF EXISTS work_records_deleted_by_fkey;
ALTER TABLE time_logs     DROP CONSTRAINT IF EXISTS time_logs_member_id_fkey;
ALTER TABLE time_logs     DROP CONSTRAINT IF EXISTS time_logs_deleted_by_fkey;
ALTER TABLE reminders     DROP CONSTRAINT IF EXISTS reminders_created_by_fkey;
ALTER TABLE reminders     DROP CONSTRAINT IF EXISTS reminders_deleted_by_fkey;
ALTER TABLE todos         DROP CONSTRAINT IF EXISTS todos_created_by_fkey;
ALTER TABLE todos         DROP CONSTRAINT IF EXISTS todos_deleted_by_fkey;

-- ── 2. Drop profiles → auth.users FK ─────────────────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- ── 3. Drop group_members composite PK (includes user_id) ────
ALTER TABLE group_members DROP CONSTRAINT IF EXISTS group_members_pkey;

-- ── 4. Change column types ────────────────────────────────────
ALTER TABLE profiles      ALTER COLUMN id         TYPE TEXT;
ALTER TABLE group_members ALTER COLUMN user_id    TYPE TEXT;
ALTER TABLE projects      ALTER COLUMN created_by TYPE TEXT;
ALTER TABLE work_records  ALTER COLUMN author_id  TYPE TEXT;
ALTER TABLE work_records  ALTER COLUMN deleted_by TYPE TEXT;
ALTER TABLE time_logs     ALTER COLUMN member_id  TYPE TEXT;
ALTER TABLE time_logs     ALTER COLUMN deleted_by TYPE TEXT;
ALTER TABLE reminders     ALTER COLUMN created_by TYPE TEXT;
ALTER TABLE reminders     ALTER COLUMN deleted_by TYPE TEXT;
ALTER TABLE todos         ALTER COLUMN created_by TYPE TEXT;
ALTER TABLE todos         ALTER COLUMN deleted_by TYPE TEXT;

-- ── 5. Restore group_members composite PK ─────────────────────
ALTER TABLE group_members ADD PRIMARY KEY (group_id, user_id);

-- ── 6. Restore FK constraints ─────────────────────────────────
ALTER TABLE group_members ADD CONSTRAINT group_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE projects      ADD CONSTRAINT projects_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id);
ALTER TABLE work_records  ADD CONSTRAINT work_records_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES profiles(id);
ALTER TABLE work_records  ADD CONSTRAINT work_records_deleted_by_fkey
  FOREIGN KEY (deleted_by) REFERENCES profiles(id);
ALTER TABLE time_logs     ADD CONSTRAINT time_logs_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES profiles(id);
ALTER TABLE time_logs     ADD CONSTRAINT time_logs_deleted_by_fkey
  FOREIGN KEY (deleted_by) REFERENCES profiles(id);
ALTER TABLE reminders     ADD CONSTRAINT reminders_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id);
ALTER TABLE reminders     ADD CONSTRAINT reminders_deleted_by_fkey
  FOREIGN KEY (deleted_by) REFERENCES profiles(id);
ALTER TABLE todos         ADD CONSTRAINT todos_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id);
ALTER TABLE todos         ADD CONSTRAINT todos_deleted_by_fkey
  FOREIGN KEY (deleted_by) REFERENCES profiles(id);
