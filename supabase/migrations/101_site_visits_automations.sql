-- ============================================================
-- 044_site_visits_automations.sql — Site Visits Automations
--
-- Adds tracking columns to site_visits for cron-based reminders.
-- Updates handle_new_user to seed the 3 default automations for 
-- site visits (T-24h, T-2h, no-show).
-- ============================================================

ALTER TABLE site_visits 
  ADD COLUMN IF NOT EXISTS reminded_24h BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reminded_2h BOOLEAN NOT NULL DEFAULT FALSE;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_account_id UUID;
  v_pipeline_id UUID;
  v_auto_24h UUID;
  v_auto_2h UUID;
  v_auto_noshow UUID;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.accounts (name, owner_user_id)
  VALUES (COALESCE(NULLIF(v_full_name, ''), NEW.email, 'My account'), NEW.id)
  RETURNING id INTO v_account_id;

  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner');

  -- Create default real-estate pipeline
  INSERT INTO public.pipelines (account_id, user_id, name)
  VALUES (v_account_id, NEW.id, 'Real Estate')
  RETURNING id INTO v_pipeline_id;

  INSERT INTO public.pipeline_stages (pipeline_id, name, position, color)
  VALUES 
    (v_pipeline_id, 'New', 0, '#3b82f6'),
    (v_pipeline_id, 'Contacted', 1, '#8b5cf6'),
    (v_pipeline_id, 'Site Visit', 2, '#ec4899'),
    (v_pipeline_id, 'Negotiation', 3, '#f59e0b'),
    (v_pipeline_id, 'Closed', 4, '#10b981');

  -- Seed Site Visit Automations
  
  -- 1. T-24h Confirmation
  INSERT INTO public.automations (account_id, user_id, name, description, trigger_type, is_active)
  VALUES (v_account_id, NEW.id, 'T-24h Visit Confirmation', 'Sent 24 hours before a scheduled site visit.', 'visit_reminder_24h', TRUE)
  RETURNING id INTO v_auto_24h;

  INSERT INTO public.automation_steps (automation_id, step_type, step_config, position)
  VALUES (v_auto_24h, 'send_message', '{"body": "Hi, just confirming your site visit tomorrow at {{scheduled_at}} for {{property_title}}. Looking forward to seeing you!"}'::jsonb, 0);

  -- 2. T-2h Reminder
  INSERT INTO public.automations (account_id, user_id, name, description, trigger_type, is_active)
  VALUES (v_account_id, NEW.id, 'T-2h Visit Reminder', 'Sent 2 hours before a confirmed site visit.', 'visit_reminder_2h', TRUE)
  RETURNING id INTO v_auto_2h;

  INSERT INTO public.automation_steps (automation_id, step_type, step_config, position)
  VALUES (v_auto_2h, 'send_message', '{"body": "Hi, a quick reminder about your site visit in 2 hours for {{property_title}}. See you soon!"}'::jsonb, 0);

  -- 3. No-show Recovery
  INSERT INTO public.automations (account_id, user_id, name, description, trigger_type, is_active)
  VALUES (v_account_id, NEW.id, 'No-show Recovery', 'Sent when a pending visit passes its scheduled time.', 'visit_no_show', TRUE)
  RETURNING id INTO v_auto_noshow;

  INSERT INTO public.automation_steps (automation_id, step_type, step_config, position)
  VALUES (v_auto_noshow, 'send_message', '{"body": "Hi, it looks like we missed you for the site visit at {{property_title}}. Let us know if you would like to reschedule."}'::jsonb, 0);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account/profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
