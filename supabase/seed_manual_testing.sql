-- ============================================================
-- WACRM Manual Testing Seed — "Skyline Realty" (Mumbai)
-- 10-member team | Full workflow coverage
-- All logins: <email> / Test@1234
-- Account ID: 46a92878-11b4-44ff-a137-77c59a7c6b8d  (Ankit / owner)
-- Run: npx supabase db query --project-ref eielslitcyiknuupzwcf --file supabase/seed_manual_testing.sql
-- ============================================================
-- Users/account/profiles/tags already inserted in previous steps.
-- This file inserts: properties, contacts, deals, conversations,
-- messages, lead_details, site_visits, tasks, notifications,
-- agent_targets, contact_tags, open invitations.
-- ============================================================

-- ─── HELPERS ─────────────────────────────────────────────
-- Account   : 46a92878-11b4-44ff-a137-77c59a7c6b8d
-- Profiles  : (by user_id → profile_id)
--   Ankit   aa000001 → e827a271-21ca-483f-a2cd-809bc37723b1  owner
--   Priya   aa000002 → 2da53b21-c041-4ac4-b85e-d6f40a27a231  admin
--   Rahul   aa000003 → 37eefc3e-4c76-4165-bd97-591e31e2fbc8  admin
--   Amit    aa000004 → d7e8beb4-3e42-4c4d-b5b5-186f087426cd  agent
--   Sneha   aa000005 → 0fb1bc5b-fe31-45f8-aabb-d2d02ecd7081  agent
--   Kavita  aa000006 → fef11188-9b25-4cfb-99c7-1c467c5dea3e  agent
--   Rohan   aa000007 → 1ffa3c67-bdfa-40d0-959d-7fba413e68e7  agent
--   Vijay   aa000008 → e175b152-340f-47f7-9973-cded7a6b3135  agent
--   Neha    aa000009 → 7eb80218-2374-4eb7-9026-9194a4aaffe9  agent
--   Deepak  aa000010 → 45e7ab3f-4d6c-4f06-bfb8-22a5cc2efd7a  viewer
-- Pipeline stages (auto-seeded):
--   New         : 779e44da-36ae-4f5b-bf08-b62247eb5454
--   Contacted   : e9744450-5333-47bf-b88b-c95e82b567d5
--   Site Visit  : f9c57bc3-dd66-4094-b1d5-ab2e460df103
--   Negotiation : d51333ee-e28f-483f-ad0b-be66d91f1774
--   Closed      : 2c2eef16-6505-47c3-997e-2e7af11b7fd7
-- Pipeline id: (first pipeline of account)
DO $$ DECLARE v_pipeline_id UUID;
BEGIN
  SELECT id INTO v_pipeline_id FROM pipelines
  WHERE account_id='46a92878-11b4-44ff-a137-77c59a7c6b8d' LIMIT 1;
  RAISE NOTICE 'Pipeline: %', v_pipeline_id;
END $$;

-- ─── 1. PROPERTIES ────────────────────────────────────────
INSERT INTO properties (id, account_id, title, location, property_type, price, configuration, builder_name, project_name, possession_status, created_at)
VALUES
  (md5('sl-prop-1')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',
   'Skyline Heights — 3BHK Lake View','Powai, Mumbai','apartment',14500000,
   '{"bedrooms":3,"bathrooms":2,"area_sqft":1450}','Skyline Builders','Skyline Heights','ready_to_move',now()-'28d'::interval),
  (md5('sl-prop-2')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',
   'Skyline Heights — 2BHK','Powai, Mumbai','apartment',9800000,
   '{"bedrooms":2,"bathrooms":2,"area_sqft":1050}','Skyline Builders','Skyline Heights','ready_to_move',now()-'28d'::interval),
  (md5('sl-prop-3')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',
   'Marine Bay Towers — Sea View 4BHK','Worli, Mumbai','apartment',48000000,
   '{"bedrooms":4,"bathrooms":3,"area_sqft":2800}','Marine Developers','Marine Bay Towers','under_construction',now()-'25d'::interval),
  (md5('sl-prop-4')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',
   'Greenwood Villa — 4BHK','Thane West','villa',19500000,
   '{"bedrooms":4,"bathrooms":4,"area_sqft":3200}','Greenwood Homes','Greenwood Villas','ready_to_move',now()-'20d'::interval),
  (md5('sl-prop-5')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',
   'Metro Square — Office 1000sqft','Andheri East','commercial',6500000,
   '{"area_sqft":1000}','Metro Realty','Metro Square','ready_to_move',now()-'15d'::interval)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. CONTACTS (25 leads) ───────────────────────────────
INSERT INTO contacts (id, account_id, user_id, name, phone, email, created_at)
VALUES
  -- Amit's leads (aa000004)
  (md5('sl-c-01')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000004-0000-4000-8000-000000000004','Rajesh Kapoor',     '+919876500001','rajesh.kapoor@gmail.com',    now()-'25d'::interval),
  (md5('sl-c-02')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000004-0000-4000-8000-000000000004','Sunita Agarwal',    '+919876500002','sunita.agarwal@yahoo.com',   now()-'23d'::interval),
  (md5('sl-c-03')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000004-0000-4000-8000-000000000004','Vikram Tiwari',     '+919876500003','vikram.tiwari@gmail.com',    now()-'21d'::interval),
  (md5('sl-c-04')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000004-0000-4000-8000-000000000004','Meena Krishnan',    '+919876500004','meena.k@hotmail.com',        now()-'19d'::interval),
  (md5('sl-c-05')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000004-0000-4000-8000-000000000004','Arun Shah',         '+919876500005','arun.shah@gmail.com',        now()-'17d'::interval),
  -- Sneha's leads (aa000005)
  (md5('sl-c-06')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000005-0000-4000-8000-000000000005','Pooja Malhotra',    '+919876500006','pooja.m@gmail.com',          now()-'24d'::interval),
  (md5('sl-c-07')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000005-0000-4000-8000-000000000005','Sanjay Bhatia',     '+919876500007','sanjay.bhatia@gmail.com',    now()-'22d'::interval),
  (md5('sl-c-08')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000005-0000-4000-8000-000000000005','Geeta Narayanan',   '+919876500008','geeta.n@gmail.com',          now()-'20d'::interval),
  (md5('sl-c-09')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000005-0000-4000-8000-000000000005','Harish Pandey',     '+919876500009','harish.pandey@yahoo.com',    now()-'16d'::interval),
  -- Kavita's leads (aa000006)
  (md5('sl-c-10')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000006-0000-4000-8000-000000000006','Preethi Subramaniam','+919876500010','preethi.s@gmail.com',       now()-'22d'::interval),
  (md5('sl-c-11')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000006-0000-4000-8000-000000000006','Mohit Bansal',      '+919876500011','mohit.b@gmail.com',          now()-'19d'::interval),
  (md5('sl-c-12')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000006-0000-4000-8000-000000000006','Ritu Chauhan',      '+919876500012','ritu.c@gmail.com',           now()-'14d'::interval),
  -- Rohan's leads (aa000007)
  (md5('sl-c-13')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000007-0000-4000-8000-000000000007','Kiran Jain',        '+919876500013','kiran.jain@gmail.com',       now()-'18d'::interval),
  (md5('sl-c-14')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000007-0000-4000-8000-000000000007','Deepa Varma',       '+919876500014','deepa.v@yahoo.com',          now()-'15d'::interval),
  (md5('sl-c-15')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000007-0000-4000-8000-000000000007','Suresh Menon',      '+919876500015','suresh.menon@gmail.com',     now()-'12d'::interval),
  -- Vijay's leads (aa000008)
  (md5('sl-c-16')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000008-0000-4000-8000-000000000008','Alok Srivastava',   '+919876500016','alok.s@gmail.com',           now()-'20d'::interval),
  (md5('sl-c-17')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000008-0000-4000-8000-000000000008','Nandita Rao',       '+919876500017','nandita.r@gmail.com',        now()-'17d'::interval),
  (md5('sl-c-18')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000008-0000-4000-8000-000000000008','Girish Kulkarni',   '+919876500018','girish.k@gmail.com',         now()-'11d'::interval),
  -- Neha's leads (aa000009)
  (md5('sl-c-19')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000009-0000-4000-8000-000000000009','Fiona DSouza',      '+919876500019','fiona.dsouza@gmail.com',     now()-'13d'::interval),
  (md5('sl-c-20')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000009-0000-4000-8000-000000000009','Ramesh Iyer',       '+919876500020','ramesh.iyer@gmail.com',      now()-'10d'::interval),
  (md5('sl-c-21')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000009-0000-4000-8000-000000000009','Lata Patil',        '+919876500021','lata.patil@gmail.com',       now()-'8d'::interval),
  -- Owner-created / cross-assigned (aa000001)
  (md5('sl-c-22')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000001-0000-4000-8000-000000000001','Nikhil Singhania',  '+919876500022','nikhil.s@gmail.com',         now()-'7d'::interval),
  (md5('sl-c-23')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000001-0000-4000-8000-000000000001','Archana Dubey',     '+919876500023','archana.d@gmail.com',        now()-'5d'::interval),
  (md5('sl-c-24')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000001-0000-4000-8000-000000000001','Sunil Wagh',        '+919876500024','sunil.wagh@gmail.com',       now()-'4d'::interval),
  (md5('sl-c-25')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000001-0000-4000-8000-000000000001','Pallavi Joshi',     '+919876500025','pallavi.j@gmail.com',        now()-'2d'::interval)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. CONTACT TAGS ──────────────────────────────────────
INSERT INTO contact_tags (contact_id, tag_id) VALUES
  (md5('sl-c-01')::uuid, md5('skyline-tag-hot')::uuid),
  (md5('sl-c-01')::uuid, md5('skyline-tag-ready')::uuid),
  (md5('sl-c-02')::uuid, md5('skyline-tag-warm')::uuid),
  (md5('sl-c-03')::uuid, md5('skyline-tag-investor')::uuid),
  (md5('sl-c-06')::uuid, md5('skyline-tag-hot')::uuid),
  (md5('sl-c-07')::uuid, md5('skyline-tag-warm')::uuid),
  (md5('sl-c-10')::uuid, md5('skyline-tag-nri')::uuid),
  (md5('sl-c-11')::uuid, md5('skyline-tag-investor')::uuid),
  (md5('sl-c-13')::uuid, md5('skyline-tag-cold')::uuid),
  (md5('sl-c-16')::uuid, md5('skyline-tag-hot')::uuid),
  (md5('sl-c-16')::uuid, md5('skyline-tag-ready')::uuid),
  (md5('sl-c-17')::uuid, md5('skyline-tag-investor')::uuid),
  (md5('sl-c-19')::uuid, md5('skyline-tag-nri')::uuid),
  (md5('sl-c-22')::uuid, md5('skyline-tag-cold')::uuid),
  (md5('sl-c-25')::uuid, md5('skyline-tag-followup')::uuid)
ON CONFLICT DO NOTHING;

-- ─── 4. LEAD DETAILS ─────────────────────────────────────
INSERT INTO lead_details (id, account_id, contact_id, budget_min, budget_max, location_preference, property_type, intent, source, created_at)
VALUES
  (md5('sl-ld-01')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-01')::uuid, 9000000, 15000000,'Powai',     'apartment','buy','website',   now()-'25d'::interval),
  (md5('sl-ld-02')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-02')::uuid, 8000000, 12000000,'Powai',     'apartment','buy','referral',  now()-'23d'::interval),
  (md5('sl-ld-03')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-03')::uuid,20000000, 40000000,'Worli',     'apartment','invest','magicbricks',now()-'21d'::interval),
  (md5('sl-ld-04')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-06')::uuid,25000000, 50000000,'Worli',     'apartment','buy','referral',  now()-'24d'::interval),
  (md5('sl-ld-05')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-10')::uuid,30000000, 60000000,'Worli',     'apartment','buy','website',   now()-'22d'::interval),
  (md5('sl-ld-06')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-16')::uuid,10000000, 18000000,'Powai',     'apartment','buy','referral',  now()-'20d'::interval),
  (md5('sl-ld-07')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-17')::uuid,15000000, 25000000,'Thane',     'villa',    'invest','website', now()-'17d'::interval)
ON CONFLICT (id) DO NOTHING;

-- ─── 5. DEALS (21 across all pipeline stages) ─────────────
-- deals.assigned_to = profiles.id  (NOT user_id)
-- pipeline from account auto-seed
INSERT INTO deals (id, account_id, user_id, pipeline_id, stage_id, contact_id, title, value, currency, assigned_to, status, notes, created_at, updated_at)
SELECT
  md5(d.k)::uuid,
  '46a92878-11b4-44ff-a137-77c59a7c6b8d',
  d.user_id::uuid,
  (SELECT id FROM pipelines WHERE account_id='46a92878-11b4-44ff-a137-77c59a7c6b8d' LIMIT 1),
  d.stage_id::uuid,
  md5(d.contact_k)::uuid,
  d.title,
  d.value,
  'INR',
  (SELECT id FROM profiles WHERE user_id=d.profile_user_id::uuid AND account_id='46a92878-11b4-44ff-a137-77c59a7c6b8d'),
  d.status,
  d.notes,
  now() - d.age_days * INTERVAL '1 day',
  now() - d.updated_days * INTERVAL '1 day'
FROM (VALUES
  -- NEW stage
  ('sl-d-01','aa000004-0000-4000-8000-000000000004','779e44da-36ae-4f5b-bf08-b62247eb5454','sl-c-05','aa000004-0000-4000-8000-000000000004','Arun — 2BHK Powai',        9500000,'open', 'housing.com enquiry',                  17,17),
  ('sl-d-02','aa000007-0000-4000-8000-000000000007','779e44da-36ae-4f5b-bf08-b62247eb5454','sl-c-15','aa000007-0000-4000-8000-000000000007','Suresh — Office Andheri',  6000000,'open', 'Walk-in from property expo',            11,11),
  ('sl-d-03','aa000009-0000-4000-8000-000000000009','779e44da-36ae-4f5b-bf08-b62247eb5454','sl-c-21','aa000009-0000-4000-8000-000000000009','Lata — 2BHK Thane',        8200000,'open', 'Instagram ad lead',                     7, 7),
  -- STALE NEW (>48h — triggers stale-lead cron)
  ('sl-d-04','aa000007-0000-4000-8000-000000000007','779e44da-36ae-4f5b-bf08-b62247eb5454','sl-c-13','aa000007-0000-4000-8000-000000000007','Kiran — 3BHK Powai',      13500000,'open', 'No follow-up — stale 6 days',           18, 6),
  ('sl-d-05','aa000006-0000-4000-8000-000000000006','779e44da-36ae-4f5b-bf08-b62247eb5454','sl-c-12','aa000006-0000-4000-8000-000000000006','Ritu — 2BHK Thane',        8500000,'open', 'Kavita on leave, stale',                14, 5),
  -- CONTACTED
  ('sl-d-06','aa000004-0000-4000-8000-000000000004','e9744450-5333-47bf-b88b-c95e82b567d5','sl-c-02','aa000004-0000-4000-8000-000000000004','Sunita — 2BHK Powai',     10500000,'open', 'Site visit scheduled this week',        23, 3),
  ('sl-d-07','aa000005-0000-4000-8000-000000000005','e9744450-5333-47bf-b88b-c95e82b567d5','sl-c-07','aa000005-0000-4000-8000-000000000005','Sanjay — 3BHK Powai',     14000000,'open', 'Called twice, very interested',         21, 2),
  ('sl-d-08','aa000008-0000-4000-8000-000000000008','e9744450-5333-47bf-b88b-c95e82b567d5','sl-c-18','aa000008-0000-4000-8000-000000000008','Girish — 2BHK Powai',      9800000,'open', 'Prefers east-facing unit',              11, 1),
  ('sl-d-09','aa000009-0000-4000-8000-000000000009','e9744450-5333-47bf-b88b-c95e82b567d5','sl-c-20','aa000009-0000-4000-8000-000000000009','Ramesh — Office Andheri',  5500000,'open', 'Runs a CA firm, needs parking',         10, 2),
  -- SITE VISIT
  ('sl-d-10','aa000004-0000-4000-8000-000000000004','f9c57bc3-dd66-4094-b1d5-ab2e460df103','sl-c-01','aa000004-0000-4000-8000-000000000004','Rajesh — 3BHK Powai',     15000000,'open', 'Site visit done, loved lake view',      25, 4),
  ('sl-d-11','aa000005-0000-4000-8000-000000000005','f9c57bc3-dd66-4094-b1d5-ab2e460df103','sl-c-06','aa000005-0000-4000-8000-000000000005','Pooja — 4BHK Marine Bay',  45000000,'open', 'CEO family visiting Sunday',            23, 1),
  ('sl-d-12','aa000008-0000-4000-8000-000000000008','f9c57bc3-dd66-4094-b1d5-ab2e460df103','sl-c-16','aa000008-0000-4000-8000-000000000008','Alok — 3BHK Powai',       16000000,'open', 'Cash buyer, urgent decision',           20, 2),
  -- NEGOTIATION
  ('sl-d-13','aa000004-0000-4000-8000-000000000004','d51333ee-e28f-483f-ad0b-be66d91f1774','sl-c-03','aa000004-0000-4000-8000-000000000004','Vikram — Marine Bay 3BHK', 35000000,'open', 'Counter offer ₹33Cr submitted',         22, 3),
  ('sl-d-14','aa000006-0000-4000-8000-000000000006','d51333ee-e28f-483f-ad0b-be66d91f1774','sl-c-10','aa000006-0000-4000-8000-000000000006','Preethi — Marine Bay NRI', 38000000,'open', 'POA docs in transit from Dubai',        22, 2),
  ('sl-d-15','aa000008-0000-4000-8000-000000000008','d51333ee-e28f-483f-ad0b-be66d91f1774','sl-c-17','aa000008-0000-4000-8000-000000000008','Nandita — Greenwood Villa', 19000000,'open','Investor buying 2 villas',              17, 1),
  -- WON
  ('sl-d-16','aa000004-0000-4000-8000-000000000004','2c2eef16-6505-47c3-997e-2e7af11b7fd7','sl-c-04','aa000004-0000-4000-8000-000000000004','Meena — 2BHK Powai',      11000000,'won',  'Booking done ✓ Token paid',             20, 5),
  ('sl-d-17','aa000008-0000-4000-8000-000000000008','2c2eef16-6505-47c3-997e-2e7af11b7fd7','sl-c-11','aa000008-0000-4000-8000-000000000008','Mohit — 3BHK Powai',      14500000,'won',  'Registry on 2026-09-28',                20, 4),
  -- LOST
  ('sl-d-18','aa000005-0000-4000-8000-000000000005','2c2eef16-6505-47c3-997e-2e7af11b7fd7','sl-c-09','aa000005-0000-4000-8000-000000000005','Harish — Lost',            8000000,'lost', 'Budget revised, went with competitor',  17, 8),
  ('sl-d-19','aa000005-0000-4000-8000-000000000005','2c2eef16-6505-47c3-997e-2e7af11b7fd7','sl-c-08','aa000005-0000-4000-8000-000000000005','Geeta — Lost',             8500000,'lost', 'Not responding after site visit',       19, 9),
  -- OWNER cross-assigned to agents
  ('sl-d-20','aa000001-0000-4000-8000-000000000001','e9744450-5333-47bf-b88b-c95e82b567d5','sl-c-22','aa000004-0000-4000-8000-000000000004','Nikhil — Marine Bay 3BHK', 28000000,'open','Owner referred → assigned to Amit',     7, 1),
  ('sl-d-21','aa000001-0000-4000-8000-000000000001','779e44da-36ae-4f5b-bf08-b62247eb5454','sl-c-25','aa000009-0000-4000-8000-000000000009','Pallavi — 2BHK Powai',     9800000,'open', 'Walk-in → assigned to Neha',            2, 2)
) AS d(k, user_id, stage_id, contact_k, profile_user_id, title, value, status, notes, age_days, updated_days)
ON CONFLICT (id) DO NOTHING;

-- ─── 6. CONVERSATIONS ─────────────────────────────────────
INSERT INTO conversations (id, account_id, user_id, contact_id, assigned_agent_id, status, last_message_at, first_unanswered_at, created_at)
VALUES
  (md5('sl-conv-01')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000001-0000-4000-8000-000000000001',md5('sl-c-01')::uuid,'aa000004-0000-4000-8000-000000000004','open',now()-'4d'::interval,NULL,           now()-'25d'::interval),
  (md5('sl-conv-02')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000001-0000-4000-8000-000000000001',md5('sl-c-02')::uuid,'aa000004-0000-4000-8000-000000000004','open',now()-'3d'::interval,NULL,           now()-'23d'::interval),
  (md5('sl-conv-03')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000001-0000-4000-8000-000000000001',md5('sl-c-03')::uuid,'aa000004-0000-4000-8000-000000000004','open',now()-'3d'::interval,now()-'3d'::interval,now()-'21d'::interval),
  (md5('sl-conv-06')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000001-0000-4000-8000-000000000001',md5('sl-c-06')::uuid,'aa000005-0000-4000-8000-000000000005','open',now()-'1d'::interval,NULL,           now()-'24d'::interval),
  (md5('sl-conv-07')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000001-0000-4000-8000-000000000001',md5('sl-c-07')::uuid,'aa000005-0000-4000-8000-000000000005','open',now()-'2d'::interval,now()-'2d'::interval,now()-'22d'::interval),
  (md5('sl-conv-10')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000001-0000-4000-8000-000000000001',md5('sl-c-10')::uuid,'aa000006-0000-4000-8000-000000000006','open',now()-'2d'::interval,now()-'36h'::interval,now()-'22d'::interval),
  (md5('sl-conv-13')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000001-0000-4000-8000-000000000001',md5('sl-c-13')::uuid,'aa000007-0000-4000-8000-000000000007','open',now()-'6d'::interval,now()-'6d'::interval,now()-'18d'::interval),
  (md5('sl-conv-16')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000001-0000-4000-8000-000000000001',md5('sl-c-16')::uuid,'aa000008-0000-4000-8000-000000000008','open',now()-'2d'::interval,NULL,           now()-'20d'::interval),
  (md5('sl-conv-17')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000001-0000-4000-8000-000000000001',md5('sl-c-17')::uuid,'aa000008-0000-4000-8000-000000000008','open',now()-'1d'::interval,NULL,           now()-'17d'::interval),
  (md5('sl-conv-19')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000001-0000-4000-8000-000000000001',md5('sl-c-19')::uuid,'aa000009-0000-4000-8000-000000000009','open',now()-'1d'::interval,now()-'1d'::interval,now()-'13d'::interval),
  (md5('sl-conv-22')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000001-0000-4000-8000-000000000001',md5('sl-c-22')::uuid,'aa000004-0000-4000-8000-000000000004','open',now()-'1d'::interval,NULL,           now()-'7d'::interval)
ON CONFLICT (id) DO NOTHING;

-- ─── 7. MESSAGES ─────────────────────────────────────────
INSERT INTO messages (id, conversation_id, sender_type, sender_id, content_text, created_at)
VALUES
  -- Rajesh (Amit)
  (md5('sl-m-01')::uuid,md5('sl-conv-01')::uuid,'customer',NULL,'Hi, I saw your Skyline Heights listing. Is 3BHK available?',now()-'25d'::interval),
  (md5('sl-m-02')::uuid,md5('sl-conv-01')::uuid,'agent','aa000004-0000-4000-8000-000000000004','Hello Rajesh! Yes, 3BHK units start at Rs1.2Cr with lake view. Shall I schedule a visit?',now()-'25d'::interval+'2h'::interval),
  (md5('sl-m-03')::uuid,md5('sl-conv-01')::uuid,'customer',NULL,'Yes please, Saturday 11am works for me.',now()-'24d'::interval),
  (md5('sl-m-04')::uuid,md5('sl-conv-01')::uuid,'agent','aa000004-0000-4000-8000-000000000004','Confirmed! See you Saturday at 11am at Skyline Heights, Powai. I will send you the address.',now()-'24d'::interval+'1h'::interval),
  -- Pooja (Sneha)
  (md5('sl-m-10')::uuid,md5('sl-conv-06')::uuid,'customer',NULL,'Looking for 4BHK sea-facing in Mumbai. Budget Rs4-5Cr.',now()-'24d'::interval),
  (md5('sl-m-11')::uuid,md5('sl-conv-06')::uuid,'agent','aa000005-0000-4000-8000-000000000005','Marine Bay Towers in Worli has stunning sea-view 4BHK at Rs4.5Cr. Perfect for you!',now()-'24d'::interval+'3h'::interval),
  (md5('sl-m-12')::uuid,md5('sl-conv-06')::uuid,'customer',NULL,'Can you send brochure and floor plans?',now()-'23d'::interval),
  (md5('sl-m-13')::uuid,md5('sl-conv-06')::uuid,'agent','aa000005-0000-4000-8000-000000000005','Sharing brochure now! Also booking a family visit this weekend?',now()-'23d'::interval+'2h'::interval),
  -- Vikram (unanswered — first_unanswered_at set)
  (md5('sl-m-20')::uuid,md5('sl-conv-03')::uuid,'customer',NULL,'What is the expected rental yield at Marine Bay? Any RERA certificate?',now()-'3d'::interval),
  -- Kiran (stale, no agent response)
  (md5('sl-m-30')::uuid,md5('sl-conv-13')::uuid,'customer',NULL,'Hello, interested in 3BHK Powai. Please share details.',now()-'6d'::interval),
  -- Nikhil (owner-created, assigned to Amit)
  (md5('sl-m-40')::uuid,md5('sl-conv-22')::uuid,'customer',NULL,'Hi, Ankit referred me. Looking for 3BHK in Worli.',now()-'7d'::interval),
  (md5('sl-m-41')::uuid,md5('sl-conv-22')::uuid,'agent','aa000004-0000-4000-8000-000000000004','Hi Nikhil! Ankit told me about you. We have great Marine Bay options. Let me share the details.',now()-'6d'::interval)
ON CONFLICT (id) DO NOTHING;

-- ─── 8. SITE VISITS ──────────────────────────────────────
INSERT INTO site_visits (id, account_id, contact_id, property_id, scheduled_at, status, notes, created_at)
VALUES
  -- Completed
  (md5('sl-sv-01')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-01')::uuid,md5('sl-prop-1')::uuid,now()-'20d'::interval,'completed','Loved 12th floor lake view. Very interested in 3BHK.',now()-'22d'::interval),
  (md5('sl-sv-02')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-04')::uuid,md5('sl-prop-2')::uuid,now()-'12d'::interval,'completed','Chose unit A-803. Paid booking token ₹5L.',now()-'14d'::interval),
  (md5('sl-sv-03')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-11')::uuid,md5('sl-prop-1')::uuid,now()-'10d'::interval,'completed','Finalised unit B-1203 (Investor). Registry date set.',now()-'11d'::interval),
  (md5('sl-sv-04')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-16')::uuid,md5('sl-prop-1')::uuid,now()-'5d'::interval, 'completed','Cash buyer — very impressed. Expects final negotiation.',now()-'6d'::interval),
  -- No-show
  (md5('sl-sv-05')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-09')::uuid,md5('sl-prop-1')::uuid,now()-'15d'::interval,'no_show','Did not show up. Budget revised — went with competitor.',now()-'16d'::interval),
  (md5('sl-sv-06')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-08')::uuid,md5('sl-prop-4')::uuid,now()-'13d'::interval,'no_show','No response after confirmation. Call dropped.',now()-'14d'::interval),
  -- Upcoming
  (md5('sl-sv-07')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-06')::uuid,md5('sl-prop-3')::uuid,now()+'2d'::interval, 'confirmed','CEO family visiting Marine Bay. High priority.',now()-'2d'::interval),
  (md5('sl-sv-08')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-03')::uuid,md5('sl-prop-3')::uuid,now()+'4d'::interval, 'confirmed','Investor: wants ROI breakdown + legal docs.',now()-'1d'::interval)
ON CONFLICT (id) DO NOTHING;

-- ─── 9. TASKS ─────────────────────────────────────────────
INSERT INTO tasks (id, account_id, contact_id, title, due_at, assigned_to, created_by, done, created_at)
VALUES
  (md5('sl-t-01')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-03')::uuid,'Send ROI analysis to Vikram',                  now()+'1d'::interval, 'aa000004-0000-4000-8000-000000000004','aa000004-0000-4000-8000-000000000004',false,now()-'1d'::interval),
  (md5('sl-t-02')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-07')::uuid,'Follow up call with Sanjay re: visit',          now(),                'aa000005-0000-4000-8000-000000000005','aa000005-0000-4000-8000-000000000005',false,now()-'2d'::interval),
  (md5('sl-t-03')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-13')::uuid,'Kiran — no activity 6 days, follow up NOW',     now()-'1d'::interval, 'aa000007-0000-4000-8000-000000000007','aa000007-0000-4000-8000-000000000007',false,now()-'5d'::interval),
  (md5('sl-t-04')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-10')::uuid,'Collect POA documents from Preethi (Dubai)',    now()+'2d'::interval, 'aa000006-0000-4000-8000-000000000006','aa000006-0000-4000-8000-000000000006',false,now()-'2d'::interval),
  (md5('sl-t-05')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-17')::uuid,'Send Greenwood Villa brochure to Nandita',      now()-'2d'::interval, 'aa000008-0000-4000-8000-000000000008','aa000008-0000-4000-8000-000000000008',true, now()-'3d'::interval),
  (md5('sl-t-06')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-16')::uuid,'Prepare cost sheet + payment plan for Alok',   now(),                'aa000008-0000-4000-8000-000000000008','aa000001-0000-4000-8000-000000000001',false,now()-'1d'::interval),
  (md5('sl-t-07')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-22')::uuid,'Initial briefing call with Nikhil (Marine Bay)',now()+'1d'::interval, 'aa000004-0000-4000-8000-000000000004','aa000001-0000-4000-8000-000000000001',false,now()-'8h'::interval),
  (md5('sl-t-08')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',md5('sl-c-04')::uuid,'Send booking agreement to Meena',              now()-'4d'::interval, 'aa000004-0000-4000-8000-000000000004','aa000004-0000-4000-8000-000000000004',true, now()-'5d'::interval)
ON CONFLICT (id) DO NOTHING;

-- ─── 10. NOTIFICATIONS ────────────────────────────────────
INSERT INTO notifications (id, account_id, user_id, type, title, body, read, created_at)
VALUES
  (md5('sl-n-01')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000004-0000-4000-8000-000000000004','lead_assigned', 'New lead assigned',   'Nikhil Singhania (Marine Bay ₹2.8Cr) assigned by Ankit',false,now()-'8h'::interval),
  (md5('sl-n-02')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000007-0000-4000-8000-000000000007','stale_lead',    'Stale lead alert',    'Kiran Jain not contacted in 6 days. Follow up now!',    false,now()-'12h'::interval),
  (md5('sl-n-03')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000006-0000-4000-8000-000000000006','stale_lead',    'Stale lead alert',    'Ritu Chauhan deal stale 5 days in New stage',           false,now()-'6h'::interval),
  (md5('sl-n-04')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000005-0000-4000-8000-000000000005','site_visit',    'Visit tomorrow 11am', 'Pooja Malhotra — Marine Bay family visit confirmed',    false,now()-'2h'::interval),
  (md5('sl-n-05')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000004-0000-4000-8000-000000000004','deal_won',      'Deal Won!',           'Meena Krishnan — ₹1.1Cr deal closed! Well done Amit!',  true, now()-'5d'::interval),
  (md5('sl-n-06')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000001-0000-4000-8000-000000000001','task_overdue',  'Task overdue',        'Kiran follow-up task 1 day overdue (Rohan Nair)',       false,now()-'1h'::interval),
  (md5('sl-n-07')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000008-0000-4000-8000-000000000008','deal_won',      'Deal Won!',           'Mohit Bansal — ₹1.45Cr Investor deal closed!',         true, now()-'4d'::interval),
  (md5('sl-n-08')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000009-0000-4000-8000-000000000009','lead_assigned', 'New lead assigned',   'Pallavi Joshi (2BHK Powai ₹98L) assigned by Ankit',    false,now()-'2d'::interval)
ON CONFLICT (id) DO NOTHING;

-- ─── 11. AGENT TARGETS (this month) ──────────────────────
INSERT INTO agent_targets (id, account_id, agent_id, period_start, period_end, target_visits, target_bookings)
VALUES
  (md5('sl-at-01')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000004-0000-4000-8000-000000000004',date_trunc('month',now())::date,(date_trunc('month',now())+interval '1 month - 1 day')::date,8,2),
  (md5('sl-at-02')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000005-0000-4000-8000-000000000005',date_trunc('month',now())::date,(date_trunc('month',now())+interval '1 month - 1 day')::date,6,1),
  (md5('sl-at-03')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000006-0000-4000-8000-000000000006',date_trunc('month',now())::date,(date_trunc('month',now())+interval '1 month - 1 day')::date,5,1),
  (md5('sl-at-04')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000007-0000-4000-8000-000000000007',date_trunc('month',now())::date,(date_trunc('month',now())+interval '1 month - 1 day')::date,4,1),
  (md5('sl-at-05')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000008-0000-4000-8000-000000000008',date_trunc('month',now())::date,(date_trunc('month',now())+interval '1 month - 1 day')::date,7,2),
  (md5('sl-at-06')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d','aa000009-0000-4000-8000-000000000009',date_trunc('month',now())::date,(date_trunc('month',now())+interval '1 month - 1 day')::date,4,1)
ON CONFLICT (id) DO NOTHING;

-- ─── 12. OPEN INVITATIONS (for testing join flow) ─────────
INSERT INTO account_invitations (id, account_id, token_hash, role, created_by_user_id, label, expires_at)
VALUES
  (md5('sl-inv-01')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',encode(sha256('skyline-invite-agent-2026-10'::bytea),'hex'),'agent','aa000001-0000-4000-8000-000000000001','Open invite — Sales Agent',now()+'7d'::interval),
  (md5('sl-inv-02')::uuid,'46a92878-11b4-44ff-a137-77c59a7c6b8d',encode(sha256('skyline-invite-admin-2026-10'::bytea),'hex'),'admin','aa000001-0000-4000-8000-000000000001','Open invite — Admin',     now()+'7d'::interval)
ON CONFLICT (id) DO NOTHING;

-- ─── FINAL SUMMARY ───────────────────────────────────────
SELECT
  (SELECT count(*) FROM contacts      WHERE account_id='46a92878-11b4-44ff-a137-77c59a7c6b8d') as contacts,
  (SELECT count(*) FROM deals         WHERE account_id='46a92878-11b4-44ff-a137-77c59a7c6b8d') as deals,
  (SELECT count(*) FROM conversations WHERE account_id='46a92878-11b4-44ff-a137-77c59a7c6b8d') as conversations,
  (SELECT count(*) FROM site_visits   WHERE account_id='46a92878-11b4-44ff-a137-77c59a7c6b8d') as site_visits,
  (SELECT count(*) FROM tasks         WHERE account_id='46a92878-11b4-44ff-a137-77c59a7c6b8d') as tasks,
  (SELECT count(*) FROM notifications WHERE account_id='46a92878-11b4-44ff-a137-77c59a7c6b8d') as notifications,
  (SELECT count(*) FROM properties    WHERE account_id='46a92878-11b4-44ff-a137-77c59a7c6b8d') as properties,
  (SELECT count(*) FROM profiles      WHERE account_id='46a92878-11b4-44ff-a137-77c59a7c6b8d') as team_members;
