# WACRM Real Estate — Comprehensive Manual Testing Plan

> **Audience:** QA Engineer, Developer onboarding, or AI Agent verifying the app.
> **Purpose:** End-to-end manual test cases covering every implemented UI feature, real estate workflow, API endpoint, RBAC gate, mobile adaptation, and cross-cutting concern in the WACRM Real Estate CRM fork.
> **Base Repo:** [ArnasDon/wacrm](https://github.com/ArnasDon/wacrm) — this fork is a vertical B2B SaaS for Indian real estate teams.
> **App URL (local):** `http://localhost:3000`
> **Last Updated:** 2026-10-19

---

## Table of Contents

1. [Pre-Testing Setup](#1-pre-testing-setup)
2. [Auth & Onboarding Flows](#2-auth--onboarding-flows)
3. [Dashboard](#3-dashboard)
4. [Contacts (Leads)](#4-contacts-leads)
5. [Pipeline & Deals (Kanban)](#5-pipeline--deals-kanban)
6. [Site Visits & Field Logistics](#6-site-visits--field-logistics)
7. [Inbox (WhatsApp)](#7-inbox-whatsapp)
8. [Properties & RERA Compliance](#8-properties--rera-compliance)
9. [Automations](#9-automations)
10. [Flows (Conversation Bots)](#10-flows-conversation-bots)
11. [Broadcasts](#11-broadcasts)
12. [Integrations](#12-integrations)
13. [Tasks & Follow-ups](#13-tasks--follow-ups)
14. [Cost Sheet](#14-cost-sheet)
15. [Team Command Center](#15-team-command-center)
16. [AI Co-Pilot & Knowledge Base](#16-ai-co-pilot--knowledge-base)
17. [Notifications](#17-notifications)
18. [Settings](#18-settings)
19. [Billing & Plan Gating](#19-billing--plan-gating)
20. [Reporting & Exports](#20-reporting--exports)
21. [Public REST API (v1)](#21-public-rest-api-v1)
22. [MCP Server (wacrm-mcp)](#22-mcp-server-wacrm-mcp)
23. [PWA & Mobile Shell](#23-pwa--mobile-shell)
24. [Role-Based Access Control (RBAC)](#24-role-based-access-control-rbac)
25. [India Localization & Currency](#25-india-localization--currency)
26. [Internationalization (i18n)](#26-internationalization-i18n)
27. [Real-Time & Presence](#27-real-time--presence)
28. [WhatsApp Webhook & Messaging Pipeline](#28-whatsapp-webhook--messaging-pipeline)
29. [Lead Routing & Distribution Engine](#29-lead-routing--distribution-engine)
30. [Cross-Module Wiring & Navigation](#30-cross-module-wiring--navigation)
31. [Dark Mode & Theming](#31-dark-mode--theming)
32. [Automated Test Suite Verification](#32-automated-test-suite-verification)
33. [Known Issues & Error Log](#33-known-issues--error-log)

---

## 1. Pre-Testing Setup

### 1.1 Environment

| Item            | Value                                  |
| --------------- | -------------------------------------- |
| Node version    | ≥ 20.0.0                               |
| Package manager | npm (10.9.9)                           |
| Local app URL   | `http://localhost:3000`                |
| Dev command     | `npm run dev`                          |
| Framework       | Next.js 16.3.5 (App Router, Turbopack) |
| React           | 19.2.4                                 |

### 1.2 Environment Variables

Before starting `npm run dev`, confirm `.env.local` has all required keys:

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

Create the following test users via the signup flow at `/signup` or directly via Supabase dashboard:

| Role     | Email               | Purpose                              |
| -------- | ------------------- | ------------------------------------ |
| `owner`  | `owner@retest.com`  | Business owner, full access          |
| `admin`  | `admin@retest.com`  | Manager with team oversight          |
| `agent`  | `agent1@retest.com` | Sales agent, scoped access           |
| `agent`  | `agent2@retest.com` | Second agent (for round-robin tests) |
| `viewer` | `viewer@retest.com` | Read-only observer                   |

### 1.4 Seed Test Data

Using the Supabase dashboard or seed scripts, ensure:

- At least **10 contacts** with varied sources (99acres, MagicBricks, Housing.com, Manual, Meta Ads)
- Corresponding `lead_details` rows with varied `budget_min`, `budget_max`, `configuration_preference`, `location_preference`, `source`
- At least **5 deals** across different pipeline stages (New, Contacted, Site Visit, Negotiation, Booking/Token Paid)
- At least **3 properties** with BHK configs, RERA IDs, prices, carpet areas, facing directions
- At least **3 site visits** (one pending, one confirmed, one completed)
- At least **2 tasks** (one overdue, one due today)
- At least **1 automation** (T-24h site visit reminder)
- At least **1 flow** (Real Estate Qualifier — auto-seeded on signup)
- At least **2 conversations** with messages in the inbox
- At least **1 API key** created via Settings

### 1.5 Verification Commands

```bash
npm run dev            # Start the dev server
npm run typecheck      # tsc --noEmit (0 errors required)
npm run lint           # ESLint (0 errors required)
npm run format:check   # Prettier check (must pass)
npm run test           # vitest run (96+ suites, 1076+ tests must pass)
```

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
7. Verify middleware session refresh works: leave idle for 15+ minutes, then navigate — should NOT get wedged (bug #288 fix via `withRefreshedCookies`).

**Expected:** ✅ Login works; invalid creds show error; valid creds redirect to dashboard.

---

### TC-AUTH-02: Signup & Onboarding Wizard

**URL:** `/signup`

1. Open `/signup`. Fill in name, email (`newowner@retest.com`), password.
2. Submit → verify email confirmation message (or immediate redirect if email confirm is disabled).
3. After confirmation, log in → check the following seeded resources exist for the new account:
   - Default pipeline with Real Estate stages (New → Contacted → Site Visit → Negotiation → Booking/Token Paid)
   - Default lost_reasons (8 real estate defaults)
   - Real Estate Qualifier flow in `/flows`
   - Real estate preset tags, custom fields, and quick replies (seeded by `seed_re_presets_for_account`)
4. Verify the **WhatsApp Setup Checklist** (`whatsapp-setup-checklist.tsx`) appears if WhatsApp is not connected.
5. Verify the **Team Setup Checklist** (`team-setup-checklist.tsx`) appears for the owner.

**Expected:** ✅ All RE presets seeded; checklists visible for new account.

---

### TC-AUTH-03: Invite & Join Flow

**URL:** `/settings?tab=members` → Invite

1. Log in as `owner`.
2. Go to Settings → Team Members → click "Invite Member" (`invite-member-dialog.tsx`).
3. Enter `agent1@retest.com`, assign role `agent`, send invite.
4. Open the invite link (check Supabase `account_invitations` table for the token).
5. Visit `/join/[token]` → accept invite → verify user lands on dashboard with agent-scoped nav.
6. **Seat limit test:** Downgrade seat limit to 1 in DB (`UPDATE accounts SET seat_limit = 1`). Try inviting another member → verify `SEAT_LIMIT_REACHED` error and "Upgrade Plan" CTA in the invite dialog.
7. **Expired invite test:** Set invitation `expires_at` to a past date → visit the link → verify graceful error.

**Expected:** ✅ Invite works; seat limit enforced; expired invite handled.

---

### TC-AUTH-04: Password Reset

**URL:** `/forgot-password`

1. Navigate to `/forgot-password`.
2. Enter a valid email → verify success message ("Check your email").
3. Enter an invalid/non-existent email → verify graceful handling (no crash, no user enumeration).

---

### TC-AUTH-05: Middleware Session Handling

1. Log in and navigate to a dashboard page.
2. Open DevTools → Application → Clear cookies manually.
3. Navigate to another page → should redirect to `/login` (not crash or show a blank page).
4. After re-login, verify redirect back to the original page (not always `/dashboard`).

---

## 3. Dashboard

**URL:** `/dashboard` | Login as: `owner`

### TC-DASH-01: Metric Cards

1. Confirm 4 stat cards render: **Total Conversations**, **New Leads**, **Follow-ups Due** (with overdue sub-count), **Pipeline Value**.
2. "Follow-ups Due" card should show count + an **overdue sub-label** in amber/red (from overdue tasks + unanswered conversations).
3. "Pipeline Value" must display in **₹ INR format** (e.g., "₹1.5Cr" not "$1.5M") — powered by `formatINR()` / `formatCurrency()`.
4. Verify metrics load via `loadMetrics()` from `lib/dashboard/queries.ts`.
5. **Hot leads badge:** If contacts are tagged `hot-lead`, the hot leads count should appear.

**Expected:** ✅ All cards populate with real data; INR formatting correct.

---

### TC-DASH-02: Conversations Chart

1. Verify the `ConversationsChart` component renders a time-series chart.
2. Toggle date range: 7 / 30 / 90 days → chart data updates.
3. Verify `loadConversationsSeries()` is called for the selected range.

---

### TC-DASH-03: Pipeline Donut

1. Verify the `PipelineDonut` component renders a donut/pie chart of deal distribution by stage.
2. Hover/tap a segment → tooltip shows stage name and deal count/value.
3. Data loads via `loadPipelineDonut()`.

---

### TC-DASH-04: Response Time Chart

1. Verify the `ResponseTimeChart` renders average response time metrics.
2. Data loads via `loadResponseTime()`.

---

### TC-DASH-05: Today's Visits Widget

1. Verify "Today's Visits" section shows site visits scheduled for today.
2. Each visit row should show: lead name, property name (if linked), time, status pill, pickup indicator.
3. 1-tap call button (📞 `tel:` link) and WhatsApp button visible per visit.

---

### TC-DASH-06: Today's Tasks Widget

1. Verify `TasksWidget` renders with tasks due today.
2. Each task row: checkbox, title, linked lead name (tappable), due time ("Due 2h ago" format).
3. **Quick-create:** Type a task title in the inline input → click "Add" → task appears in list without page reload.
4. **Check off task:** Click the checkbox → row disappears optimistically.
5. Reload page → confirmed the checked task is gone.

---

### TC-DASH-07: Quick Actions

1. `QuickActions` component renders with: **New Lead**, **Schedule Visit**, **Cost Sheet**, **Broadcast**.
2. "Cost Sheet" button should be **disabled with tooltip** when no `cost_sheet_template_id` is configured for the account.
3. Click "New Lead" → opens contact creation form/sheet.
4. Click "Schedule Visit" → opens `ScheduleVisitSheet`.
5. Click "Broadcast" → navigates to `/broadcasts/new` (admin+) OR shows permission denied for agents.

---

### TC-DASH-08: Recent Leads

1. Verify a "Recent Leads" section shows the latest leads with:
   - Name, source badge (`SourceBadge`), status badge, BHK config, budget (₹ INR), location.
2. Agent users see only their assigned leads (via `getAgentAssignedContactIds` / `buildAgentContactFilter`).
3. Admin/owner see all leads.

---

### TC-DASH-09: Activity Feed

1. Verify `ActivityFeed` renders recent events (new leads, messages, deals moved).
2. Data loads via `loadActivity()` — max 50 items.
3. Activities should be scoped: agents see only their activity; admins see team-wide.

---

### TC-DASH-10: Onboarding Checklists (Owner only)

1. Log in as a freshly created owner with no WhatsApp / agents / leads.
2. **WhatsApp Setup Checklist** (`whatsapp-setup-checklist.tsx`) should appear if WhatsApp not connected.
3. **Team Setup Checklist** (`team-setup-checklist.tsx`) should appear with steps like:
   - ✅ Account Created
   - ⬜ Connect WhatsApp
   - ⬜ Invite First Agent
   - ⬜ Import Leads
4. Dismiss checklist → reload → still hidden.
5. Log in as `agent1` → checklists should NOT appear.

---

## 4. Contacts (Leads)

**URL:** `/contacts` | Login as: `agent1` and separately as `admin`

### TC-LEAD-01: Leads List — Desktop Table

1. Leads list renders with columns: Name, Source Badge, Stage, Assigned Agent, Budget (₹ INR), Location, BHK Config, Last Activity.
2. **Source badges** render correctly: colored pills for 99acres / MagicBricks / Housing.com / Manual / Meta Ads / NoBroker.
3. **SLA badge** renders per lead: green (<15 min), amber (15–60 min), red (>60 min unanswered).
4. Sort by various columns (Name, Budget, Last Activity) → list re-sorts.
5. Verify the page file at `src/app/(dashboard)/contacts/page.tsx` (~77K) renders without errors.

---

### TC-LEAD-02: Multi-Dimensional Filters

1. Omni-search bar: search by name, phone, email → results filter in real-time.
2. Filter by source (99acres, MagicBricks, etc.).
3. Filter by stage (pipeline stages).
4. Filter by BHK configuration preference.
5. Filter by assigned agent (admin+ only).
6. Combine multiple filters → correct intersection.
7. **Active filter counter** visible showing number of active filters.
8. **"Clear all"** button → removes all filters; full list returns.

---

### TC-LEAD-03: Agent-Scoped View (Lead Isolation)

1. Log in as `agent1`.
2. Leads list should show **only leads assigned to agent1** — via `agent-scoping.ts` (`getAgentAssignedContactIds` / `buildAgentContactFilter`).
3. Log in as `admin` → all leads visible.
4. Log in as `viewer` → all leads visible (read-only).

> [!IMPORTANT]
> This is a critical B2B isolation test. If an agent sees other agents' leads, that's a security defect. Verify both the UI and the underlying Supabase query.

---

### TC-LEAD-04: Create a New Lead

1. Click "+ New Lead" → `ContactForm` (`contact-form.tsx`, ~48K) opens.
2. Fill in: Name, Mobile (+91 XXXXXXXXXX format), Source (select "99acres"), Budget Min/Max, Location, BHK Config (chip selector), Stage.
3. Submit → lead appears in list with correct source badge.
4. Open the lead detail → verify all fields saved, including `lead_details` (Budget, Location, BHK, Source).
5. **Phone normalization test:** Enter "09876543210" → stored as "+919876543210".

---

### TC-LEAD-05: Lead Detail View (`ContactDetailView`)

**URL:** Click a lead → opens inline or navigates to detail view

1. `ContactDetailView` (`contact-detail-view.tsx`, ~62K) renders with: name, phone, email, tags, source badge, SLA badge.
2. **Contact info section:** Budget in ₹ INR (`formatINR` / `formatINRRange`), Location preference, BHK Config, Assigned Agent, Deal Stage.
3. **Assignment history:** Shows audit trail from `assignment_history` table: from-agent, to-agent, actor, timestamp, reason (`claim`, `release_pool`, `manual_reassign`, `round_robin`, `routing_rule`).
4. **Tags:** View and manage tags (via `tag-write.ts`, `tag-events.ts`).
5. **Notes:** View and add contact notes (via `contact_notes` table).
6. **"Cost Sheet" button** → opens `CostSheetModal` with this lead pre-selected.
7. **WhatsApp quick action:** 1-click to open conversation in `/inbox`.
8. **Call quick action:** 1-tap `tel:` link for the phone number.

---

### TC-LEAD-06: Lead Claiming & Peer Protection

1. Create an unassigned lead (no `assigned_agent_id` on conversation).
2. Log in as `agent1` → in inbox, find the unassigned lead.
3. Click "Claim Lead" → atomic update runs (`canClaimLead` from `roles.ts`).
4. Verify the lead is now assigned to `agent1`.
5. Log in as `agent2` → the lead should show a **lock banner**: "This conversation is assigned to [Agent1 Name]. You have view-only access."
6. Agent2 cannot edit lead details or send messages for this lead.
7. **Race condition test:** Two agents click "Claim" simultaneously → only one succeeds; the other gets "Already claimed" feedback.

---

### TC-LEAD-07: Lead Release to Pool

1. Log in as `agent1` with a claimed lead.
2. Click "Release to Pool" → `canReleaseLead` check passes (agent can release own lead).
3. Lead returns to unassigned pool.
4. Verify `assignment_history` entry: `reason = 'release_pool'`.
5. Log in as `admin` → admin can release any lead regardless of assignment.

---

### TC-LEAD-08: Bulk Actions (Admin only)

1. Log in as `admin`.
2. In leads list, enable selection mode.
3. Select 3 leads.
4. Floating bottom bar appears with: "Reassign", "Tag", etc.
5. Click "Reassign" → `BulkReassignModal` (`bulk-reassign-modal.tsx`) opens → select `agent2` → confirm.
6. After confirming, leads show `agent2` as assigned.
7. Verify `assignment_history` entries for each reassigned lead.
8. Log in as `agent` → bulk action UI should NOT appear (`canReassignLead` returns false).

---

### TC-LEAD-09: CSV Import

**URL:** `/contacts/import` (via `ImportModal` — `import-modal.tsx`, ~26K)

1. Log in as `admin`, navigate to contacts import.
2. Upload a CSV with columns: Customer Name, Mobile, Source, Budget, Location, BHK.
3. Step 2 — Column mapping: verify auto-mapping detects columns correctly (`parse-contact-csv.ts`).
4. Preview shows sample rows correctly mapped.
5. Click "Import" → result shows `{ created: N, skipped: 0, errors: 0 }`.
6. Check leads list → imported leads appear with correct INR budget.
7. **Duplicate test:** Re-import the same CSV → all rows should be `skipped` (dedup via `dedupe.ts` on `phone_normalized`).
8. **Indian phone format test:** Import "09876543210" → stores as "+919876543210".
9. **Indian budget format test:** Import "45L" → stores as `4500000` (via `parse-budget.ts`).
10. **Tag resolution:** If CSV contains tags, verify `resolve-import-tags.ts` correctly creates/maps tags.
11. Log in as `agent` → import should be restricted.

---

### TC-LEAD-10: Custom Fields

1. Go to Settings → Fields & Tags (`fields-and-tags-panel.tsx` → `custom-fields-settings.tsx` / `custom-fields-manager.tsx`).
2. Create a new custom field (text, number, select) for contacts.
3. Open a lead detail → the custom field appears with the correct input type.
4. Set a value → save → reload → value persists (via `contact_custom_values` table).

---

### TC-LEAD-11: Tag Management

1. Settings → Fields & Tags → Tag Manager (`tag-manager.tsx`).
2. Create a new tag → verify it appears in tag pickers throughout the app.
3. Apply a tag to a lead → verify `contact_tags` join record is created.
4. Remove a tag → verify it's removed.
5. Verify `filter_contacts_by_tags` DB function works for tag-based filtering.

---

## 5. Pipeline & Deals (Kanban)

**URL:** `/pipelines` | Login as: `owner`, then as `agent1`

### TC-PIPE-01: Pipeline Board — Desktop (Kanban)

1. `PipelineBoard` (`pipeline-board.tsx`, ~35K) renders as a Kanban with columns: **New → Contacted → Site Visit → Negotiation → Booking/Token Paid**.
2. Deal cards (`deal-card.tsx`, ~10K) show: lead name, source badge, budget (₹ INR format), **brokerage badge** (`brokerage-badge.tsx`).
3. Drag a deal card from "New" to "Contacted" using `@dnd-kit` → deal updates immediately; no page reload.
4. Deal card shows the assigned agent's avatar.
5. Verify deal `last_activity_at` updates on move.

---

### TC-PIPE-02: Pipeline Mobile — Stage Tabs

> Test at ≤ 768px viewport.

1. Stages appear as horizontal swipeable tab pills at the top.
2. Deal cards stack vertically within the active stage.
3. Tap a deal card → shows deal detail sheet.
4. "Move to…" button → shows all stages; select one → deal moves.

---

### TC-PIPE-03: Deal Form

1. Click "+" or "New Deal" → `DealForm` (`deal-form.tsx`, ~29K) opens.
2. Fill in: Title, Contact (searchable picker), Stage, Value (₹), Expected Close Date, Notes.
3. Save → deal appears in the correct stage column.
4. Verify `assigned_to` is set correctly (from contact assignment or manual).

---

### TC-PIPE-04: Deal Table View

1. Toggle from Kanban to Table view.
2. `DealTable` (`deal-table.tsx`, ~16K) renders with: Title, Contact, Stage, Value (₹), Assigned To, Last Activity.
3. Sort by column headers.
4. Search/filter within the table.

---

### TC-PIPE-05: Deal Lifecycle — Won/Lost

1. Move a deal to "Won" status → `DealForm` records `status = 'won'`, `closed_at`, `won_value`.
2. Mark a deal as "Lost" → `LostReasonModal` (`lost-reason-modal.tsx`, ~7K) opens:
   - Select a loss reason from `lost_reasons` table (8 defaults seeded per account).
   - Add a loss note.
   - Verify `lost_from_stage_id`, `lost_reason_id`, `lost_note`, `closed_at` are all saved.
3. **Re-engagement:** Set `re_engage_on` date on a lost deal → verify it's stored.
4. **Reopen:** Reopen a lost/won deal → `reopened_count` increments; `status` changes back to `open`.

---

### TC-PIPE-06: Deal-Move Permission Guard (Anti-Poaching)

1. Log in as `agent1`.
2. Try to drag (or use "Move to…") a deal assigned to `agent2`.
3. **Expected:** Toast: "This lead belongs to [Agent2 Name]. Contact your admin to move it." — via `canMoveDeal()` from `roles.ts`.
4. **API test:** `PATCH /api/deals/[id]` where the deal belongs to `agent2` → should return 403.
5. Log in as `admin` → admin can freely move any deal (`hasMinRole(role, 'admin')` = true).

---

### TC-PIPE-07: Pipeline Settings

1. Settings → Deals & Currency (`deals-settings.tsx`, ~6K).
2. Edit pipeline stage names, colors, and order.
3. Manage `PipelineSettings` (`pipeline-settings.tsx`, ~15K): add/remove/reorder stages.
4. Changes reflected immediately in the Kanban board.

---

### TC-PIPE-08: Pipeline Analytics

1. `PipelineAnalytics` (`pipeline-analytics.tsx`, ~8K) renders a donut/funnel chart.
2. Chart shows deal count and value per stage.
3. "Won" and "Lost" deals tracked separately with their respective values.

---

## 6. Site Visits & Field Logistics

**URL:** `/site-visits` | Login as: `agent1`

### TC-VISIT-01: Site Visits Page — KPI Cards

1. Page renders with **situational awareness KPI stat cards**: Total Visits, Today's Attention, Upcoming, Completed & Show Rate.
2. All counts are accurate against the test data.

---

### TC-VISIT-02: Site Visits — Multi-Dimensional Filters

1. **Omni-search:** search by lead name, property name, or location.
2. **Status filter:** Pending / Confirmed / Completed / No-Show / Rescheduled.
3. **Timeframe filter:** Today / Tomorrow / This Week / This Month / Custom date range.
4. **BHK/Configuration filter** (if linked to property).
5. **Pickup Logistics filter:** Pickup Required / Not Required.
6. **Agent filter** (admin+): filter by assigned agent.
7. Active filter counter + "Clear all" button work correctly.

---

### TC-VISIT-03: Site Visits — Desktop Table View

1. High-density table with columns: Lead Name, Property, Date/Time, Status Pill, Pickup Required, Pickup Location, Agent, Actions.
2. Each row has: 1-tap call button, WhatsApp button, status change dropdown.

---

### TC-VISIT-04: Site Visits — Mobile Timeline Cards

> Test at < 768px viewport.

1. View toggles to Timeline Cards layout (Today / Upcoming / Past).
2. Rich stacked cards with 1-tap action buttons (Call, WhatsApp, Chat, Status).
3. Touch targets ≥ 44×44px.

---

### TC-VISIT-05: Schedule a Visit

1. Click "+ Schedule Visit" → `ScheduleVisitSheet` (`schedule-visit-sheet.tsx`, ~40K) opens.
2. Fill in: lead picker (searchable), optional property picker, date/time picker.
3. **Pickup toggle:** Toggle "Pickup Needed?" ON → text field for pickup address appears.
4. Submit → visit appears in the list with "Pending" status.
5. **Cross-module pre-fill:** When scheduling from a property page, `defaultPropertyId` is pre-filled. When scheduling from a lead, `defaultContactId` is pre-filled.

---

### TC-VISIT-06: Confirm / Reschedule / Complete / No-Show

1. Tap a visit with "Pending" status.
2. "Confirm" → status changes to "Confirmed" immediately.
3. "Reschedule" → date/time picker opens; submit new time → visit updates to "Rescheduled" status.
4. "Complete" → status changes to "Completed".
5. "No-Show" → status changes to "No-Show".

---

### TC-VISIT-07: Visit Delete

1. Open a visit → click delete → `VisitDeleteDialog` (`visit-delete-dialog.tsx`) opens.
2. Confirm deletion → visit removed from list.

---

### TC-VISIT-08: Automated Reminders (via Automations)

1. Schedule a visit 24 hours from now.
2. Verify the **T-24h** automation is queued in `automation_pending_executions`.
3. At T-2h, verify the **T-2h** reminder is queued.
4. Both should send WhatsApp messages to the lead.

---

## 7. Inbox (WhatsApp)

**URL:** `/inbox`

### TC-INBOX-01: Conversation List

1. `ConversationList` (`conversation-list.tsx`, ~27K) renders open WhatsApp conversations.
2. Each conversation shows: contact name, last message preview, timestamp, unread count badge.
3. **Tab filter:** "Mine" (assigned to current agent), "Unassigned" (no agent), "All" (admin/owner can see team overview).
4. Agent sees only their assigned conversations.
5. Unread count badge updates in real-time via `useRealtime` / `useTotalUnread`.

---

### TC-INBOX-02: Message Thread

1. Click a conversation → `MessageThread` (`message-thread.tsx`, ~53K) opens.
2. Sent messages render as right-aligned bubbles; received as left-aligned (`MessageBubble` — `message-bubble.tsx`, ~11K).
3. Delivery/read receipts visible (✓ / ✓✓ ticks).
4. Scroll up loads older messages (pagination).
5. **Media rendering:** Images, PDFs, audio, video, location cards render correctly (`MessageMedia` — `message-media.tsx`).
6. **Media lightbox:** Click an image/video → `MediaLightbox` (`media-lightbox.tsx`) opens full-screen.
7. **Interactive messages:** Button replies and list pickers render correctly.
8. **Reply quoting:** `ReplyQuote` (`reply-quote.tsx`) shows when replying to a specific message.

---

### TC-INBOX-03: Message Composer

1. `MessageComposer` (`message-composer.tsx`, ~35K) renders at the bottom.
2. Type a message → press Send (or Enter) → message appears immediately (optimistic update).
3. Delivery receipt updates within seconds.
4. **Media send:** Attach an image/PDF/audio → sends correctly.
5. **Quick reply picker:** `QuickReplyPicker` (`quick-reply-picker.tsx`) — click the lightning bolt → select a canned reply → fills composer.
6. **Emoji picker** if available.

---

### TC-INBOX-04: 24-Hour Service Window

1. **Inside 24h:** Composer is enabled; green session badge shows "Xh remaining".
2. **Outside 24h:** Composer is disabled with red banner "Session Expired"; only template sending is available.
3. Send a template → when customer replies, session reopens → composer re-enables.

---

### TC-INBOX-05: Template Picker

1. Click the template button → `TemplatePicker` (`template-picker.tsx`, ~15K) opens.
2. Pre-approved Meta message templates appear with search/filter.
3. Select a template → template body fills the composer with placeholder variables.
4. Send → message delivered with correct format.

---

### TC-INBOX-06: AI Draft Reply

1. Click the "AI Draft" / sparkle button in the composer.
2. AI generates a draft reply based on conversation context (via `/api/ai/draft`).
3. Draft appears in the composer for editing.
4. Edit and send → verify AI usage entry in `ai_usage_log`.

---

### TC-INBOX-07: AI Auto-Reply Thread Banner

1. `AIThreadBanner` (`ai-thread-banner.tsx`) shows when an AI auto-reply bot is active on this conversation.
2. Banner shows the bot status and allows manual takeover.

---

### TC-INBOX-08: Contact Sidebar

1. In the conversation view, the `ContactSidebar` (`contact-sidebar.tsx`, ~31K) shows lead details.
2. Displays: name, phone, email, source, budget (₹ INR), BHK config, location, assigned agent.
3. Quick edit fields for lead qualification.
4. Links to deals, site visits, and tasks for this contact.

---

### TC-INBOX-09: Message Reactions

1. Long-press or hover on a message → `MessageActions` (`message-actions.tsx`) shows reaction options.
2. React with an emoji → reaction appears on the message bubble (`MessageReactions` — `message-reactions.tsx`).
3. Verify `message_reactions` table entry is created.

---

### TC-INBOX-10: Conversation Assignment

1. In contact sidebar, find "Assigned to:" selector.
2. Change assignment to `agent2` → verify conversation moves to agent2's inbox.
3. Verify `assignment_history` entry is created.
4. **Tab switch:** When an agent claims an unassigned lead, inbox auto-switches from "Unassigned" to "Mine" tab seamlessly.

---

### TC-INBOX-11: Conversation Close/Reopen

1. Close a conversation → it disappears from the active list.
2. Filter to show closed conversations → it appears.
3. Customer sends a new message → conversation auto-reopens.

---

### TC-INBOX-12: Peer Lead Lock (Anti-Poaching)

1. Log in as `agent2`.
2. Open a conversation assigned to `agent1`.
3. **Expected:** Message composer is disabled with a lock banner: "This conversation is assigned to [Agent1 Name]. You have view-only access."
4. Cannot edit lead qualification inputs.
5. Log in as `admin` → full access to any conversation.

---

## 8. Properties & RERA Compliance

**URL:** `/properties`

### TC-PROP-01: Properties List — Desktop

1. Properties page (`properties/page.tsx`, ~47K) renders with KPI stat cards and a high-density table/grid.
2. Each property shows: Title, Location, Price (₹ INR format), Configuration (BHK), Builder Name, RERA Badge, Possession Status.
3. Multi-dimensional filters: Location, Budget Range, Configuration (BHK), Possession Status, Facing Direction.
4. Omni-search across titles, locations, builder names.

---

### TC-PROP-02: Property Detail

**URL:** `/properties/[id]`

1. Property detail shows all fields: Title, Location, Price (₹ INR), Configuration (BHK), Builder Name, Project Name, Carpet Area (sq ft), Facing Direction.
2. **RERA ID badge:** Shows "RERA: MH/2023/12345" prominently. If missing → amber warning "RERA ID missing — required under RERA Act 2016".
3. Possession status pill: Ready to Move / Under Construction / Nearing Possession.
4. **EMI Calculator** (`emi-calculator.tsx`, ~5K): collapsible widget with inputs for loan amount (pre-filled as 80% of price), tenure (years), interest rate %. Output: monthly EMI in ₹ INR format + "Total Interest".

---

### TC-PROP-03: Create / Edit Property (RBAC Gate — Migration 130)

1. Log in as `admin` or `owner` → "+" New Property button is visible.
2. Click → `PropertyFormModal` (`property-form-modal.tsx`, ~24K) opens.
3. Fill: Title, Location, Price (₹), Configuration (BHK chip selector — multi-select), RERA ID, Possession Status, Carpet Area (sq ft), Facing Direction, Builder Name, Project Name.
4. Save → property appears in list with correct INR price.
5. **RBAC check:** Log in as `agent` → "New Property" button should NOT be visible; attempting to POST via API → 403.
6. **RBAC check:** Log in as `viewer` → read-only; no create/edit/delete.
7. Verify `canEditSettings(role)` (admin+ only) governs property mutations per Migration 130.

---

### TC-PROP-04: Property Delete

1. Log in as `admin` → open a property → delete button visible.
2. Click delete → `PropertyDeleteDialog` (`property-delete-dialog.tsx`) opens.
3. Confirm → property removed.
4. Agent/viewer → delete button NOT visible.

---

### TC-PROP-05: Property Share via WhatsApp

1. Open a property detail → click "Share via WhatsApp" → `PropertyShareModal` (`property-share-modal.tsx`, ~14K) opens.
2. Select a contact → formatted WhatsApp brochure message is generated with property title, price (₹ INR), RERA ID, BHK config, location.
3. Send → opens the conversation in `/inbox` with the pre-filled brochure message.
4. Verify agents CAN share (read + WhatsApp share permission).

---

### TC-PROP-06: Properties Mobile Layout

> Test at < 768px viewport.

1. Table converts to rich stacked cards.
2. 1-tap action buttons (Share, Schedule Visit, Call).
3. No horizontal scrolling; all data visible in the card layout.

---

## 9. Automations

**URL:** `/automations`

### TC-AUTO-01: Automation Recipes List

1. Automations list page (`automations/` routes) shows automation recipes with status toggles.
2. Toggle an automation ON → verify stored as active in `automations` table.
3. Pre-seeded real estate automations visible:
   - T-24h Site Visit Confirmation
   - T-2h Site Visit Reminder
   - No-Show Recovery
   - Hinglish (`[HI]`) variants (when `accounts.preferred_language = 'hi-en'`)
   - No WhatsApp Reply in 30min → Notify Manager
   - Lead in New Stage for 48h → Escalate

---

### TC-AUTO-02: Create/Edit Automation (admin+)

1. Log in as `admin`.
2. Navigate to `/automations/new` → `AutomationBuilder` (`automation-builder.tsx`) renders.
3. Configure: trigger selector (keyword, SLA breach, site-visit reminder, stale-lead), condition steps, action steps.
4. Save → automation appears in the list.
5. Edit an existing automation at `/automations/[id]/edit`.

---

### TC-AUTO-03: Automation Logs

**URL:** `/automations/[id]/logs`

1. Open a recently fired automation.
2. Logs show: timestamp, trigger context, step results, success/failure.
3. Logs stored in `automation_logs` table.

---

### TC-AUTO-04: Escalation Recipe — SLA Breach

1. Enable "No WhatsApp Reply in 30min → Notify Manager".
2. Simulate an unanswered inbound message (set `first_unanswered_at` to 31+ minutes ago).
3. Trigger the automation engine.
4. Verify admin receives a notification: "⚠️ SLA breach: [Contact Name] has been waiting 31 min. Assigned to: [Agent Name]."

---

### TC-AUTO-05: Delayed/Scheduled Steps

1. Create an automation with a delayed action (e.g., "Send follow-up after 2 hours").
2. Verify `automation_pending_executions` record is created with the correct future timestamp.

---

## 10. Flows (Conversation Bots)

**URL:** `/flows`

### TC-FLOW-01: Flows List

1. Flows list shows all flows with status toggle (Active / Disabled).
2. **"Real Estate Qualifier (Auto)"** flow is visible (seeded on signup via `handle_new_user` trigger).
3. Status is "Disabled" by default.

---

### TC-FLOW-02: Enable RE Qualifier Flow

1. Enable "Real Estate Qualifier (Auto)" toggle.
2. Simulate an inbound message from a new WhatsApp number.
3. Bot sends: "Namaste [Name] ji! 🙏 Thank you for your interest..."
4. Reply with a budget ("₹45L") → bot captures and saves to `lead_details.budget_max`.
5. Bot sends BHK question with button options → reply with "2BHK" → saved to `configuration_preference`.
6. Bot asks for location → reply "Noida" → saved to `location_preference`.
7. After qualifying, conversation is **auto-assigned** to the least-loaded available agent via round-robin.
8. **Agent reply pauses flow:** If an agent manually replies during the flow, it auto-pauses (`status = 'paused_by_agent'`, `end_reason = 'agent_replied'`).

---

### TC-FLOW-03: Flow Builder Canvas (Desktop, admin+)

1. Open a flow for editing at `/flows/[id]` → `FlowBuilder` (`flow-builder.tsx`, ~20K) renders.
2. `FlowCanvas` (`flow-canvas.tsx`, ~28K) using `@xyflow/react` renders with draggable/connectable nodes.
3. `FlowEditorState` (`flow-editor-state.tsx`, ~17K) manages editor state.
4. Add a new node (Send Message, Wait for Reply, Condition, etc.) → connect it to existing nodes.
5. `FlowEditorShell` wraps the full-page editor with header and validation panel.
6. `ValidationPanel` (`validation-panel.tsx`) shows any flow validation errors.
7. Save → verify flow structure persisted in `flow_nodes` table.

---

### TC-FLOW-04: Flow Runs & History

**URL:** `/flows/[id]/runs`

1. View run history for a flow.
2. Each run shows: contact name, start time, current step, status (running, completed, paused, failed).
3. Run events stored in `flow_run_events` table.
4. Verify only one active run per contact is enforced.

---

## 11. Broadcasts

**URL:** `/broadcasts`

### TC-BROAD-01: Admin Gate

1. Log in as `agent1`.
2. On `/broadcasts`, the "+ New Broadcast" button should be **hidden** (`canCreateBroadcast(role)` returns false for agents).
3. **API test:** Attempting to create a broadcast as agent → should be blocked.
4. Log in as `admin` → button visible; can create broadcasts.

---

### TC-BROAD-02: Broadcast Wizard — 4-Step Flow

**URL:** `/broadcasts/new`

1. **Step 1 — Choose Template** (`step1-choose-template.tsx`, ~8K): Select a template from Meta-approved templates or the `broadcast_templates` global library.
2. **Step 2 — Select Audience** (`step2-select-audience.tsx`, ~27K):
   - "All Contacts" option.
   - "Lead Details Segment" with filters: `configuration_preference`, `budget_min`/`budget_max`, `location_preference`, `source`.
   - Recipient count updates dynamically.
3. **Step 3 — Personalize** (`step3-personalize.tsx`, ~17K): Map CSV columns to template variables, preview messages.
4. **Step 4 — Schedule & Send** (`step4-schedule-send.tsx`, ~16K): Send now or schedule for later. Review summary.
5. Submit → broadcast created; verify in `broadcasts` table.

---

### TC-BROAD-03: Real Estate Broadcast Templates

1. In Step 1, filter by "Real Estate" tag.
2. Templates from `broadcast_templates` table (global, no account_id, world-readable) appear:
   - Diwali Offer 🪔
   - New Project Launch 🏠
   - Price Drop Alert 📉
3. Select a template → preview shows body with `{{placeholder}}` variables.

---

### TC-BROAD-04: Broadcast Delivery Tracking

**URL:** `/broadcasts/[id]`

1. Open a sent broadcast → delivery telemetry visible: sent, delivered, read, replied counts.
2. `broadcast_recipients` table shows per-recipient status with `wamid` tracking.
3. Verify broadcast CSV support (`broadcast-csv.ts` — tested by `broadcast-csv.test.ts`).
4. Verify retry logic (`broadcast-retry.ts` — tested by `broadcast-retry.test.ts`).
5. Verify status tracking (`broadcast-status.ts` — tested by `broadcast-status.test.ts`).

---

### TC-BROAD-05: Resumable Dispatch

1. Start a large broadcast.
2. Interrupt it (close browser / kill server).
3. Reopen → broadcast should resume from where it left off (migration 038 — resumable sends).

---

### TC-BROAD-06: Agent Views Broadcast Results

1. Log in as `agent1` → visit `/broadcasts`.
2. Can view broadcast list and delivery statistics (read-only).
3. Cannot create a new broadcast.

---

## 12. Integrations

**URL:** `/integrations` | Login as: `admin`

### TC-INTEG-01: Integrations Page Layout

1. Integrations page (`integrations/page.tsx`) loads with:
   - **Universal Capture Email card** with copy button.
   - **Portal tiles grid**: 99acres, MagicBricks, Housing.com, NoBroker, Meta Lead Ads, Gmail, WhatsApp Business, Instagram, JustDial.

---

### TC-INTEG-02: Capture Email Copy

1. Click the "Copy" button next to the capture email.
2. Verify it copies to clipboard. Email format: `leads+<account_id_first_8_chars>@<INBOUND_EMAIL_DOMAIN>`.
3. Inbound email parsing handled by `lib/inbound-email/` and `/api/webhooks/inbound-email`.

---

### TC-INTEG-03: Portal Connection Status

1. "WhatsApp Business" tile reflects live `whatsapp_config` state:
   - Connected → "✓ Connected" green badge.
   - Not connected → "Not Connected" grey badge.
2. "Instagram" → "Coming Soon" purple badge; CTA disabled.
3. "JustDial" → "Coming Soon" purple badge.
4. Other tiles show "Not Connected" with "+ Connect →" button.

---

### TC-INTEG-04: Connect a Portal

1. Click "+ Connect →" on "99acres".
2. Dialog/sheet opens with setup instructions and capture email.
3. Click "Mark as Connected" → tile updates to "✓ Connected" without reload.
4. Verify `portal_connections` updated via `/api/account/portal-connections`.

---

### TC-INTEG-05: Test Lead Indicator

1. Set `portal_connections['99acres'].test_lead_received = true` in Supabase.
2. Reload → 99acres tile shows "✓ Test lead received" label.

---

### TC-INTEG-06: Portal Webhook Lead Ingestion

1. Send a test POST to `/api/portal/webhook` with a valid portal lead payload.
2. Verify a new contact is created with the correct source badge.
3. Verify `lead_details` are populated (budget, location, config).
4. Verify automatic deduplication on phone number.

---

### TC-INTEG-07: Access Control

1. Log in as `agent` → navigate to `/integrations` → should see "Contact your admin" page.
2. Admin/owner → full integrations page visible.

---

## 13. Tasks & Follow-ups

**URL:** Dashboard widget + Contact Detail Tasks tab

### TC-TASK-01: Create a Task from Dashboard

1. Dashboard → "Today's Tasks" widget (`tasks-widget.tsx`) → inline form.
2. Type "Send cost sheet to Rahul" → set due date → click "Add".
3. Task appears immediately (optimistic update).

---

### TC-TASK-02: Create a Task from Lead Detail

1. Open a lead detail → Tasks section.
2. Inline form: task title, due date, optional link to site visit.
3. Submit → task created with `contact_id` pre-filled.

---

### TC-TASK-03: Check Off a Task

1. Click the checkbox on a task → row disappears (optimistic).
2. Reload → task is gone (confirmed `done = true`, `done_at` populated in `tasks` table).

---

### TC-TASK-04: Overdue Tasks

1. Set a task's `due_at` to 2 days ago with `done = false`.
2. Dashboard "Follow-ups Due" card shows overdue count in amber/red sub-label.

---

### TC-TASK-05: Tasks API (Internal)

```bash
GET  /api/tasks?due_today=true
POST /api/tasks { "title": "Call lead", "contact_id": "<uuid>", "due_at": "<ISO date>" }
PATCH /api/tasks/<id> { "done": true }
DELETE /api/tasks/<id>
```

- GET returns only tasks for the authenticated user's account.
- POST as `viewer` → should fail (403).
- DELETE as `viewer` → should fail (403).

---

## 14. Cost Sheet

### TC-COST-01: Configure Template in Settings

1. Settings → Cost Sheet (`cost-sheet-config.tsx`, ~12K).
2. Default template textarea pre-populated with RE-specific placeholders (property_title, price, RERA, etc.).
3. Modify the template text.
4. Click "Preview" → preview renders with sample values.
5. Click "Save Template" → success toast; verify `quick_replies` table has `kind='cost_sheet'` row; `accounts.cost_sheet_template_id` updated.

---

### TC-COST-02: Send Cost Sheet from Lead Detail

1. Open a lead detail → click "Cost Sheet" → `CostSheetModal` (`cost-sheet-modal.tsx`, ~20K) opens.
2. Property dropdown (filtered by lead's criteria) → select a property.
3. Preview fills with real data (title, price ₹ INR, RERA ID, BHK).
4. Click "Send via WhatsApp" → success toast.
5. Verify WhatsApp message sent in the lead's conversation.

---

### TC-COST-03: Dashboard Quick Action — No Template

1. Ensure `cost_sheet_template_id` is NULL.
2. Dashboard "Cost Sheet" button is **disabled** with tooltip.

---

### TC-COST-04: Dashboard Quick Action — With Template

1. After configuring template → Dashboard "Cost Sheet" quick action is enabled.
2. Click → contact picker → select lead → cost sheet modal opens.

---

## 15. Team Command Center

**URL:** `/team` | Login as: `admin` or `owner`

### TC-TEAM-01: Access Control

1. Log in as `agent1` → navigate to `/team` → should redirect or show "Contact your admin".
2. Log in as `admin` → full command center visible.
3. `team-client.tsx` (~27K) is the main client component.

---

### TC-TEAM-02: Unassigned Lead Pool

1. `UnassignedPool` (`unassigned-pool.tsx`, ~8K) renders at the top.
2. "X unassigned leads" count badge.
3. Scrollable list showing: lead name, source badge, time since creation, "Assign" button.
4. Click "Assign" → agent picker with current open-lead count per agent.
5. Assign a lead → lead disappears from pool, `assignment_history` recorded.

---

### TC-TEAM-03: Agent Cards

Each `AgentCard` (`agent-card.tsx`, ~10K) shows:

1. Name, avatar.
2. **Availability indicator:** green dot (available) / grey dot + "On Leave" (`is_available = false`).
3. **Workload capacity bar:** "X open leads" as a progress bar (green < 10, amber 10–18, red > 18).
4. **Target progress:** "Visits: X / Y this month" (from `agent_targets` table).
5. **First-response SLA:** Average response time.
6. Click agent name → filtered leads list for that agent.

---

### TC-TEAM-04: Agent Table

1. `AgentTable` (`agent-table.tsx`, ~13K) renders a comprehensive table of all agents.
2. Columns: Name, Role, Availability, Open Leads, Visits Completed, Avg Response Time, Targets.

---

### TC-TEAM-05: Set Monthly Targets

1. Click target on an agent card → `AgentTargetModal` (`agent-target-modal.tsx`, ~5K) opens.
2. Set target visits to "25" → save.
3. Card updates to reflect new target. Verify `agent_targets` table has the record.
4. API endpoint: `/api/account/targets`.

---

### TC-TEAM-06: Availability Toggle

1. Admin clicks the availability toggle on an agent card.
2. Agent becomes unavailable (`profiles.is_available = false`).
3. New lead routing skips this agent.
4. Agent can also toggle own availability from sidebar/header.

---

### TC-TEAM-07: Pipeline Funnel Chart

1. `PipelineFunnel` (`pipeline-funnel.tsx`, ~4K) renders below agent section.
2. Shows leads per stage across all agents.
3. Hover shows stage name + count tooltip.

---

### TC-TEAM-08: Print Report

1. "Print Report" button (printer icon) in the header.
2. Click → triggers browser print dialog.
3. Page renders in print-optimized layout (no nav, compact tables).
4. Verify `@media print` styles work correctly.

---

## 16. AI Co-Pilot & Knowledge Base

**URL:** `/agents`

### TC-AI-01: AI Playground

1. `AIPlayground` (`ai-playground.tsx`, ~16K) renders a chat-like interface.
2. Enter a prompt → AI responds using configured provider (OpenAI/Anthropic).
3. Responses are streamed.
4. API endpoint: `/api/ai/playground`.

---

### TC-AI-02: AI Usage Tracking

1. `AIUsage` (`ai-usage.tsx`, ~8K) renders usage statistics.
2. Shows: total tokens used, cost, requests count (from `ai_usage_log` table).
3. API endpoint: `/api/ai/usage`.

---

### TC-AI-03: Knowledge Base Upload

1. Settings → AI Configuration (`ai-config.tsx`, ~18K) or AI Knowledge (`ai-knowledge.tsx`, ~16K).
2. Upload a PDF/text document.
3. Document is chunked and stored in `ai_knowledge_documents` and `ai_knowledge_chunks` (with pgvector embeddings).
4. API endpoint: `/api/ai/knowledge`.
5. AI draft replies now include context from the knowledge base.

---

### TC-AI-04: AI Auto-Reply Configuration

1. Configure AI auto-reply in settings.
2. Set response caps (max replies before handoff).
3. System prompt editor for customizing AI behavior.
4. API endpoint: `/api/ai/autoreply` and `/api/ai/config`.
5. Enable → new inbound messages get auto-replies until cap hit or human agent intervenes.

---

### TC-AI-05: AI Draft in Composer

1. In inbox message composer, click AI draft button.
2. Draft generated via `/api/ai/draft` based on conversation context + knowledge base.
3. Edit draft → send.

---

### TC-AI-06: AI Test Endpoint

1. API: `/api/ai/test` — verify AI provider connectivity.

---

## 17. Notifications

**URL:** `/notifications`

### TC-NOTIF-01: Notification Center

1. `/notifications` page renders notification list.
2. Notifications include: new lead assignments, SLA breaches, site visit reminders, team member actions.
3. Stored in `notifications` table.

---

### TC-NOTIF-02: Notification Popover

1. `NotificationPopover` (`notification-popover.tsx`, ~8K) accessible from the header bell icon.
2. Shows recent unread notifications with count badge.
3. `useUnreadNotifications` hook provides the unread count.
4. Click a notification → navigates to the relevant page.

---

### TC-NOTIF-03: Browser Push Notifications

1. `BrowserNotificationsCard` in settings (`browser-notifications-card.tsx`, ~7K) → enable push notifications.
2. `BrowserNotificationsListener` (`browser-notifications-listener.tsx`) listens for push events.
3. `useBrowserNotifications` hook manages permission and subscription.
4. API: `/api/push/subscribe` — registers push subscription.
5. Accept push permission → verify push notifications arrive for new leads, reminders, etc.

---

## 18. Settings

**URL:** `/settings`

### TC-SET-01: Settings Architecture (Grouped Rail)

Settings page (`settings/page.tsx`) uses a grouped left rail with sections:

| Group         | Sections                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Top**       | Overview (`settings-overview.tsx`)                                                                                             |
| **Account**   | Profile, Security (Password), Appearance                                                                                       |
| **Workspace** | WhatsApp, Templates, Quick Replies, Fields & Tags, Deals & Currency, Team Members, API Keys, Lead Routing, Billing, Cost Sheet |

Deep-linkable via `?tab=<section>` query param. Legacy tabs redirect correctly (e.g., `?tab=team` → `members`).

---

### TC-SET-02: Overview

1. `SettingsOverview` (`settings-overview.tsx`, ~10K) renders a summary landing page.
2. Shows account info, quick links to common settings.

---

### TC-SET-03: Profile

1. `ProfileForm` (`profile-form.tsx`, ~12K) → edit display name, avatar.
2. Save → name updates in sidebar/header.

---

### TC-SET-04: Security

1. `PasswordForm` (`password-form.tsx`, ~5K) → change password.
2. `SecurityPanel` / `SessionsCard` (`sessions-card.tsx`) → view active sessions.

---

### TC-SET-05: Appearance

1. `AppearancePanel` (`appearance-panel.tsx`, ~5K) → theme toggle.
2. Light/Dark/System mode selection.
3. Theme changes apply immediately via CSS variables.

---

### TC-SET-06: WhatsApp Configuration

1. `WhatsappConfig` (`whatsapp-config.tsx`, ~42K) — the largest settings component.
2. Shows connection status (from `whatsapp_config` table).
3. Not connected → form for WABA phone number, access token, phone number ID.
4. "Test Connection" → verifies against Meta Cloud API via `/api/whatsapp/config`.
5. Connected → shows phone number, "✓ Connected", media mirroring toggle.
6. **Encrypted storage:** Credentials stored encrypted in `whatsapp_config` using `ENCRYPTION_KEY`.

---

### TC-SET-07: Templates

1. `TemplateManager` (`template-manager.tsx`, ~46K) — the second-largest settings component.
2. Lists all Meta-approved message templates (from `message_templates` table).
3. Sync templates from Meta API.
4. Search/filter templates.
5. Preview template content with placeholders.
6. Template lifecycle status tracking (`template-status.ts`).

---

### TC-SET-08: Quick Replies

1. `QuickRepliesManager` (`quick-replies-manager.tsx`, ~9K) → manage canned replies.
2. CRUD operations on `quick_replies` table.
3. API: `/api/quick-replies`.

---

### TC-SET-09: Fields & Tags

1. `FieldsAndTagsPanel` (`fields-and-tags-panel.tsx`) combines:
   - `CustomFieldsSettings` → manage custom fields for contacts.
   - `TagManager` → manage tags.
2. Verify custom fields appear in contact forms and detail views.

---

### TC-SET-10: Deals & Currency

1. `DealsSettings` (`deals-settings.tsx`, ~6K) → configure default currency, brokerage percentage.
2. Set brokerage % → pipeline deal cards update brokerage badge calculation.

---

### TC-SET-11: Team Members

1. `MembersTab` (`members-tab.tsx`, ~26K) → list all team members.
2. Each member row: name, email, role badge, availability status.
3. **Invite:** `InviteMemberDialog` (`invite-member-dialog.tsx`, ~14K) → send invite with role selection.
4. **Role change:** Admin/owner can change member roles (via `canManageMembers`).
5. **Remove member:** Admin/owner can remove members.
6. `RoleMeta` (`role-meta.ts`) provides role display metadata.

---

### TC-SET-12: API Keys

1. `ApiKeysSettings` (`api-keys-settings.tsx`, ~16K) → create, view, revoke scoped API keys.
2. Create key with specific scopes (e.g., `contacts:read`, `messages:send`).
3. Key shown once → copy it.
4. Use key → verify it works with correct scope.
5. Revoke → subsequent calls return 401.
6. API key format: `wacrm_live_*`, stored as SHA-256 hashes in `api_keys` table.
7. API: `/api/account/api-keys`.

---

### TC-SET-13: Lead Routing Rules

1. `RoutingSettings` (`routing-settings.tsx`, ~12K) → manage lead routing rules.
2. "+ Add Rule" → form with condition types:
   - `source` (e.g., 99acres)
   - `budget_gte` / `budget_lte`
   - `location_contains`
   - `configuration` (e.g., 3BHK)
3. Action types: `assign_to_agent` (specific user) or `assign_to_role` (least-loaded with that role).
4. Drag-reorder rules by priority → order persists.
5. Toggle rule inactive → round-robin falls through.
6. API: `/api/account/routing-rules`.
7. Verify rules stored in `lead_routing_rules` table.

---

### TC-SET-14: Cost Sheet (Covered in Section 14)

### TC-SET-15: Billing (Covered in Section 19)

---

### TC-SET-16: Settings Access Control

1. Log in as `agent` → Settings page shows only Account sections (Profile, Security, Appearance).
2. Workspace sections (WhatsApp, Templates, Team Members, API Keys, etc.) → hidden or show "Contact your admin" (`canEditSettings` returns false).
3. Admin+ → all sections visible.
4. Billing tab → visible to owner only.

---

## 19. Billing & Plan Gating

**URL:** Settings → `?tab=billing` | Login as: `owner`

### TC-BILL-01: Billing Tab

1. `BillingTab` (`billing-tab.tsx`, ~7K) shows:
   - Plan name badge (starter/growth/pro).
   - Status pill (trialing/active/past_due/canceled).
   - Renewal date ("Renews in 14 days").
   - Seat usage ("2 of 3 seats used").
   - "Manage Plan" button → Stripe Billing Portal redirect.
   - "Upgrade" button (only for starter plan).
2. Log in as `agent` → Billing tab NOT visible.
3. API: `/api/billing/portal`.

---

### TC-BILL-02: Stripe Checkout Flow

1. Click "Upgrade" → POST to `/api/billing/checkout` → redirect to Stripe Checkout.
2. Complete payment with Stripe test card `4242 4242 4242 4242`.
3. Stripe webhook fires → `/api/billing/webhook` processes it.
4. Verify: `accounts.subscription_status = 'active'`, `stripe_customer_id` and `stripe_subscription_id` populated.

---

### TC-BILL-03: Payment Failed Gate

1. Set `subscription_status = 'past_due'` in Supabase.
2. Navigate to any dashboard page → should redirect to billing.
3. "Reactivate Plan" CTA visible.
4. `/api/billing/webhook` route itself must NOT be blocked by the gate.

---

### TC-BILL-04: Canceled Account Gate

1. Set `subscription_status = 'canceled'` → same gate behavior.
2. "Start Free Trial" or "Reactivate Plan" shown depending on history.

---

### TC-BILL-05: Stripe Webhook Security

1. POST to `/api/billing/webhook` without valid `Stripe-Signature` header → 400.
2. Valid HMAC-signed payload → 200 + processed.

> [!CAUTION]
> Never test billing webhooks against a production Stripe account. Use test mode keys only.

---

## 20. Reporting & Exports

### TC-REPORT-01: CSV Export

1. Log in as `admin`.
2. Contacts page → "Export CSV" → API: `/api/contacts/export`.
3. CSV downloads with columns: Name, Mobile, Source, Stage, Agent, Budget (₹ INR), Location, BHK, etc.
4. Open CSV → budgets in INR format, phones normalized.
5. Date range filter support.
6. Agent → "Export CSV" button NOT visible (`canManageMembers` check).

---

### TC-REPORT-02: Deals Export

1. Admin → Pipelines page → "Export" → API: `/api/deals/export`.
2. CSV includes deal details with values in ₹ INR.

---

### TC-REPORT-03: Weekly Report Cron

**Endpoint:** `GET /api/cron/weekly-report`

```bash
curl -H "x-cron-secret: <CRON_SECRET>" http://localhost:3000/api/cron/weekly-report
```

1. Returns JSON: `{ new_leads, visits_scheduled, visits_completed, no_show_rate, deals_closed, deals_value_inr, top_agent, stale_leads }`.
2. Without `CRON_SECRET` header → 401.

---

### TC-REPORT-04: Stale Leads Cron

**Endpoint:** `GET /api/cron/stale-leads`

```bash
curl -H "x-cron-secret: <CRON_SECRET>" http://localhost:3000/api/cron/stale-leads
```

1. Returns `{ processed: N, stale: N }`.
2. For each stale lead (no activity for 48h), a task is created: "Follow up: [Name] — no activity for 2+ days."
3. Without `CRON_SECRET` → 401.

---

### TC-REPORT-05: Site Visits Cron

**Endpoint:** `GET /api/cron/site-visits`

1. Processes pending site visit reminders (T-24h, T-2h).
2. Updates `reminded_24h` / `reminded_2h` flags.
3. Without `CRON_SECRET` → 401.

---

## 21. Public REST API (v1)

**Base URL:** `http://localhost:3000/api/v1`
**Auth:** `Authorization: Bearer <api_key>` (create API key in Settings → API Keys)

### TC-API-01: Contacts CRUD

```bash
GET    /api/v1/contacts                  # List (paginated)
POST   /api/v1/contacts                  # Create
GET    /api/v1/contacts/<id>             # Get single
PATCH  /api/v1/contacts/<id>             # Update
DELETE /api/v1/contacts/<id>             # Delete
```

- Pagination: `?page=1&limit=20` → envelope `{ data: [...], total: N, page: 1, limit: 20 }` (via `pagination.ts`).
- Response format via `respond.ts` → `toSuccessResponse()` / `toApiErrorResponse()`.
- Cross-tenant isolation: API key from Account A → fetch contact from Account B → 404.
- **CRITICAL:** Service-role client must explicitly filter by `ctx.accountId` (RLS bypassed).

---

### TC-API-02: Properties CRUD

```bash
GET    /api/v1/properties
POST   /api/v1/properties
GET    /api/v1/properties/<id>
PATCH  /api/v1/properties/<id>
DELETE /api/v1/properties/<id>
```

- Verify fields: `rera_id`, `configuration`, `builder_name`, `carpet_area`, `facing`, `possession_status`.

---

### TC-API-03: Site Visits CRUD

```bash
GET    /api/v1/site-visits
POST   /api/v1/site-visits
GET    /api/v1/site-visits/<id>
PATCH  /api/v1/site-visits/<id>
```

- POST: `contact_id`, `property_id`, `scheduled_at`, `pickup_required`, `pickup_location`.

---

### TC-API-04: Conversations & Messages

```bash
GET /api/v1/conversations
GET /api/v1/conversations/<id>
GET /api/v1/messages?conversation_id=<id>
```

---

### TC-API-05: Broadcasts API

```bash
GET    /api/v1/broadcasts
GET    /api/v1/broadcasts/<id>
POST   /api/v1/broadcasts
```

- Scope: `broadcasts:send`.

---

### TC-API-06: Webhooks API

```bash
GET    /api/v1/webhooks
POST   /api/v1/webhooks { "url": "https://...", "events": ["contact.created", "deal.updated"] }
DELETE /api/v1/webhooks/<id>
```

- Verify outbound webhook calls include HMAC `X-WaCRM-Signature` header (via `lib/webhooks/sign.ts`).
- SSRF protection via `lib/webhooks/ssrf.ts`.
- Event types from `lib/webhooks/events.ts`.

---

### TC-API-07: Me Endpoint

```bash
GET /api/v1/me
```

- Returns account info, role, and available scopes for the API key.

---

### TC-API-08: Scope Enforcement

1. Create API key with scope `contacts:read`.
2. `GET /api/v1/contacts` → 200.
3. `POST /api/v1/contacts` → 403 (needs `contacts:write`).
4. `GET /api/v1/properties` → 403 (wrong scope).
5. Available scopes defined in `lib/api-keys/scopes.ts`.

---

### TC-API-09: Rate Limiting

1. Make rapid requests to a v1 endpoint.
2. Verify rate limiter kicks in (`lib/rate-limit.ts` — in-memory, single-process).
3. Returns 429 when limit exceeded.

---

### TC-API-10: Cross-Tenant Isolation

1. Create API keys for two different accounts.
2. Use Account A's key to access Account B's resources → 404 (not 403, to avoid enumeration).

---

## 22. MCP Server (wacrm-mcp)

**Location:** `mcp-server/`

### TC-MCP-01: Server Setup

1. Navigate to `mcp-server/`.
2. `npm install` and configure `.env` per `.env.example`.
3. Start the MCP server.

---

### TC-MCP-02: Available Tools

Verify the following tools work:

- `whoami` — returns account info.
- `list_contacts` — lists contacts.
- `get_contact` — gets a single contact.
- `list_conversations` — lists conversations.
- `get_messages` — gets messages for a conversation.
- `send_message` — sends a message (requires `WACRM_ENABLE_WRITES=true`).
- `create_contact` — creates a contact (requires `WACRM_ENABLE_WRITES=true`).

---

### TC-MCP-03: Read-Only Default

1. Without `WACRM_ENABLE_WRITES=true`, write operations (`send_message`, `create_contact`) should be blocked.
2. With `WACRM_ENABLE_WRITES=true`, write operations work.

---

## 23. PWA & Mobile Shell

> Test on a real Android/iOS device, or use DevTools → Device toolbar at 375px / 390px / 412px.

### TC-PWA-01: Mobile Bottom Navigation

1. At < 768px viewport: `BottomNav` (`bottom-nav.tsx`, ~5K) visible with tabs.
2. At ≥ 768px viewport: `Sidebar` (`sidebar.tsx`, ~17K) visible (no bottom nav).
3. Bottom nav respects `pb-safe` and `env(safe-area-inset-bottom)`.

---

### TC-PWA-02: Top App Bar (Mobile)

1. `TopAppBar` (`top-app-bar.tsx`) renders on mobile with page title and back button.
2. `Header` (`header.tsx`, ~9K) renders on desktop with search, notifications, user menu.

---

### TC-PWA-03: Command Palette

1. `CommandPalette` (`command-palette.tsx`, ~13K) — press Cmd/Ctrl+K → global search palette opens.
2. Search contacts, properties, conversations.
3. Navigate to results directly.

---

### TC-PWA-04: PWA Install

1. Open app on Chrome Android → "Add to Home Screen" prompt appears.
2. Accept → app icon on home screen.
3. Launch → standalone mode (no browser chrome).
4. iOS Safari: Share → Add to Home Screen.
5. `pwa-registry.tsx` manages service worker registration.

---

### TC-PWA-05: Offline Fallback

1. Open `/offline` page directly → renders the offline fallback screen.
2. Go offline (DevTools → Network → Offline) → reload → offline fallback appears (not browser error).
3. Go back online → app recovers.

---

### TC-PWA-06: Pull-to-Refresh

1. `PullToRefresh` (`pull-to-refresh.tsx`, ~3K) — on mobile, pull down from top of a list.
2. Loading indicator appears → release → list refreshes.

---

### TC-PWA-07: Touch Targets

> Minimum 44×44px for all interactive elements.

1. Using a physical device, tap all buttons, chips, toggles.
2. All should be comfortably tappable without zooming.
3. Verify `Announcement Banner` (`announcement-banner.tsx`) doesn't block touch targets.

---

### TC-PWA-08: 6-Viewport Responsive Check

Test at each standard viewport:

| Viewport     | Width  | Device Category |
| ------------ | ------ | --------------- |
| Small Mobile | 375px  | iPhone SE       |
| iPhone       | 390px  | iPhone 14/15    |
| Android      | 412px  | Pixel 7         |
| Tablet       | 768px  | iPad            |
| Desktop      | 1440px | Standard        |
| Ultrawide    | 1920px | Full HD         |

For each: verify no horizontal overflow, no cramped tables on mobile, proper card layouts.

---

## 24. Role-Based Access Control (RBAC)

### RBAC Matrix — verify each cell both in UI AND via direct API calls:

| Feature / Capability            | owner | admin | agent         | viewer |
| ------------------------------- | ----- | ----- | ------------- | ------ |
| View all leads                  | ✅    | ✅    | ❌ (own only) | ✅     |
| Create/edit leads               | ✅    | ✅    | ✅            | ❌     |
| Move own deals                  | ✅    | ✅    | ✅            | ❌     |
| Move others' deals              | ✅    | ✅    | ❌ (403)      | ❌     |
| Send messages                   | ✅    | ✅    | ✅            | ❌     |
| Claim unassigned leads          | ✅    | ✅    | ✅            | ❌     |
| Release own leads to pool       | ✅    | ✅    | ✅            | ❌     |
| Reassign leads to any agent     | ✅    | ✅    | ❌            | ❌     |
| Create broadcasts               | ✅    | ✅    | ❌            | ❌     |
| View broadcasts                 | ✅    | ✅    | ✅            | ✅     |
| Invite/remove members           | ✅    | ✅    | ❌            | ❌     |
| Access Team Command Center      | ✅    | ✅    | ❌            | ❌     |
| Access Integrations             | ✅    | ✅    | ❌            | ❌     |
| Bulk reassign leads             | ✅    | ✅    | ❌            | ❌     |
| Configure routing rules         | ✅    | ✅    | ❌            | ❌     |
| Create/edit properties          | ✅    | ✅    | ❌            | ❌     |
| Share properties via WhatsApp   | ✅    | ✅    | ✅            | ✅     |
| View billing                    | ✅    | ❌    | ❌            | ❌     |
| Export CSV                      | ✅    | ✅    | ❌            | ❌     |
| Create/revoke API keys          | ✅    | ✅    | ❌            | ❌     |
| Edit account settings           | ✅    | ✅    | ❌            | ❌     |
| Delete account                  | ✅    | ❌    | ❌            | ❌     |
| Transfer ownership              | ✅    | ❌    | ❌            | ❌     |
| Manage lead (edit requirements) | ✅    | ✅    | ✅ (own only) | ❌     |

### TC-RBAC-01: Predicate Functions

Verify each predicate from `src/lib/auth/roles.ts`:

- `canManageMembers(role)` → true for admin, owner
- `canEditSettings(role)` → true for admin, owner
- `canSendMessages(role)` → true for agent, admin, owner
- `canViewOnly(role)` → true for viewer only
- `canDeleteAccount(role)` → owner only
- `canTransferOwnership(role)` → owner only
- `canMoveDeal(role, dealAssignedTo, contactAgentId, userId)` → admin+ always; agent only for own deals
- `canCreateBroadcast(role)` → admin+ only
- `canManageLead(role, assignedAgentId, userId)` → admin+ for all; agent for own only
- `canClaimLead(role, assignedAgentId)` → agent+ can claim if unassigned
- `canReassignLead(role)` → admin+ only
- `canReleaseLead(role, assignedAgentId, userId)` → admin+ for any; agent for own

### TC-RBAC-02: UI Hooks

1. `useCan` hook (`use-can.ts`) → verify `useCan('view-only')`, `useCan('manage-members')` return correct values.
2. `AccountAccessAlert` (`account-access-alert.tsx`) shows appropriate alerts for restricted roles.

> [!WARNING]
> All role checks MUST be enforced **server-side** (in route handlers). UI-only hiding is not sufficient. Verify with direct API calls for each role.

---

## 25. India Localization & Currency

### TC-L10N-01: INR Currency Formatting

Verify `formatINR()`, `formatINRRange()`, `formatCurrency()` from `src/lib/currency.ts`:

| Input Value | Expected Output |
| ----------- | --------------- |
| 4,500,000   | "₹45L"          |
| 10,000,000  | "₹1Cr"          |
| 15,000,000  | "₹1.5Cr"        |
| 75,000      | "₹75,000"       |

Budget ranges: "₹45L–60L", "₹1.5Cr–2Cr", "₹45L+" (no max).
Tests in `currency.test.ts`.

---

### TC-L10N-02: Indian Budget Parsing

Verify `parseBudget()` from `src/lib/contacts/parse-budget.ts`:

| Input     | Expected `budget_min` |
| --------- | --------------------- |
| "45L"     | 4,500,000             |
| "1.5Cr"   | 15,000,000            |
| "80 Lakh" | 8,000,000             |
| "1 Crore" | 10,000,000            |
| "75000"   | 75,000                |
| "1.5 cr"  | 15,000,000            |
| "85 lac"  | 8,500,000             |

---

### TC-L10N-03: Indian Phone Normalization

Verify `phoneVariants()` from `src/lib/whatsapp/phone-utils.ts`:

| Input             | Stored As       |
| ----------------- | --------------- |
| "09876543210"     | "+919876543210" |
| "+91 98765 43210" | "+919876543210" |
| "919876543210"    | "+919876543210" |
| "+919876543210"   | "+919876543210" |

Duplicate detection uses `phone_normalized` generated column.

---

### TC-L10N-04: Hinglish Automation Templates

1. Set `accounts.preferred_language = 'hi-en'`.
2. Trigger T-24h site visit automation → Hinglish WhatsApp message sent.
3. Set back to `'en'` → English template fires.

---

### TC-L10N-05: BHK Configuration Field

1. In property and lead forms, BHK config is a **chip selector** (not free-text).
2. Options: 1BHK, 2BHK, 3BHK, 4BHK, Studio, Villa, Plot, Commercial.
3. Multi-select works on lead `configuration_preference` and property `configuration`.
4. Constants from `PROPERTY_CONFIGURATIONS` in `src/types/index.ts`.

---

### TC-L10N-06: RERA Compliance

1. Properties without `rera_id` show amber warning: "RERA ID missing — required under RERA Act 2016."
2. Properties with `rera_id` show verified badge: "RERA: XX/2024/XXXXX".
3. Verify RERA fields in property forms and detail views.

---

### TC-L10N-07: Possession Status

Verify possession status rendering:

- `'ready_to_move'` → "Ready to Move" pill
- `'under_construction'` → "Under Construction" pill
- `'nearing_possession'` → "Nearing Possession" pill

---

### TC-L10N-08: Facing Directions

Property facing options: East, North, North-East, West, South, North-West, South-East, South-West.

---

## 26. Internationalization (i18n)

### TC-I18N-01: 4-Locale Parity

1. All 4 locale files exist with exact key hierarchy parity:
   - `messages/en.json` (English — source of truth)
   - `messages/es.json` (Spanish)
   - `messages/ko.json` (Korean)
   - `messages/pt.json` (Portuguese)
2. Run verification: `npx vitest run src/i18n/messages.test.ts` — all tests pass.

---

### TC-I18N-02: ICU Token Consistency

1. Every ICU placeholder (`{count}`, `{title}`, `{formatted}`) is identical across all 4 files.
2. Verified by `src/i18n/icu-safety.test.ts`.

---

### TC-I18N-03: No Hardcoded English

1. Grep for raw English strings in JSX files → should find none.
2. All user-facing strings use `const t = useTranslations('Namespace');`.
3. Switching locale (via `NEXT_PUBLIC_APP_LOCALE`) renders all strings in the target language.

---

### TC-I18N-04: Locale Switching

1. Set `NEXT_PUBLIC_APP_LOCALE=es` → restart dev server.
2. Verify all UI strings render in Spanish.
3. Repeat for `ko` and `pt`.

---

## 27. Real-Time & Presence

### TC-RT-01: Real-Time Message Updates

1. `useRealtime` hook (`use-realtime.ts`) — open two browser tabs logged as the same agent.
2. Send a message in one tab → message appears instantly in the other tab.
3. New conversation appears in conversation list without refresh.

---

### TC-RT-02: Presence Indicators

1. `usePresence` hook (`use-presence.ts`, ~5K) — tracks agent online/away/offline status.
2. `PresenceDot` and `PresenceHeartbeat` components in `components/presence/`.
3. Agent logs in → presence dot turns green (online) in team views.
4. Agent goes idle → dot turns yellow (away).
5. Agent logs out → dot turns grey (offline).
6. Stored in `member_presence` table.
7. Tested by `presence.test.ts`.

---

### TC-RT-03: Total Unread Count

1. `useTotalUnread` hook (`use-total-unread.ts`) → shows total unread message count in sidebar/bottom nav badge.
2. New inbound message → count increments in real-time.
3. Read a conversation → count decrements.

---

## 28. WhatsApp Webhook & Messaging Pipeline

### TC-WH-01: Webhook Handshake

```bash
GET /api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=<TOKEN>&hub.challenge=<CHALLENGE>
```

- Returns the `challenge` value if `verify_token` matches.
- Returns 403 if token doesn't match.

---

### TC-WH-02: Webhook Ingestion

```bash
POST /api/whatsapp/webhook
```

1. Valid `x-hub-signature-256` → processes payload (200).
2. Invalid signature → rejects (401).
3. **Deduplication:** Same `wamid` sent twice → second is ignored.
4. **Auto-create:** Message from unknown number → creates contact and conversation automatically.
5. **Auto-reopen:** Message into a closed conversation → conversation status changes to `open`.
6. **Media mirroring:** If `whatsapp_config.mirror_inbound_media = true`, media files are mirrored to Supabase Storage (since Meta URLs expire quickly).

---

### TC-WH-03: Outbound Send Pipeline

1. All sends go through `sendMessage()` in `lib/whatsapp/send-message.ts`.
2. **Phone normalization:** Indian variants handled (`+91`, `91`, leading `0`, etc.).
3. **Encrypted credentials:** Retrieved from `whatsapp_config` using `ENCRYPTION_KEY`.
4. **Auto-claim:** If conversation is unassigned and agent sends a reply, conversation is automatically assigned to that agent.
5. **Flow yield:** Sending an agent reply pauses any active flow run for that contact (`paused_by_agent`).

---

### TC-WH-04: Multi-WABA Support

1. If multiple WABAs are configured, webhook differentiates by `phone_number_id`.
2. `META_APP_SECRET` supports comma-separated values for multiple Meta Apps.

---

### TC-WH-05: Media Endpoints

```bash
POST /api/whatsapp/media         # Upload media
GET  /api/whatsapp/media/<id>    # Retrieve media
```

- Media stored in Supabase Storage (`lib/storage/`, `lib/media/`).

---

### TC-WH-06: WhatsApp Send Endpoint

```bash
POST /api/whatsapp/send
```

- Accepts: text, template, interactive, image, video, document, audio message types.
- 24-hour session window check enforced.

---

### TC-WH-07: WhatsApp Config & Templates

```bash
GET  /api/whatsapp/config        # Get current config
POST /api/whatsapp/config        # Update config
GET  /api/whatsapp/templates     # List Meta-approved templates
```

---

## 29. Lead Routing & Distribution Engine

### TC-ROUTE-01: Routing Rules Evaluation

1. Create a routing rule: "Source = 99acres → Assign to agent1".
2. Ingest a new lead from 99acres (via portal webhook).
3. Verify lead is assigned to `agent1` (not round-robin).

---

### TC-ROUTE-02: Budget-Based Routing

1. Create rule: "Budget >= ₹2Cr → Assign to senior agent".
2. Ingest a lead with `budget_min = 25000000`.
3. Verify correct assignment.

---

### TC-ROUTE-03: Round-Robin Fallback

1. Disable all routing rules.
2. Ingest a new lead.
3. Verify assignment to the agent with the **lowest open conversation count** among available agents.

---

### TC-ROUTE-04: Agent Availability Awareness

1. Set `agent1.is_available = false`.
2. Ingest a new lead → routing completely skips `agent1`.
3. If ALL agents are unavailable → lead remains unassigned; appears in Unassigned Pool.

---

### TC-ROUTE-05: Unassigned Pool Notification

1. Make all agents unavailable.
2. Ingest a new lead → lead is unassigned.
3. Admin/owner receives notification: "New unassigned lead: [Name]".
4. Lead appears in Team → Unassigned Pool and Inbox → "Unassigned" tab.

---

## 30. Cross-Module Wiring & Navigation

### TC-WIRE-01: Property → Schedule Visit

1. On a property detail page → click "Schedule Visit".
2. `ScheduleVisitSheet` opens with `defaultPropertyId` pre-filled.

---

### TC-WIRE-02: Lead → Schedule Visit

1. On a lead detail → click "Schedule Visit".
2. `ScheduleVisitSheet` opens with `defaultContactId` pre-filled.

---

### TC-WIRE-03: Property → WhatsApp Brochure

1. On a property → click "Share via WhatsApp".
2. Contact picker → select lead → navigates to `/inbox` with brochure message pre-filled.

---

### TC-WIRE-04: Lead → Inbox

1. On a lead detail → click "WhatsApp" button.
2. Opens the conversation in `/inbox` for that contact.

---

### TC-WIRE-05: Dashboard → Filtered Lists

1. Click a metric card (e.g., "Follow-ups Due") → navigates to filtered list.
2. Click a lead in "Recent Leads" → opens lead detail.
3. Click a visit in "Today's Visits" → navigates to site visits.

---

### TC-WIRE-06: Internal Routing

1. All internal navigation uses `useRouter().push()` — **NEVER `window.location.href`**.
2. Back navigation works correctly (browser back button).

---

## 31. Dark Mode & Theming

### TC-THEME-01: Mode Toggle

1. `ModeToggle` (`mode-toggle.tsx`) in sidebar/header → switch between Light / Dark / System.
2. Toggle immediately applies theme via CSS variables in `globals.css`.

---

### TC-THEME-02: Token Usage

1. Verify no raw hex codes in component JSX.
2. All colors use design tokens: `bg-background`, `bg-card`, `bg-card-2`, `bg-muted`, `text-foreground`, `border-border`, etc.
3. Chart colors use `--chart-1` through `--chart-5`.
4. Sidebar tokens: `--sidebar-*` (7 variables).
5. Theme utility functions in `lib/themes.ts`.

---

### TC-THEME-03: Dark Mode Rendering

1. Switch to dark mode → verify all pages render correctly:
   - No white flashes, no unreadable text, no invisible borders.
   - Charts, badges, pills all adapt to dark theme.
   - Form inputs have visible borders/focus states.

---

## 32. Automated Test Suite Verification

### TC-TEST-01: Full Test Suite

```bash
npm run test
```

1. **96 test suites with 1,076+ tests** must all pass.
2. Key test files to verify:
   - `src/i18n/messages.test.ts` — i18n parity
   - `src/i18n/icu-safety.test.ts` — ICU tokens
   - `src/lib/auth/roles.test.ts` — RBAC predicates
   - `src/lib/auth/account.test.ts` — account resolution
   - `src/lib/auth/api-context.test.ts` — API auth
   - `src/lib/auth/invitations.test.ts` — invite flow
   - `src/lib/contacts/dedupe.test.ts` — deduplication
   - `src/lib/contacts/parse-contact-csv.test.ts` — CSV parsing
   - `src/lib/contacts/tag-write.test.ts` — tag operations
   - `src/lib/contacts/tag-events.test.ts` — tag events
   - `src/lib/contacts/agent-scoping.test.ts` — agent isolation
   - `src/lib/currency.test.ts` — INR formatting
   - `src/lib/presence.test.ts` — presence tracking
   - `src/lib/rate-limit.test.ts` — rate limiting
   - `src/lib/broadcast-csv.test.ts` — broadcast CSV
   - `src/lib/broadcast-retry.test.ts` — broadcast retry
   - `src/lib/broadcast-status.test.ts` — broadcast status
   - `src/components/pipelines/deal-table.test.tsx` — deal table UI
   - `src/components/flows/flow-editor-state.test.ts` — flow editor
   - `src/components/flows/shared.test.ts` — flow shared utilities

---

### TC-TEST-02: TypeScript Compilation

```bash
npm run typecheck
```

Must exit with 0 errors.

---

### TC-TEST-03: Linting

```bash
npm run lint
```

Must pass with 0 errors.

---

### TC-TEST-04: Formatting

```bash
npm run format:check
```

Must pass (Prettier).

---

## 33. Known Issues & Error Log

> Document any test failures during your test pass below.

| #   | Test Case | Observed Behavior | Expected Behavior | Status |
| --- | --------- | ----------------- | ----------------- | ------ |
| 1   |           |                   |                   |        |
| 2   |           |                   |                   |        |
| 3   |           |                   |                   |        |

---

## Appendix A: Test Environment Quick Reference

```bash
# Start dev server
npm run dev

# Run type checks
npm run typecheck

# Run full test suite
npm run test

# Watch mode tests
npm run test:watch

# Check formatting
npm run format:check

# Format code
npm run format

# Lint
npm run lint

# i18n parity check only
npx vitest run src/i18n/messages.test.ts
```

---

## Appendix B: Supabase Quick Queries for Test Setup

```sql
-- Check a user's role
SELECT u.email, p.account_role, p.is_available
FROM profiles p
JOIN auth.users u ON u.id = p.user_id;

-- Set account to past_due (test billing gate)
UPDATE accounts SET subscription_status = 'past_due' WHERE id = '<account_id>';

-- Set preferred language to Hinglish
UPDATE accounts SET preferred_language = 'hi-en' WHERE id = '<account_id>';

-- Check portal connections
SELECT id, name, portal_connections FROM accounts;

-- View unassigned conversations
SELECT c.id, co.name, c.created_at
FROM conversations c
LEFT JOIN contacts co ON co.id = c.contact_id
WHERE c.assigned_agent_id IS NULL AND c.status = 'open';

-- View stale leads (no activity 48h+)
SELECT c.id, c.name, c.updated_at
FROM contacts c
WHERE c.updated_at < now() - INTERVAL '48 hours';

-- Check tasks due today
SELECT t.title, t.due_at, t.done, t.assigned_to
FROM tasks t
WHERE t.due_at::date = now()::date AND t.done = false;

-- Check agent targets for current month
SELECT at.user_id, p.user_id, at.target_visits, at.month
FROM agent_targets at
JOIN profiles p ON p.id = at.user_id;

-- Check routing rules
SELECT * FROM lead_routing_rules ORDER BY priority;

-- Check assignment history for a contact
SELECT ah.*, p_from.user_id as from_user, p_to.user_id as to_user
FROM assignment_history ah
LEFT JOIN profiles p_from ON p_from.user_id::text = ah.from_agent_id::text
LEFT JOIN profiles p_to ON p_to.user_id::text = ah.to_agent_id::text
ORDER BY ah.created_at DESC LIMIT 10;

-- Check lost reasons for an account
SELECT * FROM lost_reasons WHERE account_id = '<account_id>';

-- View API keys (hashed)
SELECT id, name, scopes, created_at, revoked_at FROM api_keys;
```

---

## Appendix C: API Testing with cURL

```bash
# Set your API key and base URL
export API_KEY="wacrm_live_your_key_here"
export BASE="http://localhost:3000"

# === Public API v1 ===

# List contacts (paginated)
curl -H "Authorization: Bearer $API_KEY" "$BASE/api/v1/contacts?page=1&limit=10"

# Create a contact
curl -X POST "$BASE/api/v1/contacts" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Lead","phone":"+919876543210"}'

# Get a single contact
curl -H "Authorization: Bearer $API_KEY" "$BASE/api/v1/contacts/<uuid>"

# Create a property
curl -X POST "$BASE/api/v1/properties" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Prestige Elm Park","location":"Noida","price":7500000,"configuration":"3BHK","rera_id":"UP/2024/12345","builder_name":"Prestige Group","carpet_area":1250,"facing":"East","possession_status":"under_construction"}'

# Schedule a site visit
curl -X POST "$BASE/api/v1/site-visits" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contact_id":"<uuid>","scheduled_at":"2026-10-25T10:00:00Z","pickup_required":true,"pickup_location":"Sector 18 Metro Station"}'

# List conversations
curl -H "Authorization: Bearer $API_KEY" "$BASE/api/v1/conversations"

# Get messages for a conversation
curl -H "Authorization: Bearer $API_KEY" "$BASE/api/v1/messages?conversation_id=<uuid>"

# List broadcasts
curl -H "Authorization: Bearer $API_KEY" "$BASE/api/v1/broadcasts"

# Register a webhook
curl -X POST "$BASE/api/v1/webhooks" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/hook","events":["contact.created","deal.updated"]}'

# Get current user/account info
curl -H "Authorization: Bearer $API_KEY" "$BASE/api/v1/me"

# === Internal APIs (session-auth required, use browser cookies) ===

# Test stale leads cron
curl -H "x-cron-secret: $CRON_SECRET" "$BASE/api/cron/stale-leads"

# Test weekly report cron
curl -H "x-cron-secret: $CRON_SECRET" "$BASE/api/cron/weekly-report"

# Test site visits cron
curl -H "x-cron-secret: $CRON_SECRET" "$BASE/api/cron/site-visits"
```

---

## Appendix D: Internal API Route Inventory

> For internal APIs (session-auth, not API key), the following routes exist:

| Route Group          | Endpoints                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `/api/account`       | Account CRUD, `api-keys/`, `invitations/`, `members/`, `portal-connections/`, `routing-rules/`, `targets/`, `transfer-ownership/` |
| `/api/ai`            | `autoreply/`, `config/`, `draft/`, `knowledge/`, `playground/`, `test/`, `usage/`                                                 |
| `/api/automations`   | Automation CRUD and execution                                                                                                     |
| `/api/billing`       | `checkout/`, `portal/`, `webhook/`                                                                                                |
| `/api/contacts`      | Contact CRUD, `[id]/tags/`, `bulk/`, `export/`, `import/`                                                                         |
| `/api/cron`          | `site-visits/`, `stale-leads/`, `weekly-report/`                                                                                  |
| `/api/dashboard`     | Dashboard metrics aggregation                                                                                                     |
| `/api/deals`         | Deal CRUD (`[id]/`), `export/`                                                                                                    |
| `/api/flows`         | Flow CRUD and execution                                                                                                           |
| `/api/invitations`   | Invite acceptance (`[token]/`)                                                                                                    |
| `/api/push`          | Push notification `subscribe/`                                                                                                    |
| `/api/quick-replies` | Quick replies CRUD                                                                                                                |
| `/api/tasks`         | Tasks CRUD                                                                                                                        |
| `/api/webhooks`      | Inbound email webhook (`inbound-email/`)                                                                                          |
| `/api/whatsapp`      | `broadcast/`, `config/`, `media/`, `react/`, `send/`, `templates/`, `webhook/`                                                    |

---

## Appendix E: Key Component File Reference

| Component Area  | Key Files (in `src/components/`)                                                                                                                                                                                                                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inbox**       | `conversation-list.tsx` (27K), `message-thread.tsx` (53K), `message-composer.tsx` (35K), `contact-sidebar.tsx` (31K), `template-picker.tsx` (15K), `message-bubble.tsx` (11K), `media-lightbox.tsx` (10K), `ai-thread-banner.tsx` (7K), `message-media.tsx` (8K), `quick-reply-picker.tsx` (4K), `message-actions.tsx` (5K), `message-reactions.tsx` (2K), `reply-quote.tsx` (3K) |
| **Contacts**    | `contact-detail-view.tsx` (62K), `contact-form.tsx` (48K), `import-modal.tsx` (26K), `cost-sheet-modal.tsx` (20K), `custom-fields-manager.tsx` (9K), `bulk-reassign-modal.tsx` (3K)                                                                                                                                                                                               |
| **Properties**  | `property-form-modal.tsx` (24K), `property-share-modal.tsx` (14K), `emi-calculator.tsx` (5K), `property-delete-dialog.tsx` (3K)                                                                                                                                                                                                                                                   |
| **Pipelines**   | `pipeline-board.tsx` (35K), `deal-form.tsx` (29K), `deal-table.tsx` (16K), `pipeline-settings.tsx` (15K), `deal-card.tsx` (10K), `pipeline-analytics.tsx` (8K), `lost-reason-modal.tsx` (7K), `brokerage-badge.tsx` (1K)                                                                                                                                                          |
| **Flows**       | `flow-canvas.tsx` (28K), `flow-builder.tsx` (20K), `flow-editor-state.tsx` (17K), `shared.tsx` (16K), `flow-editor-shell.tsx` (8K), `header.tsx` (7K), `validation-panel.tsx` (4K)                                                                                                                                                                                                |
| **Settings**    | `template-manager.tsx` (46K), `whatsapp-config.tsx` (42K), `members-tab.tsx` (26K), `ai-config.tsx` (18K), `ai-knowledge.tsx` (16K), `api-keys-settings.tsx` (16K), `invite-member-dialog.tsx` (14K), `profile-form.tsx` (12K), `routing-settings.tsx` (12K), `cost-sheet-config.tsx` (12K), `settings-overview.tsx` (10K)                                                        |
| **Site Visits** | `schedule-visit-sheet.tsx` (40K), `visit-delete-dialog.tsx` (4K)                                                                                                                                                                                                                                                                                                                  |
| **Team**        | `agent-table.tsx` (13K), `agent-card.tsx` (10K), `unassigned-pool.tsx` (8K), `agent-target-modal.tsx` (5K), `pipeline-funnel.tsx` (4K)                                                                                                                                                                                                                                            |
| **Broadcasts**  | `step2-select-audience.tsx` (27K), `step3-personalize.tsx` (17K), `step4-schedule-send.tsx` (16K), `step1-choose-template.tsx` (8K)                                                                                                                                                                                                                                               |
| **Dashboard**   | `conversations-chart.tsx` (13K), `tasks-widget.tsx` (8K), `activity-feed.tsx` (7K), `pipeline-donut.tsx` (6K), `quick-actions.tsx` (4K), `response-time-chart.tsx` (4K), `metric-card.tsx` (3K)                                                                                                                                                                                   |
| **Layout**      | `sidebar.tsx` (17K), `command-palette.tsx` (13K), `header.tsx` (9K), `notification-popover.tsx` (8K), `browser-notifications-card.tsx` (7K), `bottom-nav.tsx` (5K), `pull-to-refresh.tsx` (3K)                                                                                                                                                                                    |
| **Onboarding**  | `team-setup-checklist.tsx` (3K), `whatsapp-setup-checklist.tsx` (3K)                                                                                                                                                                                                                                                                                                              |
| **AI Agents**   | `ai-playground.tsx` (16K), `ai-usage.tsx` (8K)                                                                                                                                                                                                                                                                                                                                    |
