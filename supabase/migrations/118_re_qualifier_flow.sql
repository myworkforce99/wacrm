-- ============================================================
-- 118_re_qualifier_flow.sql
--
-- Seed a Real Estate Qualifier flow (J6) using automations step types.
-- First, widen the constraints so flow_nodes and flows accept these.
-- Then seed the flow via the handle_new_user trigger so it applies to new accounts.
-- Finally, inject it into existing accounts.
-- ============================================================

ALTER TABLE flows DROP CONSTRAINT IF EXISTS flows_trigger_type_check;
ALTER TABLE flows ADD CONSTRAINT flows_trigger_type_check 
  CHECK (trigger_type IN ('keyword', 'first_inbound_message', 'manual', 'new_contact_created'));

ALTER TABLE flow_nodes DROP CONSTRAINT IF EXISTS flow_nodes_node_type_check;
ALTER TABLE flow_nodes ADD CONSTRAINT flow_nodes_node_type_check 
  CHECK (node_type IN ('start', 'send_buttons', 'send_list', 'send_message', 'collect_input', 'condition', 'set_tag', 'handoff', 'http_fetch', 'end', 'update_contact_field', 'assign_conversation'));

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
  v_flow_id UUID;
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

  -- 4. Real Estate Qualifier Flow (Auto)
  INSERT INTO public.flows (account_id, user_id, name, description, trigger_type, status, entry_node_id)
  VALUES (v_account_id, NEW.id, 'Real Estate Qualifier (Auto)', 'Automatically qualify new leads with budget, BHK, and location.', 'new_contact_created', 'draft', 'start')
  RETURNING id INTO v_flow_id;

  INSERT INTO public.flow_nodes (flow_id, node_key, node_type, config)
  VALUES 
    (v_flow_id, 'start', 'start', '{"next_node_key": "welcome"}'::jsonb),
    (v_flow_id, 'welcome', 'collect_input', '{"prompt_text": "Namaste {{vars.name}} ji! Thanks for your interest. To help us find the perfect property, what is your estimated budget? (Reply with a number)", "var_key": "budget", "next_node_key": "capture_budget"}'::jsonb),
    (v_flow_id, 'capture_budget', 'update_contact_field', '{"field": "custom:lead_details.budget_max", "value": "{{vars.budget}}", "next_node_key": "ask_bhk"}'::jsonb),
    (v_flow_id, 'ask_bhk', 'send_buttons', '{"text": "Which configuration are you looking for?", "buttons": [{"reply_id": "1bhk", "title": "1 BHK", "next_node_key": "capture_bhk"}, {"reply_id": "2bhk", "title": "2 BHK", "next_node_key": "capture_bhk"}, {"reply_id": "3bhk_plus", "title": "3+ BHK", "next_node_key": "capture_bhk"}]}'::jsonb),
    (v_flow_id, 'capture_bhk', 'update_contact_field', '{"field": "custom:lead_details.configuration_preference", "value": "{{vars.__last_interactive_reply_id}}", "next_node_key": "ask_location"}'::jsonb),
    (v_flow_id, 'ask_location', 'collect_input', '{"prompt_text": "Got it. Which location are you looking for?", "var_key": "location", "next_node_key": "capture_location"}'::jsonb),
    (v_flow_id, 'capture_location', 'update_contact_field', '{"field": "custom:lead_details.location_preference", "value": "{{vars.location}}", "next_node_key": "routing"}'::jsonb),
    (v_flow_id, 'routing', 'assign_conversation', '{"mode": "round_robin", "next_node_key": "end"}'::jsonb),
    (v_flow_id, 'end', 'end', '{}'::jsonb);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account/profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  acct RECORD;
  v_flow_id UUID;
BEGIN
  FOR acct IN SELECT id, owner_user_id FROM public.accounts LOOP
    INSERT INTO public.flows (account_id, user_id, name, description, trigger_type, status, entry_node_id)
    VALUES (acct.id, acct.owner_user_id, 'Real Estate Qualifier (Auto)', 'Automatically qualify new leads with budget, BHK, and location.', 'new_contact_created', 'draft', 'start')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_flow_id;

    IF v_flow_id IS NOT NULL THEN
      INSERT INTO public.flow_nodes (flow_id, node_key, node_type, config)
      VALUES 
        (v_flow_id, 'start', 'start', '{"next_node_key": "welcome"}'::jsonb),
        (v_flow_id, 'welcome', 'collect_input', '{"prompt_text": "Namaste {{vars.name}} ji! Thanks for your interest. To help us find the perfect property, what is your estimated budget? (Reply with a number)", "var_key": "budget", "next_node_key": "capture_budget"}'::jsonb),
        (v_flow_id, 'capture_budget', 'update_contact_field', '{"field": "custom:lead_details.budget_max", "value": "{{vars.budget}}", "next_node_key": "ask_bhk"}'::jsonb),
        (v_flow_id, 'ask_bhk', 'send_buttons', '{"text": "Which configuration are you looking for?", "buttons": [{"reply_id": "1bhk", "title": "1 BHK", "next_node_key": "capture_bhk"}, {"reply_id": "2bhk", "title": "2 BHK", "next_node_key": "capture_bhk"}, {"reply_id": "3bhk_plus", "title": "3+ BHK", "next_node_key": "capture_bhk"}]}'::jsonb),
        (v_flow_id, 'capture_bhk', 'update_contact_field', '{"field": "custom:lead_details.configuration_preference", "value": "{{vars.__last_interactive_reply_id}}", "next_node_key": "ask_location"}'::jsonb),
        (v_flow_id, 'ask_location', 'collect_input', '{"prompt_text": "Got it. Which location are you looking for?", "var_key": "location", "next_node_key": "capture_location"}'::jsonb),
        (v_flow_id, 'capture_location', 'update_contact_field', '{"field": "custom:lead_details.location_preference", "value": "{{vars.location}}", "next_node_key": "routing"}'::jsonb),
        (v_flow_id, 'routing', 'assign_conversation', '{"mode": "round_robin", "next_node_key": "end"}'::jsonb),
        (v_flow_id, 'end', 'end', '{}'::jsonb);
    END IF;
  END LOOP;
END;
$$;
