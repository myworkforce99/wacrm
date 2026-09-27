-- ============================================================
-- 116_re_broadcast_templates.sql
--
-- Seed real estate broadcast message templates as requested in Section J5.
-- Since quick_replies is account-scoped and restricted by a check constraint,
-- a separate global broadcast_templates helper table is created.
-- ============================================================

CREATE TABLE IF NOT EXISTS broadcast_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en_US',
  category TEXT NOT NULL DEFAULT 'Marketing',
  body_text TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE broadcast_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS broadcast_templates_select ON broadcast_templates;
CREATE POLICY broadcast_templates_select ON broadcast_templates FOR SELECT USING (true);

INSERT INTO broadcast_templates (name, body_text, tags)
VALUES
  (
    'Diwali Offer 🪔',
    'Namaste {{1}} ji! 🎉 Is Diwali, humne aapke liye ek khaas property offer select ki hai. {{2}} — sirf ₹{{3}} mein. Site visit book karein aaj hi! 🏠',
    '{"real-estate"}'
  ),
  (
    'New Project Launch 🏠',
    '{{1}} ji, exciting news! Nayi property launch — {{2}} in {{3}}. {{4}} BHK from ₹{{5}}. RERA: {{6}}. Limited units — reply YES to book a priority visit.',
    '{"real-estate"}'
  ),
  (
    'Price Drop Alert 📉',
    '{{1}} ji, price drop alert! {{2}} ({{3}} BHK, {{4}}) ki price ab ₹{{5}} ho gayi hai — pehle ₹{{6}} thi. Abhi enquire karein!',
    '{"real-estate"}'
  )
ON CONFLICT DO NOTHING;
