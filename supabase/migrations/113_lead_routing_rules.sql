CREATE TABLE IF NOT EXISTS lead_routing_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  priority      INTEGER NOT NULL DEFAULT 0,
  condition_type TEXT NOT NULL
    CHECK (condition_type IN ('source','budget_gte','budget_lte','location_contains','configuration')),
  condition_value TEXT NOT NULL,
  action_type   TEXT NOT NULL
    CHECK (action_type IN ('assign_to_agent','assign_to_role')),
  action_value  TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_routing_rules_account ON lead_routing_rules(account_id, priority);
ALTER TABLE lead_routing_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS routing_rules_select ON lead_routing_rules;
CREATE POLICY routing_rules_select ON lead_routing_rules FOR SELECT USING (is_account_member(account_id));
DROP POLICY IF EXISTS routing_rules_manage ON lead_routing_rules;
CREATE POLICY routing_rules_manage ON lead_routing_rules FOR ALL USING (is_account_member(account_id, 'admin'));
