# WACRM Real Estate — Manual Testing Plan

> **Audience:** New developer onboarding to the project.
> **Purpose:** Step-by-step test cases covering every implemented UI feature, real estate workflow, and API endpoint of the WACRM Real Estate fork. Use this as a structured walkthrough before writing any code or making any changes.
> **Base Repo:** [ArnasDon/wacrm](https://github.com/ArnasDon/wacrm) — this fork is a vertical B2B SaaS for Indian real estate business teams.
> **App URL (local):** `http://localhost:3000`

---

## Table of Contents

1. [Pre-Testing Setup](#1-pre-testing-setup)
2. [Auth & Onboarding Flows](#2-auth--onboarding-flows)
3. [Dashboard](#3-dashboard)
4. [Leads (Contacts)](#4-leads-contacts)
5. [Pipeline (Kanban)](#5-pipeline-kanban)
6. [Site Visits](#6-site-visits)
7. [Inbox (WhatsApp)](#7-inbox-whatsapp)
8. [Properties](#8-properties)
9. [Automations](#9-automations)
10. [Flows (Conversation Bots)](#10-flows-conversation-bots)
11. [Broadcasts](#11-broadcasts)
12. [Integrations Page](#12-integrations-page)
13. [Tasks & Follow-ups](#13-tasks--follow-ups)
14. [Cost Sheet](#14-cost-sheet)
15. [Team / Manager Dashboard](#15-team--manager-dashboard)
16. [Settings](#16-settings)
17. [Billing & Plan Gating](#17-billing--plan-gating)
18. [Reporting & Exports](#18-reporting--exports)
19. [Public REST API (v1)](#19-public-rest-api-v1)
20. [PWA & Mobile Shell](#20-pwa--mobile-shell)
21. [Role-Based Access Control (RBAC)](#21-role-based-access-control-rbac)
22. [India Localization](#22-india-localization)
23. [Known Issues & Error Log](#23-known-issues--error-log)

---

## 1. Pre-Testing Setup

### 1.1 Environment

| Item            | Value                   |
| --------------- | ----------------------- |
| Node version    | ≥ 20                    |
| Package manager | npm                     |
| Local app URL   | `http://localhost:3000` |
| Dev command     | `npm run dev`           |

### 1.2 Environment Variables

Before starting `npm run dev`, confirm `.env.local` has:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ENCRYPTION_KEY=...
META_APP_SECRET=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_APP_LOCALE=en
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
INBOUND_EMAIL_DOMAIN=...
CRON_SECRET=...
```

### 1.3 Seed Test Accounts

Create the following test users before starting tests. Use the signup flow at `/signup` or seed directly via Supabase dashboard:

| Role     | Email               | Purpose                              |
| -------- | ------------------- | ------------------------------------ |
| `owner`  | `owner@retest.com`  | Business owner, full access          |
| `admin`  | `admin@retest.com`  | Manager with team oversight          |
| `agent`  | `agent1@retest.com` | Sales agent, scoped access           |
| `agent`  | `agent2@retest.com` | Second agent (for round-robin tests) |
| `viewer` | `viewer@retest.com` | Read-only observer                   |

### 1.4 Seed Test Data

Using the Supabase dashboard or seed scripts, ensure:

- At least **10 contacts** with varied sources (99acres, MagicBricks, Housing.com, Manual)
- At least **5 deals** across different pipeline stages
- At least **3 properties** with BHK configs, RERA IDs, prices
- At least **2 site visits** (one confirmed, one pending)
- At least **2 tasks** (one overdue, one due today)

---

## 2. Auth & Onboarding Flows

### TC-AUTH-01: Login Page

**URL:** `/login`

1. Open `http://localhost:3000` — should redirect to `/login` (not crash).
2. Verify page has email + password fields and a "Sign In" button.
3. Submit with empty fields → expect inline validation errors.
4. Submit with wrong credentials → expect "Invalid credentials" error toast.
5. Submit with valid `owner@retest.com` credentials → expect redirect to `/dashboard`.
6. On successful login, check browser DevTools → Application → Cookies for a Supabase session cookie.

**Expected:** ✅ Login works; invalid creds show an error; valid creds redirect to dashboard.

---

### TC-AUTH-02: Signup & Onboarding Wizard

**URL:** `/signup`

1. Open `/signup`. Fill in name, email (`newowner@retest.com`), password.
2. Submit → verify email confirmation message (or immediate redirect if email confirm is disabled).
3. After confirmation, log in → wizard should appear with steps:
   - Step 1: Account creation summary
   - Step 2: WhatsApp number connect (reuses WhatsApp config component)
   - Step 3: Pipeline template selection (Real Estate should be default)
   - Step 4: Team invite
4. Skip WhatsApp step → verify you land on Dashboard with a "Connect WhatsApp" prompt visible.
5. Verify the **Real Estate Qualifier Flow** is automatically seeded in `/flows` for the new account.

**Expected:** ✅ Wizard completes without errors; RE pipeline seeded; qualifier flow present.

---

### TC-AUTH-03: Invite & Join Flow

**URL:** `/settings` → Team tab → Invite

1. Log in as `owner`.
2. Go to Settings → Team → click "Invite Member".
3. Enter `agent1@retest.com`, assign role `agent`, send invite.
4. Open the invite link received (check Supabase `account_invitations` table for the token).
5. Visit `/join/[token]` → accept invite → verify user lands on dashboard with agent-scoped nav.
6. **Seat limit test:** Downgrade seat limit to 1 in DB (`UPDATE accounts SET seat_limit = 1`). Try inviting another member → verify `SEAT_LIMIT_REACHED` error and "Upgrade Plan" CTA in the invite dialog.

**Expected:** ✅ Invite works; seat limit enforced with correct error message.

---

### TC-AUTH-04: Password Reset

**URL:** `/forgot-password`

1. Navigate to `/forgot-password`.
2. Enter a valid email → verify success message ("Check your email").
3. Enter an invalid email → verify graceful error, not a crash.

---

## 3. Dashboard

**URL:** `/dashboard` | Login as: `owner`

### TC-DASH-01: Stat Cards

1. Confirm 4 stat cards render: **New Leads Today**, **Follow-ups Due**, **Site Visits Today**, **Pipeline Value**.
2. "Follow-ups Due" card should show count + an **overdue sub-label** in amber/red (from overdue tasks + unanswered conversations).
3. "Pipeline Value" must display in **₹ INR format** (e.g., "₹1.5Cr" not "$1.5M").
4. Click each stat card → verify it navigates to the correct filtered list.

**Expected:** ✅ All 4 cards populate with real data; INR formatting correct.

---

### TC-DASH-02: Today's Visits Widget

1. Verify "Today's Visits" widget shows site visits scheduled for today.
2. Each visit row should show: lead name, property name (if linked), time, status pill.
3. Click a visit → should navigate to lead detail or visit detail.

---

### TC-DASH-03: Today's Tasks Widget

1. Verify "Today's Tasks" widget renders with tasks due today.
2. Each task row: checkbox, title, linked lead name (tappable), due time ("Due 2h ago" format).
3. **Quick-create:** Type a task title in the inline input → click "Add" → task appears in list without page reload.
4. **Check off task:** Click the checkbox on a task → row disappears optimistically.
5. Reload page → confirm the checked task is gone from the widget.

---

### TC-DASH-04: Quick-Action Bar

1. Four quick-action buttons must be visible: **New Lead**, **Schedule Visit**, **Cost Sheet**, **Broadcast**.
2. "Cost Sheet" button should be **disabled with tooltip** "Set up your Cost Sheet in Settings → Cost Sheet" when no template is configured.
3. Click "New Lead" → opens contact creation form.
4. Click "Schedule Visit" → opens site visit scheduling sheet.
5. Click "Broadcast" → navigates to `/broadcasts/new` (admin+) OR shows permission denied for agents.

---

### TC-DASH-05: Team Setup Checklist (Owner only)

1. Log in as a freshly created owner with no agents/leads.
2. On dashboard, expect a collapsible **Setup Checklist** card at the top with steps:
   - ✅ Account Created
   - ⬜ Connect WhatsApp
   - ⬜ Invite First Agent
   - ⬜ Import Leads
   - ⬜ Set Routing Rules
   - ⬜ Set Monthly Targets
3. Click "Got it, don't show again" → checklist hides; reload → still hidden.
4. Log in as `agent1` → checklist should NOT appear.

---

### TC-DASH-06: Recent Activity Feed

1. Verify an activity feed is visible showing recent events (new leads, messages, deals moved).
2. Activities should be scoped: agents see only their activity; admins see team-wide activity.

---

## 4. Leads (Contacts)

**URL:** `/contacts` | Login as: `agent1` and separately as `admin`

### TC-LEAD-01: Leads List — Basic

1. Leads list renders with columns: Name, Source Badge, Stage, Assigned Agent, Budget, Last Activity.
2. **Source badges** render correctly: colored pills for 99acres / MagicBricks / Housing.com / Manual.
3. **SLA badge** renders per lead: green (< 5 min), amber (5–30 min), red (> 30 min unanswered).
4. Sort by "Last Activity" → list re-sorts.

---

### TC-LEAD-02: Filter Chips

1. Filter chips available: All, New, Contacted, Site Visit, Negotiation, Closed (pipeline stages).
2. Click "New" filter → only leads in "New" stage show.
3. Click source filter (99acres) → only 99acres leads show.
4. Combine stage + source filters → correct intersection.
5. Clear filters → full list returns.

---

### TC-LEAD-03: Agent-Scoped View

1. Log in as `agent1`.
2. Leads list should show **only leads assigned to agent1** (not all team leads).
3. Log in as `admin` → all leads visible.

> [!IMPORTANT]
> This is a critical B2B isolation test. If agent sees other agents' leads, that's a security defect.

---

### TC-LEAD-04: Create a New Lead

1. Click "+ New Lead" or the "New Lead" quick action.
2. Fill in: Name, Mobile (+91 XXXXXXXXXX format), Source (select "99acres"), Budget Min/Max, Location, BHK Config, Stage.
3. Submit → lead appears in list with correct source badge.
4. Open the lead detail → verify all fields are saved, including `lead_details` (Budget, Location, BHK, Source).

---

### TC-LEAD-05: Lead Detail View

**URL:** `/contacts/[id]`

1. Lead detail page shows: name, phone, email, tags, source badge, SLA badge.
2. **Tabs:** Overview, Tasks, Conversation History, Notes.
3. Overview tab: Budget (INR format), Location preference, BHK Config, Assigned Agent, Stage.
4. Tasks tab: shows tasks linked to this lead; inline task creation pre-fills `contact_id`.
5. **"Cost Sheet" button** in action bar → opens cost sheet modal with this lead pre-selected.
6. **"Match Properties" button** → shows top 2–3 matching properties based on budget/location/BHK.
7. **Assigned to:** shows agent name with a tappable assignment history (audit trail).

---

### TC-LEAD-06: Swipe Actions (Mobile)

> Test at 390px viewport width.

1. On the leads list, swipe left on a lead row.
2. Actions visible: "Assign", "Tag", "Close".
3. Tap "Close" → lead conversation closes; lead moves to Closed stage.

---

### TC-LEAD-07: Lead Ownership & Assignment History

1. Open a lead detail.
2. "Assigned to" section shows current agent.
3. Click/tap to see assignment history → modal/sheet shows: from-agent, to-agent, actor, timestamp, reason.
4. Admin reassigns the lead → a new audit row appears in the history immediately.

---

### TC-LEAD-08: Bulk Actions (Admin only)

1. Log in as `admin`.
2. In leads list, enable selection mode (checkbox icon or multi-select button).
3. Select 3 leads.
4. Floating bottom bar appears: "3 leads selected · Reassign → · Tag → · Close".
5. Click "Reassign" → agent picker dialog appears → select `agent2` → confirm.
6. Confirm dialog: "Reassign 3 leads from Agent1 to Agent2? This also updates their WhatsApp conversation assignments."
7. After confirming, leads show `agent2` as assigned.
8. Log in as `agent` → bulk action UI (checkbox toggle) should NOT appear.

---

### TC-LEAD-09: CSV Import

**URL:** `/contacts/import`

1. Log in as `admin`, navigate to `/contacts/import`.
2. Upload a CSV with columns: Customer Name, Mobile, Source, Budget, Location, BHK.
3. Step 2 — Column mapping: verify auto-mapping detects "Mobile" → Mobile, "Customer Name" → Name.
4. Preview shows 5 sample rows correctly mapped.
5. Click "Import X contacts" → result shows `{ created: N, skipped: 0, errors: 0 }`.
6. Check leads list → imported leads appear with correct INR budget.
7. **Duplicate test:** Re-import the same CSV → all rows should be `skipped` (dedup by phone).
8. **Indian phone format test:** Import a contact with mobile "09876543210" → verify it stores as "+919876543210".
9. **Indian budget format test:** Import a contact with budget "45L" → verify it stores as `4500000`.
10. Log in as `agent` → `/contacts/import` should redirect or show "Contact your admin".

---

## 5. Pipeline (Kanban)

**URL:** `/pipelines` | Login as: `owner`, then as `agent1`

### TC-PIPE-01: Pipeline Board — Desktop

1. Pipeline board renders as a kanban with columns: **New → Contacted → Site Visit → Negotiation → Closed/Won**.
2. Deal cards show: lead name, source badge, budget (₹ INR format), **brokerage badge** (e.g., "≈ ₹30K @ 2%").
3. Drag a deal card from "New" to "Contacted" → deal updates immediately; no page reload.
4. Deal card shows the assigned agent's avatar.

---

### TC-PIPE-02: Pipeline Mobile — Swipeable Tabs

> Test at 390px viewport.

1. Stages appear as horizontal swipeable tabs at the top.
2. Deal cards stack vertically within the active stage.
3. Tap a deal card → shows deal detail sheet.
4. "Move to…" button → bottom sheet shows all stages; select one → deal moves.

---

### TC-PIPE-03: Deal-Move Permission Guard (C6)

1. Log in as `agent1`.
2. Try to drag (or use "Move to…") a deal assigned to `agent2` to a different stage.
3. **Expected:** Toast: "This lead belongs to [Agent2 Name]. Contact your admin to move it."
4. **API test:** `PATCH /api/deals/[id]` where the deal belongs to `agent2` → should return `403 { error: 'DEAL_NOT_YOURS' }`.
5. Log in as `admin` → admin can freely move any deal.

---

### TC-PIPE-04: Pipeline Analytics

1. Find the pipeline analytics section (donut chart or funnel).
2. Chart shows deal count/value per stage.
3. "Won" and "Lost" deals are tracked separately.

---

## 6. Site Visits

**URL:** `/site-visits` | Login as: `agent1`

### TC-VISIT-01: Site Visits List

1. Visits grouped by day (Today, Tomorrow, This Week, etc.).
2. Each visit row: lead name, property, time, status pill (Scheduled / Confirmed / Completed / No-Show).
3. One-tap call button next to lead name.
4. One-tap WhatsApp button (opens conversation in inbox).

---

### TC-VISIT-02: Schedule a Visit

1. Click "+ Schedule Visit" or use Dashboard quick action.
2. Bottom sheet opens: lead picker, optional property picker, date/time picker.
3. **Pickup toggle:** Toggle "Pickup Needed?" ON → text field for pickup address appears.
4. Submit → visit appears in the list with "Scheduled" status.
5. Check that the corresponding **T-24h automation** is queued (verify in Supabase `automation_pending_executions`).

---

### TC-VISIT-03: Confirm / Reschedule

1. Tap a visit with "Scheduled" status.
2. "Confirm" button → status changes to "Confirmed" immediately.
3. "Reschedule" button → date/time picker opens; submit new time → visit updates.

---

### TC-VISIT-04: No-Show Automation

1. Create a visit with `scheduled_at` in the past (e.g., 3 hours ago) and status "Scheduled".
2. Simulate the T+2h no-show trigger (manually call the automation engine or advance time in a test).
3. Verify a "no-show recovery" WhatsApp message is queued/sent to the lead.

---

## 7. Inbox (WhatsApp)

**URL:** `/inbox`

### TC-INBOX-01: Conversation List

1. Inbox shows open WhatsApp conversations.
2. Conversations show: contact name, last message preview, timestamp, unread count badge.
3. **Assigned/Unassigned filter** — filter by "Mine" vs "Team" vs "Unassigned".
4. Agent logs in → sees only their assigned conversations.

---

### TC-INBOX-02: Message Thread

1. Click a conversation → message thread opens.
2. Sent and received messages render in WhatsApp-style bubbles.
3. Delivery/read receipts visible (✓ / ✓✓ ticks).
4. Scroll up loads older messages (pagination).

---

### TC-INBOX-03: Send a Message

1. Type a message in the composer → press Send (or Enter).
2. Message appears immediately in the thread (optimistic).
3. Delivery receipt updates within seconds.

---

### TC-INBOX-04: AI Draft Reply

1. Click the "AI Draft" / spark button in the composer.
2. AI generates a draft reply based on conversation context.
3. Edit the draft → send it.
4. Verify the AI usage log entry in Supabase `ai_usage_log`.

---

### TC-INBOX-05: Template Picker

1. Click the template button in the composer.
2. Pre-approved Meta message templates appear.
3. Select a site visit reminder template → template body fills the composer with placeholder variables.
4. Send → message delivered with correct format.

---

### TC-INBOX-06: Assign Conversation

1. In conversation detail, find "Assigned to:" selector.
2. Change assignment to `agent2` → verify conversation moves to agent2's inbox.
3. Verify the **assignment audit log** entry is created.

---

### TC-INBOX-07: SLA Badge in Inbox

1. Conversations in the list show a green/amber/red SLA badge based on time since first unanswered inbound message.
2. Reply to a conversation → SLA badge resets to green.

---

## 8. Properties

**URL:** `/properties`

### TC-PROP-01: Properties List

1. Properties list renders with: title, location, price (₹ INR format), configuration (BHK), status.
2. Filter by location, budget range, configuration (BHK chip selector).

---

### TC-PROP-02: Property Detail

1. Property detail shows all fields: Title, Location, Price, Configuration (BHK), Builder Name, Project Name.
2. **RERA ID badge:** Shows "RERA: MH/2023/12345" prominently. If missing → amber warning "RERA ID missing — required under RERA Act 2016".
3. Possession status pill: Ready to Move / Under Construction / Nearing Possession.
4. Carpet area displayed in sq ft.
5. **EMI Calculator** (collapsible): inputs for loan amount (pre-filled as 80% of price), tenure (years), interest rate %. Output: monthly EMI in ₹ INR format + "Total Interest" + "Fits Budget?" indicator.

---

### TC-PROP-03: Create / Edit Property

1. Click "+ New Property".
2. Fill: Title, Location, Price (₹), Configuration (BHK chip selector — multi-select), RERA ID, Possession Status, Carpet Area (sq ft), Facing.
3. **RERA Verify link:** Click "Verify →" next to RERA ID → opens `https://rera.gov.in` in a new tab.
4. Save → property appears in list with correct INR price.

---

### TC-PROP-04: Property Matching from Lead

1. Open a lead detail with location_preference "Noida" and budget_max "₹60L".
2. Click "Match Properties" → shows top 2–3 properties matching location + budget + BHK.
3. Click "Send via WhatsApp" on a matched property → property details sent as a WhatsApp message.
4. Verify the WhatsApp message text contains property title, price (INR), RERA ID, BHK config.

---

## 9. Automations

**URL:** `/automations`

### TC-AUTO-01: Automation Recipes List

1. List shows automation recipes (toggles).
2. Toggle an automation ON → verify it's stored as active in Supabase `automations` table.
3. Pre-seeded real estate automations visible:
   - T-24h Site Visit Confirmation (English)
   - T-2h Site Visit Reminder (English)
   - No-Show Recovery (English)
   - `[HI]` Hinglish variants of all three (when `preferred_language = 'hi-en'`)
   - No WhatsApp Reply in 30min → Notify Manager
   - Lead in New Stage for 48h → Escalate

---

### TC-AUTO-02: Automation Builder (admin+, desktop only)

1. Log in as `admin` on a desktop viewport (>= md breakpoint).
2. Click "New Automation" or edit an existing one.
3. Visual builder renders: trigger selector, condition steps, action steps.
4. Builder should be disabled/gated for mobile viewport < md.

---

### TC-AUTO-03: Automation Logs

**URL:** `/automations/[id]/logs`

1. Open a recently fired automation.
2. Logs list shows: timestamp, trigger context, step results, success/failure.

---

### TC-AUTO-04: Escalation Recipe — SLA Breach

1. Enable "No WhatsApp Reply in 30min → Notify Manager" recipe.
2. Simulate an unanswered inbound message (or use a test conversation where `first_unanswered_at` is 31+ minutes ago).
3. Verify admin receives a notification: "⚠️ SLA breach: [Contact Name] has been waiting 31 min. Assigned to: [Agent Name]."

---

## 10. Flows (Conversation Bots)

**URL:** `/flows`

### TC-FLOW-01: Flows List

1. Flows list shows all flows with status toggle (Active / Disabled).
2. **"Real Estate Qualifier (Auto)"** flow is visible (seeded on signup).
3. Status is "Disabled" by default.

---

### TC-FLOW-02: Enable RE Qualifier Flow

1. Enable "Real Estate Qualifier (Auto)" toggle.
2. Create a new WhatsApp contact (simulate an inbound message from a new number).
3. Bot should automatically send: "Namaste [Name] ji! 🙏 Thank you for your interest..."
4. Reply with a budget ("₹45L") → bot captures and saves to `lead_details.budget_max`.
5. Bot sends BHK question with button options (1BHK / 2BHK / 3BHK / 4BHK+).
6. Reply with "2BHK" → saved to `lead_details.configuration_preference`.
7. Bot asks for location → reply "Noida" → saved to `lead_details.location_preference`.
8. After step 7, conversation is **auto-assigned** to the least-loaded available agent via round-robin.

---

### TC-FLOW-03: Flow Builder Canvas (Desktop, admin+)

1. Open a flow for editing.
2. React Flow canvas renders with draggable nodes.
3. Add a new "Send Message" node; connect it to an existing node.
4. Save → verify flow structure persisted.

---

## 11. Broadcasts

**URL:** `/broadcasts`

### TC-BROAD-01: Admin Gate (J3)

1. Log in as `agent1`.
2. On `/broadcasts`, the "+ New Broadcast" button should be **hidden** for agents.
3. **API test:** `POST /api/broadcasts/` as `agent1` → should return `403`.
4. Log in as `admin` → button is visible; can create broadcasts.

---

### TC-BROAD-02: Create Broadcast — All Contacts

1. Log in as `admin`.
2. Click "+ New Broadcast".
3. Step 1: select a pre-seeded template (e.g., "Diwali Offer 🪔" from RE templates).
4. Step 2: audience type "All" → all contacts are selected.
5. Step 3: review & schedule (send now or schedule).
6. Submit → broadcast created; verify entry in Supabase `broadcasts` table.

---

### TC-BROAD-03: Broadcast — Lead Details Segment (J4)

1. Create a new broadcast.
2. Step 2: select audience type "Lead Details Segment".
3. Add filter condition: `configuration_preference contains 2BHK`.
4. Add second condition: `budget_min >= 5000000`.
5. Recipient count updates to show matching contacts.
6. Submit broadcast → verify only matching contacts are in `broadcast_recipients`.

---

### TC-BROAD-04: Real Estate Broadcast Templates (J5)

1. In broadcast Step 1 (Choose Template), filter by tag "Real Estate".
2. Three templates should appear:
   - Diwali Offer 🪔
   - New Project Launch 🏠
   - Price Drop Alert 📉
3. Select "Price Drop Alert" → preview shows template body with `{{placeholder}}` variables.

---

### TC-BROAD-05: Agent Views Broadcast Results

1. Log in as `agent1`.
2. Visit `/broadcasts` → can view broadcast list and delivery statistics.
3. Cannot create a new broadcast (button hidden).

---

## 12. Integrations Page

**URL:** `/integrations` | Login as: `admin`

### TC-INTEG-01: Page Renders

1. Integrations page loads with:
   - **Universal Capture Email card** with copy button.
   - **Portal tiles grid**: 99acres, MagicBricks, Housing.com, Gmail, WhatsApp Business, Instagram, NoBroker, JustDial.

---

### TC-INTEG-02: Capture Email Copy

1. Click the "Copy" button next to the capture email.
2. Verify it copies to clipboard (paste somewhere to confirm).
3. Email format: `leads+<account_id_first_8_chars>@<INBOUND_EMAIL_DOMAIN>`.

---

### TC-INTEG-03: Portal Tiles Status

1. "WhatsApp Business" tile reflects live `whatsapp_config` state:
   - If WhatsApp is connected → shows "✓ Connected" green badge.
   - If not → shows "Not Connected" grey badge.
2. "Instagram" tile shows "Coming Soon" purple badge; CTA button is disabled.
3. "JustDial" tile shows "Coming Soon" purple badge.
4. Other tiles show "Not Connected" with "+ Connect →" button.

---

### TC-INTEG-04: Connect a Portal

1. Click "+ Connect →" on "99acres".
2. Bottom sheet (mobile) / dialog (desktop) opens.
3. Shows 3 steps: (1) copy capture email, (2) portal setup instructions, (3) "Mark as Connected" button.
4. Click "Mark as Connected" → tile updates to "✓ Connected" without page reload.
5. Verify `portal_connections['99acres'].connected = true` in Supabase `accounts` table.

---

### TC-INTEG-05: Test Lead Received Indicator

1. Manually set `portal_connections['99acres'].test_lead_received = true` in Supabase.
2. Reload Integrations page → 99acres tile should show "✓ Test lead received" label in green.

---

### TC-INTEG-06: Access Control

1. Log in as `agent` → navigate to `/integrations` → should see "Contact your admin" page, not the full integrations page.

---

## 13. Tasks & Follow-ups

**URL:** Dashboard widget + `/contacts/[id]` Tasks tab

### TC-TASK-01: Create a Task from Lead Detail

1. Open a lead detail → go to "Tasks" tab.
2. Inline form: type "Send cost sheet to Rahul" → set due date to today → click "Add".
3. Task appears immediately (optimistic update) with checkbox and due time.
4. Navigate to Dashboard → "Today's Tasks" widget shows the new task.

---

### TC-TASK-02: Check Off a Task

1. In the Today's Tasks widget, click the checkbox on a task.
2. Task row disappears immediately (optimistic removal).
3. Reload page → task is gone from widget (confirmed done).
4. Verify in Supabase `tasks` table: `done = true`, `done_at` is populated.

---

### TC-TASK-03: Overdue Tasks in Follow-ups Stat

1. In Supabase, set a task's `due_at` to 2 days ago with `done = false`.
2. Reload Dashboard → "Follow-ups Due" stat card shows overdue count in amber/red sub-label.

---

### TC-TASK-04: Tasks API

Using Postman or cURL with a valid session cookie:

```bash
# GET tasks due today
GET /api/tasks?due_today=true

# POST create task
POST /api/tasks
Body: { "title": "Call lead", "contact_id": "<uuid>", "due_at": "<ISO date>" }

# PATCH complete task
PATCH /api/tasks/<id>
Body: { "done": true }

# DELETE task
DELETE /api/tasks/<id>
```

- `GET` returns only tasks for the authenticated user's account.
- `POST` as `viewer` → should fail with 403.
- `DELETE` as `viewer` → should fail with 403.

---

## 14. Cost Sheet

**URL:** Settings → Cost Sheet + Lead Detail + Dashboard Quick Action

### TC-COST-01: Configure Template in Settings

1. Go to Settings → "Cost Sheet" tab.
2. Default template textarea pre-populated with:
   ```
   🏠 *Property Details*
   Title: {{property_title}}
   ...
   ```
3. Modify the template text.
4. Click "Preview" → preview panel renders with sample values substituted (e.g., "Prestige Elm Park").
5. Click "Save Template" → success toast; verify `quick_replies` table has a new `kind='cost_sheet'` row; `accounts.cost_sheet_template_id` is updated.

---

### TC-COST-02: Send Cost Sheet from Lead Detail

1. Open a lead detail → click "Cost Sheet" in the action bar.
2. Bottom sheet opens: property dropdown (filtered by lead's location/budget/BHK).
3. Select a property → preview fills with real data (property title, price in ₹ INR, RERA ID, BHK).
4. Click "Send via WhatsApp" → success toast "Cost Sheet sent! ✓".
5. In the lead's inbox conversation → verify the WhatsApp message was sent with correct content.

---

### TC-COST-03: Dashboard Quick Action — No Template Configured

1. Ensure `cost_sheet_template_id` is NULL for the account.
2. Dashboard "Cost Sheet" button should be **disabled**.
3. Hover → tooltip: "Set up your Cost Sheet in Settings → Cost Sheet".

---

### TC-COST-04: Dashboard Quick Action — With Template

1. After configuring the template (TC-COST-01).
2. Click "Cost Sheet" from Dashboard quick actions.
3. Contact picker opens → search and select a lead.
4. Cost sheet modal opens with that lead pre-selected.
5. Flow continues as TC-COST-02 steps 3–5.

---

## 15. Team / Manager Dashboard

**URL:** `/team` | Login as: `admin` or `owner`

### TC-TEAM-01: Access Control

1. Log in as `agent1` → navigate to `/team` → should redirect (403 or "Contact your admin").
2. Log in as `admin` → full dashboard visible.

---

### TC-TEAM-02: Unassigned Lead Pool

1. Top of page: "X unassigned leads" count badge.
2. Scrollable list of up to 10 unassigned leads: name, source badge, "X hours ago", "Assign" button.
3. Click "Assign" → agent picker sheet opens; shows agents with their current open-lead count badge.
4. Assign a lead → lead disappears from unassigned pool.
5. "View All →" link → navigates to leads list filtered `unassigned=true`.

---

### TC-TEAM-03: Agent Cards

Each agent card should show:

1. Name, avatar.
2. **Availability indicator:** green dot (available) / grey dot + "On Leave" text.
3. **Load bar:** "12 open leads" as a mini progress bar (green < 10, amber 10–18, red > 18).
4. **Target progress:** "Visits: 14 / 20 this month".
5. **Stale lead warning:** if stale leads > 0 → amber "⚠️ 3 stale" badge.
6. Click stale badge → filtered leads list for that agent.
7. Click agent name/avatar → leads list filtered by that agent.

---

### TC-TEAM-04: Availability Toggle (Admin)

1. On an agent card, click the availability dot.
2. Agent becomes unavailable ("On Leave" state).
3. Verify `profiles.is_available = false` in Supabase.
4. New lead comes in → round-robin skips this agent.

---

### TC-TEAM-05: Monthly Targets

1. Click the target number on an agent card → inline number input appears.
2. Set target visits to "25" → press Enter/Save.
3. Card updates to "Visits: 14 / 25 this month".
4. Verify `agent_targets` table has the record for this agent + current month.

---

### TC-TEAM-06: Pipeline Funnel Chart

1. Below agent cards: a bar chart showing leads per stage across all agents.
2. X-axis: stage names; Y-axis: lead count.
3. Hovering a bar shows stage name + count tooltip.

---

### TC-TEAM-07: Per-Agent Performance Stats

1. Each agent card shows: avg response time (min), leads worked, visits completed, no-show rate, conversion rate.
2. Stats are accurate against the seeded test data.

---

### TC-TEAM-08: Print Report

1. URL: `/team?print=true`.
2. Page renders in a simplified, print-optimized layout (no nav, compact tables).
3. "Print Report" button (printer icon) in the header → triggers browser print dialog.

---

## 16. Settings

**URL:** `/settings`

### TC-SET-01: Settings Tabs

The settings page should have tabs for:

- **General** (Account name, currency, language, brokerage %)
- **WhatsApp** (phone number, WABA config)
- **AI** (OpenAI/Anthropic key, model, knowledge base)
- **Team** (Members list, invite, routing rules, agent availability)
- **Cost Sheet** (template editor)
- **Billing** (plan, status, seat usage)
- **API Keys** (create, revoke scoped API keys)
- **Webhook Endpoints** (outbound webhooks)

---

### TC-SET-02: General Settings

1. Change account display name → save → name updates in sidebar.
2. Set `preferred_language` to "Hinglish (hi-en)" → save → verify `accounts.preferred_language = 'hi-en'`.
3. Set brokerage % to "2.5" → save → verify brokerage badge on pipeline cards updates to reflect 2.5%.

---

### TC-SET-03: WhatsApp Configuration

1. WhatsApp Config tab shows current connection state.
2. If not connected: form fields for WABA phone number, token.
3. "Save Configuration" → real-time feedback on success/failure.
4. If connected: shows phone number + "Connected" status.

---

### TC-SET-04: AI Configuration

1. Add an OpenAI API key (test with an invalid key) → expect a validation error on save.
2. Add a valid key → "AI Draft" in inbox should now work.
3. Knowledge Base tab: upload a PDF/text document → verify it's chunked and stored.

---

### TC-SET-05: Team → Lead Routing Rules

1. Settings → Team → "Lead Routing" tab.
2. "+ Add Rule" → form: condition (source = 99acres), action (assign to Agent: Rahul).
3. Rule saved → appears in the drag-reorderable list.
4. Reorder rules by dragging → order persists after reload.
5. Toggle rule inactive → round-robin falls through even when condition matches.
6. Verify routing logic: a new lead from source "99acres" → assigned to the agent specified in the rule (not round-robin).

---

### TC-SET-06: API Keys

1. Create a new API key with scope "contacts:read".
2. Key is shown once → copy it.
3. Use the key to call `GET /api/v1/contacts` → 200 response.
4. Try `POST /api/v1/contacts` with the "contacts:read" key → 403.
5. Revoke the key → subsequent `GET /api/v1/contacts` → 401.

---

### TC-SET-07: Access Control for Settings

1. Log in as `agent1` → go to `/settings` → should see "Contact your admin" or a locked page (only profile + notifications tabs visible).
2. Admin+ should see all tabs.

---

## 17. Billing & Plan Gating

**URL:** `/billing` + Settings → Billing | Login as: `owner`

### TC-BILL-01: Billing Tab in Settings

1. Settings → Billing tab shows:
   - Plan name badge (starter/growth/pro).
   - Status pill (trialing/active/past_due/canceled).
   - Renewal date ("Renews in 14 days").
   - Seat usage ("2 of 3 seats used").
   - "Manage Plan" button → triggers Stripe Billing Portal redirect.
   - "Upgrade" button (only for starter plan).
2. Log in as `agent` → Billing tab should NOT be visible.

---

### TC-BILL-02: Stripe Checkout Flow

1. Click "Upgrade" → POST to `/api/billing/checkout` → redirected to Stripe Checkout page.
2. Complete payment with Stripe test card `4242 4242 4242 4242`.
3. Stripe webhook fires `checkout.session.completed`.
4. Verify in Supabase `accounts`: `subscription_status = 'active'`, `stripe_customer_id` and `stripe_subscription_id` are populated.

---

### TC-BILL-03: Payment Failed Gate

1. Manually set `subscription_status = 'past_due'` in Supabase for the test account.
2. Reload any dashboard page → should redirect to `/billing`.
3. `/billing` page shows "Reactivate Plan" CTA → clicking it opens Stripe Billing Portal.
4. The `/api/billing/webhook` route itself must NOT be blocked by this middleware gate.

---

### TC-BILL-04: Canceled Account Gate

1. Set `subscription_status = 'canceled'` → same gate as TC-BILL-03.
2. `/billing` shows "Start Free Trial" or "Reactivate Plan" depending on prior subscription history.

---

### TC-BILL-05: Stripe Webhook Security

1. POST a raw payload to `/api/billing/webhook` without a valid `Stripe-Signature` header → should return 400.
2. A valid HMAC-signed payload → processes and returns 200.

> [!CAUTION]
> Never test billing webhooks against a production Stripe account. Use test mode keys.

---

## 18. Reporting & Exports

### TC-REPORT-01: CSV Export

1. Log in as `admin`.
2. On the Leads list page, click "Export CSV" button.
3. CSV file downloads with columns: Lead Name, Mobile, Source, Stage, Assigned Agent, Budget (INR), Location, BHK Config, RERA Property, Visits Completed, Last Activity, Created At.
4. Open CSV in Excel/Sheets → verify budgets are in INR format and phones are normalized.
5. **Date range filter:** Export with `from=2026-01-01&to=2026-06-30` → only leads in that range.
6. Log in as `agent` → "Export CSV" button should NOT be visible.

---

### TC-REPORT-02: Weekly Report Cron

**Endpoint:** `GET /api/cron/weekly-report`

```bash
curl -H "x-cron-secret: <CRON_SECRET>" http://localhost:3000/api/cron/weekly-report
```

1. Returns JSON with: `{ new_leads: N, visits_scheduled: N, visits_completed: N, no_show_rate: %, deals_closed: N, deals_value_inr: "₹XCr", top_agent: "...", stale_leads: N }`.
2. Without `CRON_SECRET` header → 401.
3. If email is configured, verify an email is sent to `owner@retest.com`.

---

### TC-REPORT-03: Stale Leads Cron

**Endpoint:** `GET /api/cron/stale-leads`

```bash
curl -H "x-cron-secret: <CRON_SECRET>" http://localhost:3000/api/cron/stale-leads
```

1. Returns `{ processed: N, stale: N }`.
2. For each stale lead (stage New/Contacted, no activity for 48h), a task is created with title "Follow up: [Name] — no activity for 2+ days".
3. Stale leads appear in the assigned agent's "Today's Tasks" widget.
4. Without `CRON_SECRET` → 401.

---

## 19. Public REST API (v1)

**Base URL:** `http://localhost:3000/api/v1`
**Auth:** `Authorization: Bearer <api_key>` (create API key in Settings → API Keys)

### TC-API-01: Contacts API

```bash
# List contacts
GET /api/v1/contacts
# Create contact
POST /api/v1/contacts
Body: { "name": "Test Lead", "phone": "+919876543210" }
# Get contact
GET /api/v1/contacts/<id>
# Update contact
PATCH /api/v1/contacts/<id>
# Delete contact
DELETE /api/v1/contacts/<id>
```

- Pagination: `GET /api/v1/contacts?page=1&limit=20` → envelope includes `{ data: [...], total: N, page: 1, limit: 20 }`.
- Cross-tenant test: use an API key from Account A to try to fetch a contact from Account B → should return 404 or empty results.

---

### TC-API-02: Properties API

```bash
GET  /api/v1/properties
POST /api/v1/properties
GET  /api/v1/properties/<id>
PATCH /api/v1/properties/<id>
DELETE /api/v1/properties/<id>
```

- Verify `rera_id`, `configuration`, `builder_name` fields are present in response.

---

### TC-API-03: Site Visits API

```bash
GET  /api/v1/site-visits
POST /api/v1/site-visits
GET  /api/v1/site-visits/<id>
PATCH /api/v1/site-visits/<id>
```

- `POST` with `contact_id`, `property_id`, `scheduled_at`, `pickup_required`, `pickup_location`.

---

### TC-API-04: Conversations & Messages API

```bash
GET /api/v1/conversations
GET /api/v1/conversations/<id>
GET /api/v1/messages?conversation_id=<id>
```

---

### TC-API-05: Scope Enforcement

1. Create an API key with scope `contacts:read`.
2. `GET /api/v1/contacts` → 200.
3. `POST /api/v1/contacts` → 403.
4. `GET /api/v1/properties` → 403 (wrong scope).

---

### TC-API-06: Webhook Endpoints API

```bash
GET  /api/v1/webhooks
POST /api/v1/webhooks
Body: { "url": "https://example.com/hook", "events": ["contact.created", "deal.updated"] }
DELETE /api/v1/webhooks/<id>
```

- Verify HMAC `X-WaCRM-Signature` header is included in outbound webhook calls.

---

## 20. PWA & Mobile Shell

> Test on a real Android (Chrome) or iOS (Safari) device, or use DevTools → Device toolbar at 390px.

### TC-PWA-01: Mobile Shell

1. At < md viewport: **Bottom navigation** visible with 5 tabs: Dashboard, Leads, Pipeline, Visits, Inbox.
2. At ≥ md viewport: **Desktop sidebar** visible (no bottom nav).
3. Bottom nav "More" tab → "More sheet" opens with: Automations, Flows, Broadcasts, Team, Settings, Integrations.

---

### TC-PWA-02: App Install

1. Open app on Chrome Android.
2. Browser prompts "Add to Home Screen" (PWA install prompt).
3. Accept → app icon appears on home screen.
4. Launch from home screen → app opens in standalone mode (no browser chrome).
5. On iOS Safari: Share → Add to Home Screen → same result.

---

### TC-PWA-03: Offline Fallback

1. Open the app, then go offline (DevTools → Network → Offline).
2. Reload → offline fallback page renders (not a browser error page).
3. Go back online → app recovers.

---

### TC-PWA-04: Web Push Notifications

1. Accept push notification permission when prompted.
2. A new lead arrives → push notification appears on device: "New Lead: [Name]".
3. A site visit reminder fires → push notification: "Visit in 2 hours: [Property Name]".
4. Tap notification → opens the correct lead/visit in the app.

---

### TC-PWA-05: Pull-to-Refresh

1. On leads list, pull down from the top → loading indicator appears.
2. Release → list refreshes with latest data.

---

### TC-PWA-06: Touch Targets

> Minimum 44×44px for all interactive elements.

1. Using a physical device, try tapping all buttons, chips, and toggle switches.
2. All should be comfortably tappable without zooming.

---

## 21. Role-Based Access Control (RBAC)

Summary matrix for quick reference — verify each cell:

| Feature                  | owner | admin | agent         | viewer |
| ------------------------ | ----- | ----- | ------------- | ------ |
| View all leads           | ✅    | ✅    | ❌ (own only) | ✅     |
| Create/edit leads        | ✅    | ✅    | ✅            | ❌     |
| Move deals (own)         | ✅    | ✅    | ✅            | ❌     |
| Move deals (others')     | ✅    | ✅    | ❌ (403)      | ❌     |
| Create broadcasts        | ✅    | ✅    | ❌            | ❌     |
| View broadcasts          | ✅    | ✅    | ✅            | ✅     |
| Invite members           | ✅    | ✅    | ❌            | ❌     |
| Access Team Dashboard    | ✅    | ✅    | ❌            | ❌     |
| Access Integrations page | ✅    | ✅    | ❌            | ❌     |
| Bulk reassign leads      | ✅    | ✅    | ❌            | ❌     |
| Configure routing rules  | ✅    | ✅    | ❌            | ❌     |
| View billing             | ✅    | ❌    | ❌            | ❌     |
| Export CSV               | ✅    | ✅    | ❌            | ❌     |
| Create/revoke API keys   | ✅    | ✅    | ❌            | ❌     |

> [!WARNING]
> All role checks must be enforced **server-side** (in route handlers/server components). UI-only hiding is not sufficient — verify with direct API calls for each role.

---

## 22. India Localization

### TC-L10N-01: INR Currency Formatting

1. All price/budget fields in the app display in L/Cr scale:
   - 4,500,000 → "₹45L"
   - 10,000,000 → "₹1Cr"
   - 15,000,000 → "₹1.5Cr"
   - 75,000 → "₹75,000"
2. Budget range: "₹45L–60L", "₹1.5Cr–2Cr", "₹45L+" (no max).

---

### TC-L10N-02: Hinglish Automation Templates

1. Set `accounts.preferred_language = 'hi-en'` for the test account.
2. Trigger a T-24h site visit automation.
3. WhatsApp message sent should be the Hinglish variant:
   > "Namaste [Name] ji! 🙏 Kal [time] baje aapka site visit confirm hai..."
4. Set back to `'en'` → English template fires.

---

### TC-L10N-03: Indian Phone Normalization

1. Import a contact with mobile "09876543210" → stored as "+919876543210".
2. Import with "+91 98765 43210" → stored as "+919876543210".
3. Duplicate detection works by `phone_normalized` — the same number in different formats is treated as one contact.

---

### TC-L10N-04: Indian Budget Parsing (CSV Import)

| Input     | Expected `budget_min` |
| --------- | --------------------- |
| "45L"     | 4,500,000             |
| "1.5Cr"   | 15,000,000            |
| "80 Lakh" | 8,000,000             |
| "1 Crore" | 10,000,000            |
| "75000"   | 75,000                |

---

### TC-L10N-05: BHK Configuration Field

1. In property form and lead form, BHK config is a **chip selector**, not a free-text field.
2. Options: 1BHK, 2BHK, 3BHK, 4BHK, Studio, Villa, Plot, Commercial.
3. Multi-select works on both lead `configuration_preference` and property `configuration`.

---

## 23. Known Issues & Error Log

> As a new developer, document any test failures here during your onboarding test pass.

| #   | Test Case     | Observed Behavior                                                                        | Expected Behavior                                                                       | Status  |
| --- | ------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------- |
| 1   | `npm run dev` | `INVALID_KEY` error for `Housing.com` in `messages/en.json` under `Integrations.portals` | Key names in next-intl cannot contain `.` — rename key to `HousingCom` or `Housing_com` | 🔴 Open |
| 2   |               |                                                                                          |                                                                                         |         |
| 3   |               |                                                                                          |                                                                                         |         |

> [!NOTE]
> **Known bug to fix first:** The `npm run dev` error `INVALID_KEY: Namespace keys cannot contain the character "."` is caused by the i18n key `Housing.com` in `messages/en.json`. Rename to `HousingCom` (and update all references in components) before testing the Integrations page.

---

## Appendix A: Test Environment Quick Reference

```bash
# Start dev server
npm run dev

# Run type checks
npm run typecheck

# Run tests
npm run test

# Check formatting
npm run format:check

# Lint
npm run lint
```

---

## Appendix B: Supabase Quick Queries for Test Setup

```sql
-- Check a user's role
SELECT u.email, p.account_role
FROM profiles p
JOIN auth.users u ON u.id = p.user_id;

-- Set account to past_due (test billing gate)
UPDATE accounts SET subscription_status = 'past_due' WHERE id = '<account_id>';

-- Set preferred language to Hinglish
UPDATE accounts SET preferred_language = 'hi-en' WHERE id = '<account_id>';

-- Check portal connections
SELECT id, name, portal_connections FROM accounts;

-- View stale leads (no activity 48h+)
SELECT c.id, c.name, d.updated_at
FROM contacts c
JOIN deals d ON d.contact_id = c.id
WHERE d.updated_at < now() - INTERVAL '48 hours'
AND d.status = 'open';

-- Check tasks due today
SELECT t.title, t.due_at, t.done, p.user_id
FROM tasks t
JOIN profiles p ON p.user_id = t.assigned_to
WHERE t.due_at::date = now()::date AND t.done = false;
```

---

## Appendix C: API Testing with cURL

```bash
# Set your API key
export API_KEY="wak_your_key_here"
export BASE="http://localhost:3000"

# List leads
curl -H "Authorization: Bearer $API_KEY" "$BASE/api/v1/contacts"

# Create a property
curl -X POST "$BASE/api/v1/properties" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Prestige Elm Park","location":"Noida","price":7500000,"configuration":"3BHK","rera_id":"UP/2024/12345"}'

# Schedule a site visit
curl -X POST "$BASE/api/v1/site-visits" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contact_id":"<uuid>","scheduled_at":"2026-10-05T10:00:00Z","pickup_required":true,"pickup_location":"Sector 18 Metro Station"}'

# Test stale leads cron
curl -H "x-cron-secret: $CRON_SECRET" "$BASE/api/cron/stale-leads"
```
