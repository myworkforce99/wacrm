-- ============================================================
-- 126_re_onboarding_presets.sql — Real Estate Onboarding Presets
--
-- Extends the signup trigger (handle_new_user) to automatically
-- seed a curated set of real estate onboarding defaults for every
-- new account so agents hit the ground running with zero manual
-- configuration.
--
-- Presets added here:
--   1. Lead Tags          — hot/warm/cold signal tags + source tags
--   2. Contact Custom Fields — RE-specific fields on the contacts table
--   3. Quick Replies      — inbox canned replies for common RE conversations
--
-- The handle_new_user trigger is updated with CREATE OR REPLACE
-- (not DROP + CREATE) so the existing trigger binding is preserved.
--
-- A DO $$ ... $$ backfill block at the bottom applies the same
-- presets to existing accounts that pre-date this migration.
--
-- SAFE PATTERN NOTES
--   - Tags are user_id-scoped (original 001 schema, migrated via 017).
--     We use the account's owner_user_id for seeding — consistent with
--     how pipelines and automations are seeded.
--   - Custom fields are user_id-scoped (same as tags). Fields added here
--     use descriptive field_name values so they appear alongside manually
--     created fields; there is no UNIQUE constraint on field_name, so
--     running the backfill DO block is idempotent per the guard logic
--     that skips accounts already having RE custom fields.
--   - Quick replies are account_id + user_id-scoped (035 schema). Seeded
--     with kind='text' to stay within the existing CHECK constraint.
-- ============================================================

-- ============================================================
-- HELPER FUNCTION: seed_re_presets_for_account
--
-- Factored out so both handle_new_user and the backfill block
-- can call it without duplicating logic.  Declared SECURITY
-- DEFINER so it can bypass RLS during the backfill.
-- ============================================================

CREATE OR REPLACE FUNCTION public.seed_re_presets_for_account(
  p_account_id UUID,
  p_user_id    UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- --------------------------------------------------------
  -- 1. LEAD TAGS
  --    Priority-signal tags (Hot / Warm / Cold) give agents
  --    instant visual filtering in the contacts list.
  --    Source tags mirror the portal_connections column so
  --    manually-imported leads can be categorised the same way.
  -- --------------------------------------------------------
  INSERT INTO public.tags (account_id, user_id, name, color)
  VALUES
    -- Priority signal
    (p_account_id, p_user_id, '🔥 Hot',              '#ef4444'),  -- red
    (p_account_id, p_user_id, '🟡 Warm',             '#f59e0b'),  -- amber
    (p_account_id, p_user_id, '🔵 Cold',             '#3b82f6'),  -- blue
    -- Lead source
    (p_account_id, p_user_id, '99acres',             '#16a34a'),  -- green
    (p_account_id, p_user_id, 'MagicBricks',         '#dc2626'),  -- red-600
    (p_account_id, p_user_id, 'Housing.com',         '#7c3aed'),  -- violet
    (p_account_id, p_user_id, 'NoBroker',            '#0284c7'),  -- sky
    (p_account_id, p_user_id, 'Walk-in',             '#0d9488'),  -- teal
    (p_account_id, p_user_id, 'Referral',            '#d97706'),  -- amber-600
    (p_account_id, p_user_id, 'Meta Ads',            '#2563eb'),  -- blue-600
    (p_account_id, p_user_id, 'Google Ads',          '#16a34a'),  -- green-600
    (p_account_id, p_user_id, 'Manual Entry',        '#6b7280'),  -- gray
    -- Intent stage (supplement the pipeline)
    (p_account_id, p_user_id, 'Site Visit Done',     '#10b981'),  -- emerald
    (p_account_id, p_user_id, 'Docs Requested',      '#8b5cf6'),  -- purple
    (p_account_id, p_user_id, 'Loan Inquiry',        '#f97316'),  -- orange
    (p_account_id, p_user_id, 'Not Responding',      '#991b1b'),  -- red-800
    (p_account_id, p_user_id, 'Not Interested',      '#374151')   -- gray-700
  ON CONFLICT DO NOTHING;

  -- --------------------------------------------------------
  -- 2. CONTACT CUSTOM FIELDS
  --    Structured fields displayed in the contact detail panel.
  --    These complement lead_details (which holds the core RE
  --    qualification data) with CRM-workflow fields.
  -- --------------------------------------------------------
  INSERT INTO public.custom_fields (account_id, user_id, field_name, field_type, field_options)
  VALUES
    -- Lead source (free-text complement to source tags)
    (p_account_id, p_user_id, 'Lead Source',          'select',
     '["99acres","MagicBricks","Housing.com","NoBroker","Walk-in","Referral","Meta Ads","Google Ads","Manual Entry","Other"]'::jsonb),
    -- Budget range display label (lead_details stores numeric min/max;
    -- this field gives agents a quick human-readable label)
    (p_account_id, p_user_id, 'Budget Range',         'select',
     '["Under ₹25L","₹25L–50L","₹50L–1Cr","₹1Cr–2Cr","₹2Cr–5Cr","₹5Cr+"]'::jsonb),
    -- Property interest type
    (p_account_id, p_user_id, 'Property Interest',    'select',
     '["Apartment","Villa","Plot","Commercial","Row House","Penthouse"]'::jsonb),
    -- Possession timeline preference
    (p_account_id, p_user_id, 'Possession Timeline',  'select',
     '["Immediate","Within 3 months","3–6 months","6–12 months","1–2 years","2+ years"]'::jsonb),
    -- Loan status — affects urgency and closure probability
    (p_account_id, p_user_id, 'Loan Pre-approval',    'select',
     '["Not Applied","Applied","Pre-approved","Sanctioned","Not Required"]'::jsonb),
    -- Last visit / follow-up date (text to avoid timezone complexity)
    (p_account_id, p_user_id, 'Last Site Visit Date', 'text',     NULL),
    -- Agent notes on lead priority (free-form)
    (p_account_id, p_user_id, 'Follow-up Priority',   'select',
     '["High","Medium","Low","On Hold"]'::jsonb),
    -- Secondary phone or WhatsApp alternate
    (p_account_id, p_user_id, 'Alternate Contact',    'text',     NULL)
  ON CONFLICT DO NOTHING;

  -- --------------------------------------------------------
  -- 3. QUICK REPLIES (Inbox Canned Responses)
  --    Common real estate conversation snippets an agent can
  --    insert in one click from the inbox composer.
  --    All use kind='text' (existing CHECK constraint allows
  --    'text' | 'interactive' | 'cost_sheet').
  -- --------------------------------------------------------
  INSERT INTO public.quick_replies (account_id, user_id, kind, title, content_text)
  VALUES
    -- Initial response after a new inbound lead message
    (p_account_id, p_user_id, 'text',
     '👋 Welcome – intro',
     'Namaste! Thank you for reaching out. I am {{agent_name}} from our team. Could you please share your property requirement — budget, location, and configuration? I will help you find the best options. 🏠'),

    -- Site visit scheduling
    (p_account_id, p_user_id, 'text',
     '📅 Schedule Site Visit',
     'Great! Would you like to schedule a site visit at your convenience? Please let me know your preferred date and time and I will confirm the appointment. We can also arrange pickup if needed.'),

    -- Site visit confirmation
    (p_account_id, p_user_id, 'text',
     '✅ Site Visit Confirmed',
     'Your site visit is confirmed! 📍 Property: {{property_title}} 📅 Date & Time: {{scheduled_at}}. Our representative will be there to assist you. See you soon!'),

    -- Post site-visit follow-up
    (p_account_id, p_user_id, 'text',
     '🔁 Post-Visit Follow-up',
     'Hi! Hope you enjoyed the site visit. Would you like to share your feedback or have any questions about the property? We are here to help you make the best decision. 😊'),

    -- Price negotiation / offer
    (p_account_id, p_user_id, 'text',
     '💰 Negotiate / Best Price',
     'We understand budget is important. I have shared your query with the management and we will try to get you the best possible price. Could you let me know your final budget so we can explore options?'),

    -- Document checklist
    (p_account_id, p_user_id, 'text',
     '📋 Document Checklist',
     'Here is the basic document checklist for booking: ✅ Aadhaar Card ✅ PAN Card ✅ 6 months bank statement ✅ Income proof (salary slips / ITR) ✅ Passport-size photographs. Let me know if you need help with any of these.'),

    -- Loan assistance referral
    (p_account_id, p_user_id, 'text',
     '🏦 Home Loan Assistance',
     'We work with leading banks and housing finance companies for home loans at competitive rates. Would you like us to connect you with our loan advisor? They will help you with eligibility, documentation, and quick approvals.'),

    -- Not-interested / nurture close
    (p_account_id, p_user_id, 'text',
     '💤 Keep in Touch (Not Ready)',
     'No worries at all! I will keep you updated whenever a property matching your requirement becomes available. Feel free to reach out any time. Thank you for your time! 🙏'),

    -- No-show reschedule
    (p_account_id, p_user_id, 'text',
     '🔄 Reschedule Site Visit',
     'Hi! We noticed you missed your site visit today. No worries — it happens! Would you like to reschedule? Please let me know a convenient time and we will set it up right away.'),

    -- RERA / legal enquiry
    (p_account_id, p_user_id, 'text',
     '⚖️ RERA & Legal Info',
     'This project is RERA registered. You can verify the details at: https://rera.gov.in. For any legal due diligence queries feel free to ask — our legal team can assist.')

  ON CONFLICT DO NOTHING;

END;
$$;

ALTER FUNCTION public.seed_re_presets_for_account(UUID, UUID) OWNER TO postgres;

-- ============================================================
-- UPDATE handle_new_user to call the new helper after setting
-- up the pipeline/automations/flow that already exist.
-- ============================================================

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

  -- Set INR as default currency for Indian CRM accounts (from 115)
  UPDATE accounts SET default_currency = 'INR' WHERE id = v_account_id AND default_currency = 'USD';

  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner');

  -- Create default real-estate pipeline (from 100)
  INSERT INTO public.pipelines (account_id, user_id, name)
  VALUES (v_account_id, NEW.id, 'Real Estate')
  RETURNING id INTO v_pipeline_id;

  INSERT INTO public.pipeline_stages (pipeline_id, name, position, color)
  VALUES 
    (v_pipeline_id, 'New',         0, '#3b82f6'),
    (v_pipeline_id, 'Contacted',   1, '#8b5cf6'),
    (v_pipeline_id, 'Site Visit',  2, '#ec4899'),
    (v_pipeline_id, 'Negotiation', 3, '#f59e0b'),
    (v_pipeline_id, 'Closed',      4, '#10b981');

  -- Seed site-visit automations (from 115)
  INSERT INTO public.automations (account_id, user_id, name, description, trigger_type, is_active)
  VALUES (v_account_id, NEW.id, 'T-24h Visit Confirmation', 'Sent 24 hours before a scheduled site visit.', 'visit_reminder_24h', TRUE)
  RETURNING id INTO v_auto_24h;

  INSERT INTO public.automation_steps (automation_id, step_type, step_config, position)
  VALUES (v_auto_24h, 'send_message', '{"body": "Hi, just confirming your site visit tomorrow at {{scheduled_at}} for {{property_title}}. Looking forward to seeing you!"}'::jsonb, 0);

  INSERT INTO public.automations (account_id, user_id, name, description, trigger_type, is_active)
  VALUES (v_account_id, NEW.id, 'T-2h Visit Reminder', 'Sent 2 hours before a confirmed site visit.', 'visit_reminder_2h', TRUE)
  RETURNING id INTO v_auto_2h;

  INSERT INTO public.automation_steps (automation_id, step_type, step_config, position)
  VALUES (v_auto_2h, 'send_message', '{"body": "Hi, a quick reminder about your site visit in 2 hours for {{property_title}}. {{#if pickup_required}}Our agent will pick you up from {{pickup_location}} at {{pickup_time}}. {{/if}}See you soon!"}'::jsonb, 0);

  INSERT INTO public.automations (account_id, user_id, name, description, trigger_type, is_active)
  VALUES (v_account_id, NEW.id, 'No-show Recovery', 'Sent when a pending visit passes its scheduled time.', 'visit_no_show', TRUE)
  RETURNING id INTO v_auto_noshow;

  INSERT INTO public.automation_steps (automation_id, step_type, step_config, position)
  VALUES (v_auto_noshow, 'send_message', '{"body": "Hi, it looks like we missed you for the site visit at {{property_title}}. Let us know if you would like to reschedule."}'::jsonb, 0);

  -- Seed real estate qualifier flow (from 118/123)
  INSERT INTO public.flows (account_id, user_id, name, description, trigger_type, status, entry_node_id)
  VALUES (v_account_id, NEW.id, 'Real Estate Qualifier (Auto)', 'Automatically qualify new leads with budget, BHK, and location.', 'new_contact_created', 'draft', 'start')
  RETURNING id INTO v_flow_id;

  INSERT INTO public.flow_nodes (flow_id, node_key, node_type, config)
  VALUES 
    (v_flow_id, 'start',            'start',              '{"next_node_key": "welcome"}'::jsonb),
    (v_flow_id, 'welcome',          'collect_input',      '{"prompt_text": "Namaste {{vars.name}} ji! Thanks for your interest. To help us find the perfect property, what is your estimated budget? (Reply with a number)", "var_key": "budget", "next_node_key": "capture_budget"}'::jsonb),
    (v_flow_id, 'capture_budget',   'update_contact_field', '{"field": "custom:lead_details.budget_max", "value": "{{vars.budget}}", "next_node_key": "ask_bhk"}'::jsonb),
    (v_flow_id, 'ask_bhk',          'send_buttons',       '{"text": "Which configuration are you looking for?", "buttons": [{"reply_id": "1bhk", "title": "1 BHK", "next_node_key": "capture_bhk"}, {"reply_id": "2bhk", "title": "2 BHK", "next_node_key": "capture_bhk"}, {"reply_id": "3bhk_plus", "title": "3+ BHK", "next_node_key": "capture_bhk"}]}'::jsonb),
    (v_flow_id, 'capture_bhk',      'update_contact_field', '{"field": "custom:lead_details.configuration_preference", "value": "{{vars.__last_interactive_reply_id}}", "next_node_key": "ask_location"}'::jsonb),
    (v_flow_id, 'ask_location',     'collect_input',      '{"prompt_text": "Got it. Which location are you looking for?", "var_key": "location", "next_node_key": "capture_location"}'::jsonb),
    (v_flow_id, 'capture_location', 'update_contact_field', '{"field": "custom:lead_details.location_preference", "value": "{{vars.location}}", "next_node_key": "routing"}'::jsonb),
    (v_flow_id, 'routing',          'assign_conversation', '{"mode": "round_robin", "next_node_key": "end"}'::jsonb),
    (v_flow_id, 'end',              'end',                '{}'::jsonb);

  -- Seed RE onboarding presets (tags, custom fields, quick replies)
  PERFORM public.seed_re_presets_for_account(v_account_id, NEW.id);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account/profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- ============================================================
-- BACKFILL: apply presets to all existing accounts
--
-- Guard: only runs for accounts whose owner does not already
-- have any RE tags (checking for '🔥 Hot' which is unique to
-- this preset set). This prevents duplicate seeding if the
-- migration is re-applied.
-- ============================================================
DO $$
DECLARE
  acct RECORD;
BEGIN
  FOR acct IN
    SELECT a.id AS account_id, a.owner_user_id AS user_id
    FROM public.accounts a
    WHERE NOT EXISTS (
      SELECT 1 FROM public.tags t
      WHERE t.user_id = a.owner_user_id
        AND t.name = '🔥 Hot'
    )
  LOOP
    PERFORM public.seed_re_presets_for_account(acct.account_id, acct.user_id);
  END LOOP;
END;
$$;
