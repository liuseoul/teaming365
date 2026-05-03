-- ============================================================
-- 009 — Feature 19: client intake submissions
-- ============================================================

CREATE TABLE IF NOT EXISTS intake_submissions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  email       text,
  phone       text,
  matter_type text,
  description text,
  status      text        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'reviewed', 'converted', 'dismissed')),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE intake_submissions ENABLE ROW LEVEL SECURITY;
-- Open policy — insert uses service-role key from API route; admins read via service-role
CREATE POLICY "intake_open" ON intake_submissions FOR ALL USING (true) WITH CHECK (true);
