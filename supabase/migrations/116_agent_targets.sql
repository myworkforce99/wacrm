CREATE TABLE IF NOT EXISTS agent_targets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  agent_id     UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  period_start DATE NOT NULL,  -- first day of the month
  period_end   DATE NOT NULL,  -- last day of the month
  target_visits INTEGER NOT NULL DEFAULT 0,
  target_bookings INTEGER NOT NULL DEFAULT 0,
  UNIQUE (account_id, agent_id, period_start)
);
ALTER TABLE agent_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_targets_select ON agent_targets FOR SELECT USING (is_account_member(account_id));
CREATE POLICY agent_targets_manage ON agent_targets FOR ALL USING (is_account_member(account_id, 'admin'));
