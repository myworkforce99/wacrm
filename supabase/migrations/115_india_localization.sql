-- Set INR as default for all existing accounts (safe, idempotent)
UPDATE accounts SET default_currency = 'INR' WHERE default_currency = 'USD';

-- Extend properties for Indian real estate
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS configuration TEXT,
  ADD COLUMN IF NOT EXISTS builder_name TEXT,
  ADD COLUMN IF NOT EXISTS project_name TEXT,
  ADD COLUMN IF NOT EXISTS rera_id TEXT,
  ADD COLUMN IF NOT EXISTS possession_status TEXT
    CHECK (possession_status IN ('ready_to_move','under_construction','nearing_possession')),
  ADD COLUMN IF NOT EXISTS possession_date DATE,
  ADD COLUMN IF NOT EXISTS carpet_area NUMERIC,
  ADD COLUMN IF NOT EXISTS facing TEXT;

-- Extend lead_details for Indian buyer preferences
ALTER TABLE lead_details
  ADD COLUMN IF NOT EXISTS configuration_preference TEXT[],
  ADD COLUMN IF NOT EXISTS possession_preference TEXT;

-- Extend site_visits for pickup logistics
ALTER TABLE site_visits
  ADD COLUMN IF NOT EXISTS pickup_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pickup_location TEXT;

-- Extend accounts for team language preference
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'en'
    CHECK (preferred_language IN ('en','hi','hi-en'));

-- Update existing T-2h reminder templates to include pickup logic
UPDATE automation_steps
SET step_config = '{"body": "Hi, a quick reminder about your site visit in 2 hours for {{property_title}}. {{#if pickup_required}}Our agent will pick you up from {{pickup_location}} at {{pickup_time}}. {{/if}}See you soon!"}'::jsonb
WHERE automation_id IN (
  SELECT id FROM automations WHERE trigger_type = 'visit_reminder_2h'
);

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
  v_auto_escalate_sla UUID;
  v_auto_escalate_stale UUID;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.accounts (name, owner_user_id)
  VALUES (COALESCE(NULLIF(v_full_name, ''), NEW.email, 'My account'), NEW.id)
  RETURNING id INTO v_account_id;

  -- Set INR as default currency for Indian CRM accounts
  UPDATE accounts SET default_currency = 'INR' WHERE id = v_account_id AND default_currency = 'USD';

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
  VALUES (v_auto_2h, 'send_message', '{"body": "Hi, a quick reminder about your site visit in 2 hours for {{property_title}}. {{#if pickup_required}}Our agent will pick you up from {{pickup_location}} at {{pickup_time}}. {{/if}}See you soon!"}'::jsonb, 0);

  -- 3. No-show Recovery
  INSERT INTO public.automations (account_id, user_id, name, description, trigger_type, is_active)
  VALUES (v_account_id, NEW.id, 'No-show Recovery', 'Sent when a pending visit passes its scheduled time.', 'visit_no_show', TRUE)
  RETURNING id INTO v_auto_noshow;

  INSERT INTO public.automation_steps (automation_id, step_type, step_config, position)
  VALUES (v_auto_noshow, 'send_message', '{"body": "Hi, it looks like we missed you for the site visit at {{property_title}}. Let us know if you would like to reschedule."}'::jsonb, 0);

  -- 4. SLA Breach Escalation (Section S6)
  INSERT INTO public.automations (account_id, user_id, name, description, trigger_type, is_active)
  VALUES (v_account_id, NEW.id, 'No WhatsApp reply in 30 min → notify manager', 'Escalation when an agent misses the response SLA.', 'sla_breach', FALSE)
  RETURNING id INTO v_auto_escalate_sla;

  INSERT INTO public.automation_steps (automation_id, step_type, step_config, position)
  VALUES (v_auto_escalate_sla, 'send_message', '{"body": "⚠️ SLA breach: {{contact_name}} has been waiting {{minutes}} min. Assigned to: {{agent_name}}."}'::jsonb, 0);

  -- 5. Stale Lead Escalation (Section S6)
  INSERT INTO public.automations (account_id, user_id, name, description, trigger_type, is_active)
  VALUES (v_account_id, NEW.id, 'Lead in New stage for 48h → escalate', 'Escalation for leads stuck in New for 2+ days.', 'stale_lead', FALSE)
  RETURNING id INTO v_auto_escalate_stale;

  INSERT INTO public.automation_steps (automation_id, step_type, step_config, position)
  VALUES (v_auto_escalate_stale, 'send_message', '{"body": "⚠️ Stale lead alert: {{contact_name}} has been in New stage for 48+ hours. Assigned to: {{agent_name}}."}'::jsonb, 0);

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
