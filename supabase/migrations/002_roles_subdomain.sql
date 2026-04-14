-- ============================================================
-- 趋境团 Migration 002 — Super-admin, two-tier group roles, subdomain
-- ============================================================

-- ── 1. Add is_super_admin to profiles ─────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Add firm / manager / subdomain columns to groups ───────
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS firm_name_cn   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS firm_name_en   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS manager_name_cn TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS manager_name_en TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS subdomain      TEXT;

-- Unique index on subdomain (NULL values are excluded — each non-null subdomain is unique)
CREATE UNIQUE INDEX IF NOT EXISTS groups_subdomain_unique
  ON groups(subdomain) WHERE subdomain IS NOT NULL;

-- ── 3. Migrate group_members.role to three-tier system ────────
-- Drop old constraint
ALTER TABLE group_members DROP CONSTRAINT IF EXISTS group_members_role_check;

-- Promote existing 'admin' → 'first_admin'
UPDATE group_members SET role = 'first_admin' WHERE role = 'admin';

-- Add new constraint
ALTER TABLE group_members
  ADD CONSTRAINT group_members_role_check
  CHECK (role IN ('first_admin', 'second_admin', 'member'));

-- ── 4. RLS: super-admin can read all groups and memberships ───
-- (needed for the super-admin management page, which uses the anon client)

-- Super-admin read policy for groups (existing "已登录用户可查看团队" covers this,
-- but add explicit policy for clarity and forward-compat)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'groups' AND policyname = '超级管理员可查看所有团队'
  ) THEN
    CREATE POLICY "超级管理员可查看所有团队" ON groups
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = TRUE)
      );
  END IF;
END $$;

-- Super-admin read policy for group_members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'group_members' AND policyname = '超级管理员可查看所有成员关系'
  ) THEN
    CREATE POLICY "超级管理员可查看所有成员关系" ON group_members
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = TRUE)
      );
  END IF;
END $$;

-- Super-admin read policy for profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = '超级管理员可查看所有档案'
  ) THEN
    CREATE POLICY "超级管理员可查看所有档案" ON profiles
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.is_super_admin = TRUE)
      );
  END IF;
END $$;

-- ── 5. Update existing project/content RLS: first_admin = old admin ──
-- The existing policies check group_members membership only (not role),
-- so they continue to work for first_admin / second_admin / member without changes.
-- Only the "组内管理员可新建项目" / "组内管理员可修改项目" checks role = 'admin'.
-- Update those to accept first_admin.

-- Drop & recreate project insert policy
DROP POLICY IF EXISTS "组内管理员可新建项目" ON projects;
CREATE POLICY "组内管理员可新建项目" ON projects
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = projects.group_id
        AND user_id = auth.uid()
        AND role IN ('first_admin', 'second_admin')
    )
  );

-- Drop & recreate project update policy
DROP POLICY IF EXISTS "组内管理员可修改项目" ON projects;
CREATE POLICY "组内管理员可修改项目" ON projects
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = projects.group_id
        AND user_id = auth.uid()
        AND role IN ('first_admin', 'second_admin')
    )
  );
