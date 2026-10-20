-- ============================================================
-- 133_social_scheduler_cron.sql
-- Registers a pg_cron job to trigger the social post scheduler
-- Edge Function every minute.
-- Requires pg_cron and pg_net extensions (already enabled in Supabase).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  -- Unschedule existing job if already scheduled to avoid duplicate jobs
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'social-post-scheduler') THEN
    PERFORM cron.unschedule('social-post-scheduler');
  END IF;

  PERFORM cron.schedule(
    'social-post-scheduler',
    '* * * * *',
    $cron$
      SELECT net.http_post(
        url := COALESCE(current_setting('app.supabase_functions_url', true), 'http://localhost:54321/functions/v1') || '/social-post-scheduler',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(current_setting('app.service_role_key', true), '')
        ),
        body := '{}'::jsonb
      );
    $cron$
  );
EXCEPTION
  WHEN OTHERS THEN
    -- In environments where pg_cron / net cannot run or setting is absent, do not block migration
    RAISE NOTICE 'Skipping pg_cron setup in environment: %', SQLERRM;
END $$;
