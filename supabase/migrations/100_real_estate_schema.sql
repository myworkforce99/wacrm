-- ============================================================
-- 043_real_estate_schema.sql — Real Estate extensions
--
-- Adds lead_details, site_visits, and properties for the
-- real estate CRM vertical. Modifies the handle_new_user
-- trigger to seed the Real Estate pipeline on signup.
-- ============================================================

-- ============================================================
-- LEAD DETAILS (1-to-1 extension of contacts)
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_details (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id   UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE UNIQUE,
  budget_min   NUMERIC,
  budget_max   NUMERIC,
  location_preference TEXT,
  property_type TEXT,
  intent       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_details_account ON lead_details(account_id);

ALTER TABLE lead_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_details_select ON lead_details;
CREATE POLICY lead_details_select ON lead_details FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS lead_details_insert ON lead_details;
CREATE POLICY lead_details_insert ON lead_details FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS lead_details_update ON lead_details;
CREATE POLICY lead_details_update ON lead_details FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS lead_details_delete ON lead_details;
CREATE POLICY lead_details_delete ON lead_details FOR DELETE
  USING (is_account_member(account_id, 'agent'));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON lead_details FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- PROPERTIES
-- ============================================================
CREATE TABLE IF NOT EXISTS properties (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  location     TEXT,
  price        NUMERIC,
  property_type TEXT,
  bedrooms     INTEGER,
  tags         TEXT[],
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_properties_account ON properties(account_id);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS properties_select ON properties;
CREATE POLICY properties_select ON properties FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS properties_insert ON properties;
CREATE POLICY properties_insert ON properties FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS properties_update ON properties;
CREATE POLICY properties_update ON properties FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS properties_delete ON properties;
CREATE POLICY properties_delete ON properties FOR DELETE
  USING (is_account_member(account_id, 'agent'));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SITE VISITS
-- ============================================================
CREATE TABLE IF NOT EXISTS site_visits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id   UUID REFERENCES contacts(id) ON DELETE SET NULL,
  property_id  UUID REFERENCES properties(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'no_show', 'rescheduled')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_visits_account ON site_visits(account_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_contact ON site_visits(contact_id);

ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_visits_select ON site_visits;
CREATE POLICY site_visits_select ON site_visits FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS site_visits_insert ON site_visits;
CREATE POLICY site_visits_insert ON site_visits FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS site_visits_update ON site_visits;
CREATE POLICY site_visits_update ON site_visits FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS site_visits_delete ON site_visits;
CREATE POLICY site_visits_delete ON site_visits FOR DELETE
  USING (is_account_member(account_id, 'agent'));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON site_visits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SIGNUP TRIGGER — replace to also seed a real estate pipeline
-- ============================================================
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

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account/profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
