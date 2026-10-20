-- ============================================================
-- 131_social_accounts.sql
-- Social media account connections (Instagram, Facebook Page)
-- per business account. Access tokens encrypted at rest with
-- the same ENCRYPTION_KEY used by whatsapp_config.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE social_platform AS ENUM ('instagram', 'facebook');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS social_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  platform          social_platform NOT NULL,
  -- Human-readable name pulled from Meta Graph API (e.g., "@prestige_homes")
  display_name      TEXT NOT NULL,
  -- Opaque platform user/page ID from Meta Graph API
  platform_user_id  TEXT NOT NULL,
  -- Encrypted long-lived access token (same scheme as whatsapp_config)
  access_token_enc  TEXT NOT NULL,
  -- ISO-8601 expiry for the access token; NULL = non-expiring system token
  token_expires_at  TIMESTAMPTZ,
  -- Profile picture URL pulled from Graph API at connect time
  avatar_url        TEXT,
  -- Soft-disconnect without destroying the row (allows reconnect)
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_accounts_account_platform_key UNIQUE (account_id, platform)
);

-- One active connection per platform per account (prevents duplicates).
CREATE UNIQUE INDEX IF NOT EXISTS social_accounts_unique_active
  ON social_accounts (account_id, platform)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_social_accounts_account
  ON social_accounts (account_id);

-- RLS: same pattern as api_keys, ai_configs, whatsapp_config.
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_accounts_select ON social_accounts;
DROP POLICY IF EXISTS social_accounts_insert ON social_accounts;
DROP POLICY IF EXISTS social_accounts_update ON social_accounts;
DROP POLICY IF EXISTS social_accounts_delete ON social_accounts;

-- Read access for all account members (including agents and viewers).
CREATE POLICY social_accounts_select ON social_accounts
  FOR SELECT USING (is_account_member(account_id));

-- Writes (connect/disconnect/delete) gated to admin+.
CREATE POLICY social_accounts_insert ON social_accounts
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));

CREATE POLICY social_accounts_update ON social_accounts
  FOR UPDATE USING (is_account_member(account_id, 'admin'));

CREATE POLICY social_accounts_delete ON social_accounts
  FOR DELETE USING (is_account_member(account_id, 'admin'));

-- updated_at trigger
DROP TRIGGER IF EXISTS set_social_accounts_updated_at ON social_accounts;
CREATE TRIGGER set_social_accounts_updated_at
  BEFORE UPDATE ON social_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
