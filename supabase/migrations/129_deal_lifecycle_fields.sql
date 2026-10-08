-- ============================================================
-- 129_deal_lifecycle_fields.sql — Deal lifecycle enrichment
--
-- Adds the fields recommended by the pipeline workflow review:
--
--   lost_reasons        — lookup table for loss reason codes (dropdown options).
--                         Account-scoped so teams can customise reasons.
--   deals.closed_at     — timestamp frozen when status changes to won/lost.
--                         More reliable than updated_at for monthly reports
--                         (updated_at moves on any field edit post-close).
--   deals.lost_reason_id — FK → lost_reasons.id; required when status='lost'.
--                          NULL for won/open deals.
--   deals.lost_note     — free-form text added at loss time (optional).
--   deals.lost_from_stage_id — snapshot of stage_id at time of loss.
--                          Lets funnel analytics answer "at which stage do
--                          we lose the most deals?" without touching stage_id.
--   deals.won_value     — actual final sale price vs expected value (optional).
--                          Agents can record the negotiated number at close.
--   deals.reopened_count — incremented each time a closed deal is reopened.
--                          Useful for quality/spam detection.
--   deals.last_activity_at — updated on every significant deal event
--                          (stage move, status change, note save). Powers
--                          the "rotting" stale-deal badge.
--   deals.re_engage_on  — optional re-engagement date set at loss time.
--                          A future automation cron fires a WhatsApp nudge
--                          on this date.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- LOST_REASONS lookup table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lost_reasons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  position    SMALLINT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lost_reasons_account
  ON public.lost_reasons(account_id);

ALTER TABLE public.lost_reasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can read lost reasons" ON public.lost_reasons;
DROP POLICY IF EXISTS "Account members can manage lost reasons" ON public.lost_reasons;

-- Agents+ can read; admins+ can create/update/delete
CREATE POLICY "Account members can read lost reasons" ON public.lost_reasons
  FOR SELECT USING (public.is_account_member(account_id));

CREATE POLICY "Account members can manage lost reasons" ON public.lost_reasons
  FOR ALL USING (public.is_account_member(account_id, 'admin'));

-- ============================================================
-- DEALS — new lifecycle columns
-- ============================================================

-- FK to lost_reasons (nullable — only populated on lost deals)
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS lost_reason_id UUID
    REFERENCES public.lost_reasons(id) ON DELETE SET NULL;

-- Optional free-text note explaining the loss
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS lost_note TEXT;

-- Snapshot of stage_id at time of loss (stage_id itself is never overwritten)
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS lost_from_stage_id UUID
    REFERENCES public.pipeline_stages(id) ON DELETE SET NULL;

-- Timestamp frozen when status changes to won or lost
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Actual negotiated value at close (may differ from expected value)
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS won_value NUMERIC(12, 2);

-- How many times this deal has been reopened from won/lost -> open
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS reopened_count INTEGER NOT NULL DEFAULT 0;

-- Updated on every significant activity; powers the stale-deal badge
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- Optional re-engagement date set at loss time
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS re_engage_on DATE;

-- Backfill last_activity_at from updated_at / created_at for existing rows
UPDATE public.deals
  SET last_activity_at = COALESCE(updated_at, created_at)
  WHERE last_activity_at IS NULL;

-- Backfill closed_at for deals already in won/lost state
UPDATE public.deals
  SET closed_at = COALESCE(updated_at, created_at)
  WHERE status IN ('won', 'lost')
    AND closed_at IS NULL;

-- Index to speed up board queries filtered by status
CREATE INDEX IF NOT EXISTS idx_deals_status
  ON public.deals(status);

CREATE INDEX IF NOT EXISTS idx_deals_last_activity
  ON public.deals(last_activity_at)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_deals_closed_at
  ON public.deals(closed_at)
  WHERE status IN ('won', 'lost');

-- ============================================================
-- SEED default lost reasons for every existing account
-- (new accounts are seeded by handle_new_user below)
-- ============================================================
INSERT INTO public.lost_reasons (account_id, label, position)
SELECT
  a.id,
  r.label,
  r.pos
FROM public.accounts a
CROSS JOIN (
  VALUES
    ('Budget mismatch',               0::smallint),
    ('Bought elsewhere',              1::smallint),
    ('Not responding',                2::smallint),
    ('Location / property mismatch',  3::smallint),
    ('Loan rejected',                 4::smallint),
    ('Just browsing',                 5::smallint),
    ('Project delayed',               6::smallint),
    ('Other',                         7::smallint)
) AS r(label, pos)
WHERE NOT EXISTS (
  SELECT 1 FROM public.lost_reasons lr
  WHERE lr.account_id = a.id
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- UPDATE handle_new_user to seed lost_reasons for new accounts
-- and rename the 'Closed' pipeline stage to 'Booking / Token Paid'
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name   TEXT;
  v_account_id  UUID;
  v_pipeline_id UUID;
  v_auto_24h    UUID;
  v_auto_2h     UUID;
  v_auto_noshow UUID;
  v_flow_id     UUID;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.accounts (name, owner_user_id)
  VALUES (COALESCE(NULLIF(v_full_name, ''), NEW.email, 'My account'), NEW.id)
  RETURNING id INTO v_account_id;

  -- Set INR as default currency for Indian CRM accounts (from 115)
  UPDATE accounts SET default_currency = 'INR' WHERE id = v_account_id AND default_currency = 'USD';

  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner');

  -- Create default real-estate pipeline.
  -- NOTE: 'Closed' is now 'Booking / Token Paid' — a real process step,
  --       not an outcome. Won/Lost are handled via deal.status, not stage name.
  INSERT INTO public.pipelines (account_id, user_id, name)
  VALUES (v_account_id, NEW.id, 'Real Estate')
  RETURNING id INTO v_pipeline_id;

  INSERT INTO public.pipeline_stages (pipeline_id, name, position, color)
  VALUES
    (v_pipeline_id, 'New',                  0, '#3b82f6'),
    (v_pipeline_id, 'Contacted',            1, '#8b5cf6'),
    (v_pipeline_id, 'Site Visit',           2, '#ec4899'),
    (v_pipeline_id, 'Negotiation',          3, '#f59e0b'),
    (v_pipeline_id, 'Booking / Token Paid', 4, '#10b981');

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
    (v_flow_id, 'start',            'start',                '{"next_node_key": "welcome"}'::jsonb),
    (v_flow_id, 'welcome',          'collect_input',        '{"prompt_text": "Namaste {{vars.name}} ji! Thanks for your interest. To help us find the perfect property, what is your estimated budget? (Reply with a number)", "var_key": "budget", "next_node_key": "capture_budget"}'::jsonb),
    (v_flow_id, 'capture_budget',   'update_contact_field', '{"field": "custom:lead_details.budget_max", "value": "{{vars.budget}}", "next_node_key": "ask_bhk"}'::jsonb),
    (v_flow_id, 'ask_bhk',          'send_buttons',         '{"text": "Which configuration are you looking for?", "buttons": [{"reply_id": "1bhk", "title": "1 BHK", "next_node_key": "capture_bhk"}, {"reply_id": "2bhk", "title": "2 BHK", "next_node_key": "capture_bhk"}, {"reply_id": "3bhk_plus", "title": "3+ BHK", "next_node_key": "capture_bhk"}]}'::jsonb),
    (v_flow_id, 'capture_bhk',      'update_contact_field', '{"field": "custom:lead_details.configuration_preference", "value": "{{vars.__last_interactive_reply_id}}", "next_node_key": "ask_location"}'::jsonb),
    (v_flow_id, 'ask_location',     'collect_input',        '{"prompt_text": "Got it. Which location are you looking for?", "var_key": "location", "next_node_key": "capture_location"}'::jsonb),
    (v_flow_id, 'capture_location', 'update_contact_field', '{"field": "custom:lead_details.location_preference", "value": "{{vars.location}}", "next_node_key": "routing"}'::jsonb),
    (v_flow_id, 'routing',          'assign_conversation',  '{"mode": "round_robin", "next_node_key": "end"}'::jsonb),
    (v_flow_id, 'end',              'end',                  '{}'::jsonb);

  -- Seed RE onboarding presets (tags, custom fields, quick replies)
  PERFORM public.seed_re_presets_for_account(v_account_id, NEW.id);

  -- Seed default lost reasons for this account
  INSERT INTO public.lost_reasons (account_id, label, position)
  VALUES
    (v_account_id, 'Budget mismatch',              0),
    (v_account_id, 'Bought elsewhere',             1),
    (v_account_id, 'Not responding',               2),
    (v_account_id, 'Location / property mismatch', 3),
    (v_account_id, 'Loan rejected',                4),
    (v_account_id, 'Just browsing',                5),
    (v_account_id, 'Project delayed',              6),
    (v_account_id, 'Other',                        7)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account/profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
