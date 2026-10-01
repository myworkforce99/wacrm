-- ============================================================
-- 122_account_settings
--
-- Add a settings column to accounts to store arbitrary JSON
-- configuration like brokerage_pct.
-- ============================================================

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS settings JSONB;
