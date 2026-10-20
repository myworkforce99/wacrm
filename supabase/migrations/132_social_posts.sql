-- ============================================================
-- 132_social_posts.sql
-- Social media posts — draft, immediate publish, or scheduled.
-- Scheduling is introduced in Phase 2; the status enum includes
-- 'scheduled' from day one so Phase 2 is a zero-migration add.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE social_post_status AS ENUM (
    'draft',       -- saved but not queued
    'scheduled',   -- Phase 2: queued for future publish
    'publishing',  -- in-flight API call to Meta
    'published',   -- successfully published
    'failed'       -- Meta rejected or network error
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS social_posts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  social_account_id   UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  -- Caption text (Instagram: up to 2,200 chars; Facebook: up to 63,206 chars)
  caption             TEXT,
  -- Phase 1: single image URL in Supabase Storage.
  -- Phase 2+: extend to TEXT[] for carousel support.
  media_url           TEXT,
  -- Supabase Storage object path (for deletion/management)
  media_storage_path  TEXT,
  status              social_post_status NOT NULL DEFAULT 'draft',
  -- Phase 2: populated when status = 'scheduled'
  scheduled_at        TIMESTAMPTZ,
  -- Meta's returned post ID (e.g., "17841405338028819_12345") after publish
  platform_post_id    TEXT,
  -- Human-readable error message if status = 'failed'
  failure_reason      TEXT,
  -- Retry counter for the scheduler (Phase 2)
  retry_count         INT NOT NULL DEFAULT 0,
  last_attempt_at     TIMESTAMPTZ,
  -- Author who created the post
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for list queries: most recent posts first per account.
CREATE INDEX IF NOT EXISTS idx_social_posts_account_created ON social_posts (account_id, created_at DESC);
-- Phase 2: index to efficiently poll for due scheduled posts.
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON social_posts (scheduled_at)
  WHERE status = 'scheduled';

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_posts_select ON social_posts;
DROP POLICY IF EXISTS social_posts_insert ON social_posts;
DROP POLICY IF EXISTS social_posts_update ON social_posts;
DROP POLICY IF EXISTS social_posts_delete ON social_posts;

-- Read access for all account members (including viewers).
CREATE POLICY social_posts_select ON social_posts
  FOR SELECT USING (is_account_member(account_id));

-- Agents and admins can create and update posts
CREATE POLICY social_posts_insert ON social_posts
  FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY social_posts_update ON social_posts
  FOR UPDATE USING (is_account_member(account_id, 'agent'));

CREATE POLICY social_posts_delete ON social_posts
  FOR DELETE USING (is_account_member(account_id, 'agent'));

DROP TRIGGER IF EXISTS set_social_posts_updated_at ON social_posts;
CREATE TRIGGER set_social_posts_updated_at
  BEFORE UPDATE ON social_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket for social media uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'social-media',
  'social-media',
  TRUE,
  16777216, -- 16 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Social media is publicly readable" ON storage.objects;
CREATE POLICY "Social media is publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'social-media');

DROP POLICY IF EXISTS "Members can upload social media" ON storage.objects;
CREATE POLICY "Members can upload social media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'social-media'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Members can update social media" ON storage.objects;
CREATE POLICY "Members can update social media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'social-media'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Members can delete social media" ON storage.objects;
CREATE POLICY "Members can delete social media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'social-media'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );

