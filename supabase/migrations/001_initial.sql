-- ============================================================
-- 趋境团项目管理系统 — 初始数据库结构（多团队版）
-- ============================================================

-- ── 用户档案表（扩展 Supabase Auth 的 auth.users）─────────────
CREATE TABLE profiles (
  id         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 团队表 ────────────────────────────────────────────────────
CREATE TABLE groups (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 团队成员关联表 ────────────────────────────────────────────
-- role here is GROUP-SCOPED: a user can be admin in one group, member in another
CREATE TABLE group_members (
  group_id   UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- ── 项目表 ────────────────────────────────────────────────────
CREATE TABLE projects (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id              UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  name                  TEXT NOT NULL,
  description           TEXT DEFAULT '',
  client                TEXT NOT NULL DEFAULT '',
  status                TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'delayed', 'completed', 'cancelled')),
  agreement_party       TEXT,
  service_fee_currency  TEXT,
  service_fee_amount    NUMERIC(15,2),
  collaboration_parties TEXT[] DEFAULT '{}',
  created_by            UUID REFERENCES profiles(id) NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── 工作记录表（仅软删除，禁止物理删除）─────────────────────
CREATE TABLE work_records (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id        UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  content         TEXT NOT NULL,
  author_id       UUID REFERENCES profiles(id) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted         BOOLEAN DEFAULT FALSE,
  deleted_by      UUID REFERENCES profiles(id),
  deleted_by_name TEXT,
  deleted_at      TIMESTAMPTZ
);

-- ── 工时记录表 ────────────────────────────────────────────────
CREATE TABLE time_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id        UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  member_id       UUID REFERENCES profiles(id) NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  description     TEXT DEFAULT '',
  deleted         BOOLEAN DEFAULT FALSE,
  deleted_by      UUID REFERENCES profiles(id),
  deleted_by_name TEXT,
  deleted_at      TIMESTAMPTZ
);

-- ── 日程/提醒表 ───────────────────────────────────────────────
CREATE TABLE reminders (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id         UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  due_date         DATE NOT NULL,
  start_date       DATE,
  end_date         DATE,
  start_time       TIME,
  end_time         TIME,
  content          TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'others'
                   CHECK (type IN ('online_meeting','visiting','business_travel','personal_leave','visiting_reception','others')),
  assigned_to_name TEXT,
  created_by       UUID REFERENCES profiles(id) NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  deleted          BOOLEAN DEFAULT FALSE,
  deleted_by       UUID REFERENCES profiles(id),
  deleted_by_name  TEXT,
  deleted_at       TIMESTAMPTZ
);

-- ── 待办事项表 ───────────────────────────────────────────────
CREATE TABLE todos (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id          UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  content           TEXT NOT NULL,
  assignee_abbrev   TEXT NOT NULL DEFAULT '',
  assignee_abbrev_2 TEXT,
  completed         BOOLEAN DEFAULT FALSE,
  completed_at      TIMESTAMPTZ,
  completed_by_name TEXT,
  position          INTEGER NOT NULL DEFAULT 0,
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted           BOOLEAN DEFAULT FALSE,
  deleted_by        UUID REFERENCES profiles(id),
  deleted_by_name   TEXT,
  deleted_at        TIMESTAMPTZ
);

-- ============================================================
-- 触发器：自动更新 projects.updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 触发器：新用户注册时自动创建 profile
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'member')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 启用行级安全（RLS）
-- ============================================================
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos         ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- profiles 策略
-- ============================================================
CREATE POLICY "已登录用户可查看所有档案" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "用户只能更新自己的档案" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- groups 策略
-- 任何已登录用户可查看所有 group（登录时需要列出可加入的组）
-- 只允许通过 service role（API 路由）写入
-- ============================================================
CREATE POLICY "已登录用户可查看团队" ON groups
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- group_members 策略
-- 用户可查看自己所在的组，以及同组的其他成员（用于成员列表）
-- ============================================================
CREATE POLICY "用户可查看自己的成员关系" ON group_members
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM group_members gm2
      WHERE gm2.group_id = group_members.group_id
        AND gm2.user_id = auth.uid()
    )
  );

-- ============================================================
-- projects 策略（按 group_id 隔离）
-- ============================================================
CREATE POLICY "成员可查看本组项目" ON projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = projects.group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "组内管理员可新建项目" ON projects
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = projects.group_id AND user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "组内管理员可修改项目" ON projects
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = projects.group_id AND user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- work_records 策略（按 group_id 隔离，禁止物理删除）
-- ============================================================
CREATE POLICY "成员可查看本组工作记录" ON work_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = work_records.group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "成员可新增工作记录" ON work_records
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = work_records.group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "作者或组内管理员可软删除记录" ON work_records
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = work_records.group_id AND user_id = auth.uid()
    )
    AND (
      auth.uid() = author_id
      OR EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = work_records.group_id AND user_id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "禁止物理删除工作记录" ON work_records
  FOR DELETE USING (false);

-- ============================================================
-- time_logs 策略（按 group_id 隔离）
-- ============================================================
CREATE POLICY "成员可查看本组工时" ON time_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = time_logs.group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "成员可新增工时" ON time_logs
  FOR INSERT WITH CHECK (
    auth.uid() = member_id
    AND EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = time_logs.group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "作者或组内管理员可软删除工时" ON time_logs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = time_logs.group_id AND user_id = auth.uid()
    )
    AND (
      auth.uid() = member_id
      OR EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = time_logs.group_id AND user_id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "组内管理员可物理删除工时" ON time_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = time_logs.group_id AND user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- reminders 策略（按 group_id 隔离）
-- ============================================================
CREATE POLICY "成员可查看本组日程" ON reminders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = reminders.group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "成员可新增日程" ON reminders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = reminders.group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "创建者或管理员可修改日程" ON reminders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = reminders.group_id AND user_id = auth.uid()
    )
    AND (
      auth.uid() = created_by
      OR EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = reminders.group_id AND user_id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "组内管理员可物理删除日程" ON reminders
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = reminders.group_id AND user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- todos 策略（按 group_id 隔离）
-- ============================================================
CREATE POLICY "成员可查看本组待办" ON todos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = todos.group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "成员可新增待办" ON todos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = todos.group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "成员可修改本组待办" ON todos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = todos.group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "组内管理员可物理删除待办" ON todos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = todos.group_id AND user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- 开启 Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE work_records;
ALTER PUBLICATION supabase_realtime ADD TABLE time_logs;
