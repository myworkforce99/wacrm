-- migration 120_portal_connections.sql
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS portal_connections JSONB NOT NULL DEFAULT '{}'::jsonb;
