-- Restrict property creation, update, and deletion to admin and owner roles.
-- All account members (including agents and viewers) retain SELECT access for viewing,
-- sharing on WhatsApp, and scheduling site visits.

DROP POLICY IF EXISTS properties_insert ON properties;
CREATE POLICY properties_insert ON properties FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS properties_update ON properties;
CREATE POLICY properties_update ON properties FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS properties_delete ON properties;
CREATE POLICY properties_delete ON properties FOR DELETE
  USING (is_account_member(account_id, 'admin'));
