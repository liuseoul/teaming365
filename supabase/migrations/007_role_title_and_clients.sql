-- ============================================================
-- 007 — Feature 13: professional title on group_members
--       Feature 14: clients CRM table + FK on projects
-- ============================================================

-- Feature 13: optional professional title per membership
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS title varchar(50);

-- Feature 14: clients table
CREATE TABLE IF NOT EXISTS clients (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  contact_name  text,
  contact_email text,
  contact_phone text,
  notes        text,
  created_by   text        REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- Link matters to CRM clients (optional, additive alongside free-text client field)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id);

-- RLS: members of the same group can access their clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_open" ON clients FOR ALL USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_clients_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_clients_updated_at();
