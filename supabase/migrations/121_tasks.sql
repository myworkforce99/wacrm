CREATE TABLE IF NOT EXISTS tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id    UUID REFERENCES contacts(id) ON DELETE SET NULL,
  site_visit_id UUID REFERENCES site_visits(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  due_at        TIMESTAMPTZ,
  done          BOOLEAN NOT NULL DEFAULT FALSE,
  done_at       TIMESTAMPTZ,
  created_by    UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  assigned_to   UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_account ON tasks(account_id);
CREATE INDEX IF NOT EXISTS idx_tasks_contact ON tasks(contact_id);

-- Partial index for the "due today, not done" query pattern
CREATE INDEX IF NOT EXISTS idx_tasks_due_pending
  ON tasks(account_id, due_at) WHERE done = FALSE;

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- DROP IF EXISTS guards make this idempotent on re-run
DROP POLICY IF EXISTS tasks_select ON tasks;
DROP POLICY IF EXISTS tasks_insert ON tasks;
DROP POLICY IF EXISTS tasks_update ON tasks;
DROP POLICY IF EXISTS tasks_delete ON tasks;

CREATE POLICY tasks_select ON tasks FOR SELECT USING (is_account_member(account_id));
CREATE POLICY tasks_insert ON tasks FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY tasks_update ON tasks FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY tasks_delete ON tasks FOR DELETE USING (is_account_member(account_id, 'agent'));

DROP TRIGGER IF EXISTS set_updated_at ON tasks;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
