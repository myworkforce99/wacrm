# Implementation Plan — B2B Real Estate Team CRM on wacrm

### For execution by an AI coding agent (Claude Code / Gemini CLI)

**Product context (updated 2026-09-27):** This is a **B2B SaaS** sold to Indian real estate businesses — teams of 10–30 agents managed by a business owner/broker. The buyer is the **business owner**. The daily users are their **sales agents and managers**. Revenue model: per-seat subscription. This is NOT a consumer product. Every feature decision must be evaluated through the lens of: "does this help a broker manage their 15-agent WhatsApp sales team more effectively?"

This file is fed to the agent one **section** at a time — not all at once. Each section is scoped to be a single agent session's worth of work (roughly one PR).

> **Read `docs/agent/ARCHITECTURE.md`, `docs/agent/SCHEMA_REFERENCE.md`, and `docs/agent/AGENT_GUARDRAILS.md` before starting any section below.** Those three documents were produced by directly inspecting this repo's actual code. Where this plan and those documents disagree, the documents win; update this plan's text rather than the code.

**Naming convention:** The codebase entity is `contacts`/`Contact`, not `leads`/`Lead`, throughout the schema, types, and ~40+ files. Do not rename — display "Lead" in the UI via `next-intl` message keys while `Contact`/`contacts` stays the code-level name everywhere.

---

## 0. Operating rules for the agent (read first, every session)

1. **One section = one branch = one PR.** Do not combine sections. Do not start section N+1 before section N is merged.
2. **Before writing any code in a section**, do a short reconnaissance pass: read 2-3 existing files in the directory you're about to touch and match their conventions (naming, error handling, RLS patterns, component structure). Do not introduce a new pattern where an existing one already works.
3. **Never modify or renumber existing Supabase migration files.** New schema changes are always a new migration file, numbered after the current highest number in `supabase/migrations/`.
4. **Never alter an existing RLS policy without flagging it explicitly in the PR description** as a security-relevant change. Tenant isolation is the most important invariant in this codebase.
5. **After every task:** run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test`. A task is not done if any of these fail.
6. **Write or update tests** for new API routes and new database functions/views as part of the same task, not as a follow-up.
7. **Update `PROGRESS.md`** by checking off the task ID when a section is complete, with the PR link.
8. **When a task is ambiguous**, pick the most conservative option that matches existing repo conventions, note the assumption in the PR description, and proceed.
9. **Mobile-first means mobile-first**: every new screen is built for ~390px viewport first, then checked at desktop width.
10. **B2B team awareness**: every screen has at least two distinct user types — (a) the **agent** who works their own leads, and (b) the **admin/owner** who oversees the whole team. Role-gate data access server-side (`requireRole`) AND scope queries: agents query only their assigned contacts/conversations; admins query the full account. Never build a screen that accidentally exposes one agent's data to another agent.

---

## Section A — Repo Reconnaissance & Environment

_Goal: environment only. A1 is done — `docs/agent/ARCHITECTURE.md` already covers it — so this section is now just standing up working environments._

- ~~**A1.** Produce `ARCHITECTURE.md`~~ — **done.** Read `docs/agent/ARCHITECTURE.md` instead of redoing this; if it's missing something you need, extend that file rather than writing a new one.
- **A2.** Stand up a fresh Supabase project for local dev, run all existing migrations in order, seed minimal test data (one account, two users, a few contacts), confirm `npm run dev` boots cleanly and the existing desktop UI works end-to-end.
- **A3.** Stand up a second Supabase project for staging; document env var differences against `.env.local.example` (the repo's actual example file — note the exact name).
- **A4.** Confirm CI runs `lint`, `typecheck`, `format:check`, and `test` on every PR (the exact scripts in `package.json` — see `ARCHITECTURE.md` §1); add whichever is missing.

**Definition of done:** a fresh clone + `npm install` + `npm run dev` works from a clean checkout by following only the repo's own `CONTRIBUTING.md`.

---

## Section B — Design Tokens & Mobile Shell Foundation

_Goal: the reusable layer every later screen depends on. **Revised from the original plan** — `src/app/globals.css` already has a full shadcn/base-ui token set (`--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--chart-1..5`, `--sidebar_`, light+dark via `components.json`'s `cssVariables: true`), and `components/ui/`already has`button.tsx`, `badge.tsx`, `card.tsx`, `avatar.tsx`, `dialog.tsx`, `sheet.tsx`. This section is now mostly extension, not creation.\*

- **B1.** _(revised)_ **Extend**, don't replace, the existing token set in `globals.css`: add semantic status-color variables for the five real-estate pipeline stages (new/contacted/site-visit/negotiation/closed) and SLA-badge thresholds (Section F), following the same `--name: value` convention already there.
- **B2.** _(revised)_ Audit `components/ui/` first. `Button`, `Card`, `Avatar` already exist — use them. Check whether `badge.tsx` already covers the status/source-pill variants needed, extending its `cva` variants if not, rather than writing a new component. Check whether `sheet.tsx` already supports a bottom-anchored variant before building a separate `BottomSheet` — Sheet components in this style of shadcn setup often do via a `side` prop. `dashboard/empty-state.tsx` and `dashboard/skeleton.tsx` **already exist** — reuse them; only build new versions if they're desktop-shaped in a way that doesn't adapt. The genuinely new primitive here is `TopAppBar` (not present anywhere in the repo). Minimum 44×44px touch targets on anything new.
- **B3.** Build `BottomNav` (5 items: Dashboard, Leads, Pipeline, Visits, Inbox — "Leads" is a UI label over the `contacts` route, see the naming note above) and a `MoreSheet` route for everything else (Automations, Flows, Broadcasts, Team, Settings, Integrations). This is genuinely new — no equivalent exists (the current nav is `components/layout/sidebar.tsx`, desktop-only).
- **B4.** Wire a responsive split: mobile shell (bottom nav + top app bar) active below the `md` breakpoint; existing desktop sidebar layout preserved above it. Do not delete the desktop layout.
- **B5.** Add `viewport-fit=cover` meta tag and `env(safe-area-inset-*)` padding on the app shell root.

**Definition of done:** Storybook-style demo page (or a `/dev/components` route) renders every primitive in both themes; navigating the app on a 390px viewport shows the bottom nav, on desktop shows the existing sidebar.

---

## Section C — Core Screens: Mobile-Responsive Pass (Mobile)

_Goal: **revised** — every one of these pages already exists and works on desktop (`app/(dashboard)/dashboard/`, `contacts/`, `pipelines/`, `inbox/`). This section is a responsive/mobile-layout pass plus one new B2B gate (C6)._

> **Status note (verified 2026-09-27):** C1–C5 are **all done** — the mobile shell, bottom nav, and responsive passes over Dashboard, Leads, Pipeline, Site Visits, and Inbox are complete. One B2B-critical gap remains:

- **C6.** _(new — B2B pipeline gate)_ **Deal-move permission guard on pipelines.** Currently `canSendMessages` (true for `agent` and above) implicitly allows any agent to move any deal — including deals belonging to colleagues. In a 15-agent team this causes accidental deal poaching and misattribution.
  - In the `PATCH /api/deals/[id]` route handler (find it under `app/api/deals/[id]/route.ts` or equivalent): after the existing role check, add an ownership guard: if `role === 'agent'`, verify that `deals.assigned_to === currentUserId` OR `conversations.assigned_agent_id === currentUserId` for that deal's contact. If neither matches, return `403 { error: 'DEAL_NOT_YOURS', message: 'You can only move your own deals. Ask your admin to reassign it first.' }`.
  - In the Pipeline board's "Move to…" bottom sheet (`components/pipelines/`): if the PATCH returns `DEAL_NOT_YOURS`, show a toast: "This lead belongs to [Agent Name]. Contact your admin to move it."
  - `admin+` roles bypass this guard — they can move any deal.
  - Add a `canMoveDeal(role, dealAssignedTo, currentUserId)` predicate to `src/lib/auth/roles.ts` following the existing predicate pattern.

**Definition of done (C6 only):** an agent attempting to PATCH a deal assigned to another agent via the API receives a 403; the Pipeline UI shows the correct toast; admin can move any deal freely; `npm run typecheck && npm run lint && npm run test` pass.

- ~~**C1.**~~ Done — Dashboard mobile layout, 4-stat grid, Recent Leads widget, Today's Visits widget, Quick-action bar.
- ~~**C2.**~~ Done — Leads list mobile pass, source badges, filter chips, swipe actions.
- ~~**C3.**~~ Done — Lead detail mobile pass.
- ~~**C4.**~~ Done — Pipeline mobile variant (swipeable stage tabs, deal cards with source badge, "Move to…" bottom sheet).
- ~~**C5.**~~ Done — Inbox mobile responsive pass.

---

## Section D — Real Estate Data Model Extensions

_Goal: the schema additions everything from Section E onward depends on._

> **Status note (verified 2026-09-27):** D1–D5 are **all done** via migrations `100_real_estate_schema.sql`, `101_site_visits_automations.sql`, and the public API routes at `src/app/api/v1/properties/` and `src/app/api/v1/site-visits/`. The `lead_details`, `properties`, and `site_visits` tables exist with correct RLS. One gap remains:

- **D6.** _(new — 1-line migration)_ Add `source TEXT` column to `lead_details`. The current `LeadDetail` interface in `src/types/index.ts` (lines ~143–154) has `budget_min`, `budget_max`, `location_preference`, `property_type`, `intent` but **no `source` field**. This field is required for the source badges in C2 and C4 and for the Integrations page (Section O).
  - New migration `105_lead_source.sql`: `ALTER TABLE lead_details ADD COLUMN IF NOT EXISTS source TEXT;`
  - Update `src/types/index.ts`'s `LeadDetail` interface: add `source?: string;` with a doc-comment: `/** Portal this lead came from, e.g. '99acres', 'MagicBricks', 'Housing.com', 'Manual'. Set by the email parser (Section M) or manually via the contact form. */`
  - Update `components/contacts/contact-form.tsx`: add a "Source" `<Select>` field with options: 99acres, MagicBricks, Housing.com, Manual (and a free-text "Other" option). This field maps to `lead_details.source` — upsert `lead_details` alongside the contact on save.
  - Section M's email parser (`app/api/whatsapp/webhook/` or the inbound email handler) should write `lead_details.source` from the parsed portal name — confirm it does and add the write if missing.
  - No new API route needed; the existing dashboard Supabase client queries `lead_details` directly.

**Definition of done (D6 only):** migration `105_lead_source.sql` applies cleanly on top of existing migrations; `LeadDetail.source` appears in TypeScript types; source is saveable from the contact form and shows the correct badge in the Leads list (C2) and Pipeline cards (C4).

- ~~**D1.**~~ Done — `lead_details` table (migration 100).
- ~~**D2.**~~ Done — `site_visits` table (migration 100 + 101).
- ~~**D3.**~~ Done — `properties` table (migration 100).
- ~~**D4.**~~ Done — Real Estate pipeline seeded in `handle_new_user` trigger (migration 100).
- ~~**D5.**~~ Done — `api/v1/properties/` and `api/v1/site-visits/` CRUD routes.

---

## Section E — Site Visits: UI + No-Show Automation

_Goal: directly targets the ~20-35% industry no-show rate — this is one of the highest-value sections in the whole plan._

- **E1.** Site Visits list screen (mobile): day-grouped, status pill, one-tap call/WhatsApp.
- **E2.** "Schedule Visit" bottom-sheet form: pick lead, optionally link a property, date/time.
- **E3.** Automation recipes (pre-seeded, on by default for real-estate-template accounts): T-24h confirmation message, T-2h reminder with location, and a no-show recovery message sent automatically if a visit passes without confirmation. Build these as records in the existing Automations engine, not new bespoke logic.
- **E4.** One-tap confirm/reschedule actions on the visit updating `site_visits.status`.

**Definition of done:** scheduling a visit in the UI creates the correct Automation-trigger state; a simulated T-24h/T-2h/no-show scenario (test with fast-forwarded timestamps) sends the correct WhatsApp template at each step.

---

## Section F — Response SLA & Lead Ownership Visibility

_Goal: targets the response-speed and lead-ownership-dispute problems directly — make both visible in the UI, not just logged in the DB._

- **F1.** Add "time since first unanswered inbound message" to the lead list/detail query.
- **F2.** `SlaBadge` component: green under threshold A, amber between A and B, red beyond B — thresholds configurable per account, sane defaults (e.g., 5 min / 30 min).
- **F3.** _(note)_ `deals.assigned_to` and `conversations.assigned_agent_id` already exist as current-state fields (see `SCHEMA_REFERENCE.md`) — this task is adding the **history table** that doesn't exist yet, not the assignment field itself. New migration for an assignment-audit table recording every change — lead, from-agent, to-agent, actor, timestamp, reason (manual/automation/round-robin).
- **F4.** Lead detail: "Assigned to [agent]" with a tappable history showing the full audit trail.
- **F5.** Confirm the default qualification Flow fires automatically on every new lead for real-estate-template accounts unless explicitly disabled in Settings — verify against the existing Flow trigger config rather than adding new trigger logic.

**Definition of done:** SLA badge changes color correctly against seeded timestamps; reassigning a lead writes an audit row and it's visible in the UI immediately.

---

## Section G — Team / Manager Dashboard

_Goal: owner/admin-only visibility the research shows brokers specifically need for accountability._

- **G1.** New role-gated route (`owner`/`admin` only): per-agent response time, leads worked, visits completed vs. no-show rate, conversion rate.
- **G2.** _(revised)_ `lib/dashboard/queries.ts` and `lib/dashboard/types.ts` already exist as the query layer behind the current (personal) Dashboard — extend that module with the per-agent aggregation queries rather than starting a new query file. Implement as SQL views/aggregation queries over existing + Section D/F tables — avoid new tables here.
- **G3.** Mobile-responsive table/card list UI, consistent with Section B primitives.

**Definition of done:** an `agent` role cannot reach this route (server-side check, not just hidden nav); an `admin` sees correct aggregate numbers against seeded test data.

---

## Section H — Properties & Lead Matching

_Goal: automates the manual "which listings fit this buyer" work agents currently do by hand._

- **H1.** Properties list screen: filter by location/budget/type.
- **H2.** Property detail screen.
- **H3.** "Match" action on lead detail: query `properties` against that lead's budget/location/type, surface top 2-3, one-tap "send via WhatsApp" reusing the existing message-send API/template mechanism.

**Definition of done:** matching query returns relevant results against seeded property + lead data; sending a match posts an actual outbound WhatsApp message in a test/staging number.

---

## Section I — Onboarding Wizard & Real Estate Template

_Goal: this is effectively your product demo — treat its polish as seriously as Section C._

- **I1.** _(revised)_ `app/(auth)/signup/page.tsx` and the WhatsApp connect flow (`app/api/whatsapp/config/`, `components/settings/whatsapp-config.tsx`) already exist separately — this task is **sequencing existing pieces into one wizard**, not building WhatsApp connection logic from scratch. Signup wizard: account creation → WhatsApp number connect (reusing the existing config component/route) → pipeline template selection (default: real estate, from D4) → team invite (reusing `components/settings/invite-member-dialog.tsx`'s underlying logic).
- **I2.** Seed the real-estate qualification Flow (from F5 default) automatically at signup.
- **I3.** Role-aware nav: hide Team/Settings/Integrations for `agent` role; keep visible for `owner`/`admin`.
- **I4.** Mobile-polished invite/join screen.

**Definition of done:** a brand-new signup, done entirely on a mobile viewport, ends with a working WhatsApp-connected account, real-estate pipeline, and an active qualification bot, with zero manual DB intervention.

---

## Section J — Automations, Flows & Broadcasts: Real Estate B2B Extensions

_Goal: the upstream automation, flows, and broadcast engines are fully built — this section extends them with real estate team–specific content and closes B2B-critical gaps._

> **Status note (verified 2026-09-27):** J1–J2 (mobile recipe list + builder gate) are **done**. Three upstream features exist but are underutilised for a B2B team context:
> - **Automations** (`app/(dashboard)/automations/page.tsx`, 438 lines) — recipes exist but none cover RE-specific flows or team routing.
> - **Flows** (`app/(dashboard)/flows/page.tsx`, 508 lines) — fully functional conversation-bot builder, but no seeded RE qualifier flow.
> - **Broadcasts** (`app/(dashboard)/broadcasts/page.tsx`, 308 lines) — works, but `canCreate` uses `canSendMessages(role)` which is true for **every `agent`** — any agent can blast the entire contact list. Gap: needs admin gate + segment targeting tied to `lead_details`.

- **J3.** _(new — broadcast admin gate)_ **Gate broadcast creation to `admin+` roles only.** Currently `canSendMessages` is `hasMinRole(role, 'agent')`, so any agent in a 15-person team can broadcast to all 500 contacts.
  - Add a new predicate `canCreateBroadcast(role: AccountRole): boolean` to `src/lib/auth/roles.ts`: `return hasMinRole(role, 'admin');`. Add `'create-broadcast'` to the `CanAction` union in `src/hooks/use-can.ts` mapping to this predicate.
  - In `app/(dashboard)/broadcasts/page.tsx` and `app/(dashboard)/broadcasts/new/page.tsx`: replace `canCreate = useCan('send-messages')` with `canCreate = useCan('create-broadcast')`.
  - In the API route that creates broadcasts (find under `app/api/broadcasts/` — read the route file first): add `requireRole('admin')` at the top of the POST handler. This is the hard server-side enforcement; the UI gate alone is not sufficient.
  - Agents retain full access to **view** broadcast results (the list page and detail page) — they just cannot create new ones.

- **J4.** _(new — broadcast segment targeting by lead details)_ **Add real estate–specific audience segments to the broadcast creation wizard.** Currently Step 2 (`components/broadcasts/step2-select-audience.tsx`) supports: All, Tags, Custom Field, CSV. Add a new audience type: **Lead Details Segment** — letting the admin filter recipients by `lead_details` fields.
  - New audience type value: `'lead_segment'`. UI: a filter builder with up to 3 conditions combined with AND: `configuration_preference contains 2BHK`, `location_preference contains Noida`, `budget_min >= 5000000`, `source = 99acres`, `stage = New`. These map directly to `lead_details` columns from Section R2.
  - On send, the audience resolution (wherever `useBroadcastSending` calls to expand recipient list — trace through `hooks/use-broadcast-sending.ts` and the API it calls): for `lead_segment` type, query contacts joined with `lead_details` applying the filter conditions, deduplicate by `phone_normalized`, return matching contact IDs.
  - Add `lead_segment` to the audience type union in `src/types/index.ts`'s broadcast-related types.
  - This is a pure JS/SQL addition — no new migration needed (`lead_details` columns exist after R2).

- **J5.** _(new — pre-seeded RE broadcast templates)_ **Seed real estate broadcast message templates** in a new migration `116_re_broadcast_templates.sql`. Add three rows to the `quick_replies` table (kind = `'broadcast_template'` — confirm the existing `kind` enum or use a different mechanism by reading the `quick_replies` table definition first; if `kind` is too restrictive, store as a separate `broadcast_templates` helper table seeded alongside `quick_replies`):
  - **Diwali Offer 🪔**: `"Namaste {{contact_name}} ji! 🎉 Is Diwali, humne aapke liye ek khaas property offer select ki hai. {{property_title}} — sirf ₹{{price}} mein. Site visit book karein aaj hi! 🏠"`
  - **New Project Launch 🏠**: `"{{contact_name}} ji, exciting news! Nayi property launch — {{property_title}} in {{location}}. {{configuration}} BHK from ₹{{price}}. RERA: {{rera_id}}. Limited units — reply YES to book a priority visit."`
  - **Price Drop Alert 📉**: `"{{contact_name}} ji, price drop alert! {{property_title}} ({{configuration}} BHK, {{location}}) ki price ab ₹{{price}} ho gayi hai — pehle ₹{{old_price}} thi. Abhi enquire karein!"`
  These appear as quick-select options in broadcast Step 1 (Choose Template), filterable by tag `real-estate`. Confirm the template seeding mechanism by reading `migrations/003_*.sql` or whichever migration first seeds `quick_replies`.

- **J6.** _(new — Real Estate Qualifier Flow)_ **Seed a "Real Estate Qualifier" conversation Flow** that auto-qualifies new WhatsApp leads before routing them to an agent. This is the highest-leverage use of the existing Flows engine for a real estate team — it replaces the manual tele-caller qualification call.
  - In migration `117_re_qualifier_flow.sql`, insert a `flows` record (read `supabase/migrations/010_flows.sql` for the exact schema first) with:
    - Name: `"Real Estate Qualifier (Auto)"`
    - Status: `disabled` by default — admin enables it from the Flows page
    - Trigger: `new_contact_created` (same trigger type used in automations)
    - Steps (as a JSON node graph per the `flows` table structure):
      1. **Welcome** → send message: `"Namaste {{contact_name}} ji! 🙏 Thank you for your interest. Let me help you find the perfect property. What is your budget? (Reply with a number)"`
      2. **Budget capture** → `update_contact_field`: write response to `lead_details.budget_max` (parse L/Cr notation using the same regex from Section U1's `lib/contacts/parse-budget.ts`).
      3. **BHK ask** → send message with buttons: `"Which configuration are you looking for?"` → button options: 1BHK / 2BHK / 3BHK / 4BHK+
      4. **BHK capture** → `update_contact_field`: write to `lead_details.configuration_preference`.
      5. **Location ask** → send message: `"Which location/area do you prefer?"`
      6. **Location capture** → `update_contact_field`: write to `lead_details.location_preference`.
      7. **Routing** → `assign_conversation` with `mode: 'round_robin'` (now fixed by Section S1) — routes to the least-loaded available agent after qualification is complete.
  - **Important:** read `src/lib/automations/engine.ts` and the flows execution path before writing the migration — use whatever step `type` values the engine actually supports (`send_message`, `update_contact_field`, `assign_conversation`). Do not invent new step types.
  - This flow appears in the Flows page list as a pre-built recipe. Enabling it from the Flows toggle (J1's recipe list) sets its status to `active`.

**Definition of done:** (a) an agent attempting to create a broadcast via the API receives 403; the UI broadcast button is hidden for `agent` role; (b) the "Lead Details Segment" audience type in the broadcast wizard correctly resolves recipients filtered by BHK or location; (c) the three RE broadcast templates appear in Step 1's template list under a "Real Estate" group; (d) enabling the "Real Estate Qualifier" flow from the Flows page causes a new WhatsApp lead to receive the qualification message sequence; after answering all three questions the conversation is auto-assigned to an available agent; (e) `npm run typecheck && npm run lint && npm run test` pass.

- ~~**J1.**~~ Done — Mobile recipe toggle list for Automations.
- ~~**J2.**~~ Done — Full drag-and-drop builder gated to `md`+ viewport.

---

## Section K — PWA & Native-Feel Polish

_Goal: this section is what actually earns "feels like a native app," on top of Section B's shell work._

- **K1.** Web manifest (name, icon set, `display: standalone`, theme color) + all required icon sizes.
- **K2.** Service worker: app-shell caching, offline fallback page.
- **K3.** Web push: subscription flow + server-side push on new-lead and visit-reminder events.
- **K4.** Pull-to-refresh on list screens, skeleton loaders (reuse Section B `Skeleton`), sparing `navigator.vibrate` on key confirmations.

**Definition of done:** app installs to home screen on both Android Chrome and iOS Safari; a push notification fires end-to-end in staging; Lighthouse PWA checklist passes.

---

## Section L — Billing & Plan Gating

_Goal: the one piece genuinely missing from wacrm — required before charging anyone._

> **Codebase state (verified 2026-09-27):** No Stripe/billing dependency in `package.json`. The `Account` interface in `src/types/index.ts` has only `id`, `name`, `owner_user_id`, `created_at`, `updated_at` — no subscription fields. The `accounts` table (migration 017) has no billing columns. Highest existing migration is `104_push_subscriptions.sql`. Start new migrations at `106_billing.sql` (assuming D6 takes `105`).

- **L1.** New migration `106_billing.sql`:
  ```sql
  ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trialing'
      CHECK (subscription_status IN ('trialing','active','past_due','canceled','paused')),
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'starter'
      CHECK (plan_tier IN ('starter','growth','pro')),
    ADD COLUMN IF NOT EXISTS seat_limit INTEGER NOT NULL DEFAULT 3;
  ```
  Update `src/types/index.ts`'s `Account` interface — add all six new fields with doc-comments explaining each. Then install Stripe: `npm install stripe` (server-only — do not add `@stripe/stripe-js` unless a client-side element is needed). Add to `.env.local.example`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STARTER_PRICE_ID`, `STRIPE_GROWTH_PRICE_ID`, `STRIPE_PRO_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

- **L2.** New API routes — follow the `try/catch → toErrorResponse` pattern from every other route file:
  - `app/api/billing/checkout/route.ts` — `POST`: creates a Stripe Checkout Session (`mode: 'subscription'`). Set `client_reference_id` to `accountId` (used by the webhook to look up the account). Set `metadata.plan_tier` to the plan name from the request body. Set `success_url` to `${NEXT_PUBLIC_SITE_URL}/settings?billing=success` and `cancel_url` to `${NEXT_PUBLIC_SITE_URL}/settings`. Requires `requireRole('owner')`. Return `{ url: session.url }` — the client does `window.location.href = url`.
  - `app/api/billing/portal/route.ts` — `POST`: creates a Stripe Billing Portal session using `stripe_customer_id` from the account row. Requires `requireRole('owner')`. Return `{ url: session.url }`.
  - `app/api/billing/webhook/route.ts` — `POST`: **do NOT use `requireRole`** — authenticated via `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`. Read the raw body with `request.text()` (not `request.json()`) before constructing the event — Stripe requires the raw bytes for signature verification. Use the Supabase service-role client for all DB writes (no user session in a webhook). Handle:
    - `checkout.session.completed`: set `subscription_status='active'`, `stripe_customer_id`, `stripe_subscription_id`, `plan_tier` (from `session.metadata.plan_tier`), `current_period_end` (from `session.subscription` expand). Match account via `client_reference_id`.
    - `invoice.payment_succeeded`: update `current_period_end` from `invoice.lines.data[0].period.end`.
    - `invoice.payment_failed`: set `subscription_status='past_due'`.
    - `customer.subscription.deleted`: set `subscription_status='canceled'`.
    - `customer.subscription.paused`: set `subscription_status='paused'`.
    - Log unhandled event types with `console.log('[billing/webhook] unhandled event type:', event.type)` and return 200 — never return non-2xx for an unhandled event (Stripe will retry).

- **L3.** Middleware gate: in `src/middleware.ts`, after the existing session-refresh logic, read `accounts.subscription_status` for the authenticated user's account. **Follow the existing `withRefreshedCookies` helper pattern exactly** — the file carries an explicit bug-history comment about cookie propagation on redirect (bug #288); any new redirect branch must go through that same helper. If `subscription_status` is `'canceled'` OR `subscription_status` is `'past_due'`, redirect to `/billing`. Accounts in `'trialing'` or `'active'` or `'paused'` pass through. Do not block the `/api/billing/webhook` route — add it to the public-routes exclusion list in middleware.
  - New page `app/(auth)/billing/page.tsx` (own layout, no dashboard shell): shows account name, current status pill, and two CTA buttons depending on status: "Reactivate Plan" (→ POST billing/portal → redirect) for `past_due`/`canceled`, "Start Free Trial" (→ POST billing/checkout → redirect) for `canceled` with no prior subscription. Mobile-first; reuse `Button` from `components/ui/`.

- **L4.** Seat-limit enforcement: in the existing invite-creation route (find it under `app/api/account/invitations/` — check the exact handler file by reading the directory), after role-checking, add:
  ```ts
  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId);
  const { data: account } = await supabase
    .from('accounts')
    .select('seat_limit')
    .eq('id', accountId)
    .single();
  if (count !== null && account && count >= account.seat_limit) {
    return NextResponse.json(
      { error: 'SEAT_LIMIT_REACHED', message: `Your plan allows ${account.seat_limit} seats. Upgrade to invite more team members.` },
      { status: 403 }
    );
  }
  ```
  In `components/settings/invite-member-dialog.tsx` (or wherever the invite UI lives), handle the `SEAT_LIMIT_REACHED` error code: show a toast "Seat limit reached" + an inline "Upgrade Plan" button that triggers the Checkout flow.

- **L5.** Settings → Billing tab: new file `components/settings/billing-tab.tsx` (follow the per-panel convention — `whatsapp-config.tsx`, `ai-config.tsx`, etc. are the models). Show: plan name badge, status pill, renewal date formatted relative ("Renews in 14 days"), seat usage ("2 of 3 seats used" — query `profiles` count), "Manage Plan" button (→ billing portal), "Upgrade" button (→ Checkout, only shown for `starter` plan). Visible to `owner` only — check with the existing `canTransferOwnership` predicate in `lib/auth/roles.ts` or add `isOwner(role)` there if it doesn't exist.

**Definition of done:** (a) a test `checkout.session.completed` POST to `/api/billing/webhook` with a valid Stripe-signed payload sets `subscription_status='active'` in the DB; (b) an `invoice.payment_failed` event sets `past_due` and the next dashboard load redirects to `/billing`; (c) inviting past `seat_limit` returns the SEAT_LIMIT_REACHED error and surfaces it in the invite dialog with an Upgrade CTA; (d) `npm run typecheck && npm run lint && npm run test` all pass.

---

## Section M — Portal Lead Capture (Email Parser)

_Goal: matches the "auto-capture from 99acres/MagicBricks" feature via the same mechanism those competitors actually use — an inbound email address, not a negotiated API._

- **M1.** Provision an inbound email address (e.g. SendGrid Inbound Parse or Mailgun Routes) posting to a new webhook endpoint.
- **M2.** Template-based extraction for 99acres/MagicBricks/Housing.com notification emails, with an LLM-based generic fallback extractor for anything that doesn't match a known template.
- **M3.** Write extracted leads into contacts via the existing public API, tagged with the source portal, triggering the same qualification Flow as any other new lead.

**Definition of done:** forwarding a real (or realistic sample) portal notification email to the capture address results in a correctly populated, correctly tagged lead appearing in the Leads list within seconds.

---

## Section N — QA, Performance & Launch Readiness

_Goal: the gate before pilot rollout. Re-run after every two new sections merge (O, P, Q) — not just once at the end._

- **N1.** Lighthouse mobile audit on Dashboard, Leads, Pipeline, Inbox, Site Visits, Integrations — fix until Performance ≥ 90 and Best Practices ≥ 90 on all six pages. Run via `npx lighthouse <url> --form-factor=mobile --throttling-method=simulate`.
- **N2.** _(revised)_ `supabase/ci/verify-schema.sql` already exists as a schema-check script — extend it (or add a sibling script) with an automated two-tenant RLS isolation test across **all** tables touched in Sections D–Q, including `tasks` (Section P) and any new columns on `accounts` (Sections L and O). Confirm zero cross-tenant leakage.
- **N3.** Manual device-testing checklist — test each flow on one mid-range Android device (Chrome) and one iPhone (Safari) under real network conditions (not just DevTools throttling):
  - Dashboard: stat cards update, Recent Leads widget, Today's Visits widget, Today's Tasks widget, Quick-action bar all four buttons
  - Leads list: source badge renders, status filter chips work, source filter works, swipe-left actions trigger
  - Pipeline: mobile stage tabs swipe, source badge on deal cards, "Move to…" bottom sheet
  - Site Visits: day grouping, confirm/reschedule tap
  - Integrations: portal tiles render, copy email button, "+ Connect" modal, correct WhatsApp tile state
  - Tasks: create task from lead detail → appears on Dashboard widget; check-off clears immediately
  - Cost Sheet: template save in Settings; send from lead detail delivers correct WhatsApp message
  - Billing: Stripe Checkout redirect, webhook → DB update, middleware gate on past_due
- **N4.** Stand up a lightweight bug-intake process (even a simple GitHub issue template at `.github/ISSUE_TEMPLATE/bug_report.md`) ahead of the pilot.

**Definition of done:** all four checks pass; Lighthouse scores ≥ 90 on all six pages recorded; written go/no-go summary produced for the pilot.

---

## Section O — Integrations Page UI

_Goal: expose the portal connection surface the demo shows — a first-class route that agents use to connect lead sources and copy their universal capture email. The backend (email parser webhook from Section M, `whatsapp_config` table) already exists; this section is ~85% UI._

> **Codebase state:** No `(dashboard)/integrations/` route exists. `whatsapp_config` table holds WhatsApp connection state. Section M added the inbound email capture backend but no UI page. `Account` table has no `portal_connections` column.

- **O1.** New migration `107_portal_connections.sql`:
  ```sql
  ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS portal_connections JSONB NOT NULL DEFAULT '{}'::jsonb;
  ```
  The JSONB value is a map keyed by portal slug: `{ "99acres": { "connected": true, "connected_at": "2026-01-01T00:00:00Z", "test_lead_received": true }, "MagicBricks": { ... } }`. Update `src/types/index.ts`'s `Account` interface: add `portal_connections: Record<string, { connected: boolean; connected_at?: string; test_lead_received?: boolean }>`. No new RLS policy needed — `accounts` already has an owner-update policy; this column inherits it.

- **O2.** New API route `app/api/account/portal-connections/route.ts` — follow the `try/catch → toErrorResponse` shape of `app/api/account/route.ts`:
  - `GET` — returns `{ portal_connections: account.portal_connections, capture_email: string }`. Construct `capture_email` as `` `leads+${accountId.slice(0,8)}@${process.env.INBOUND_EMAIL_DOMAIN}` `` (env var set up in Section M). Requires `getCurrentAccount()`.
  - `PATCH` — body `{ portal: string, connected: boolean }`. Merge into the existing JSONB: read current `portal_connections`, set `[portal] = { connected, connected_at: new Date().toISOString() }`, write back. Requires `requireRole('admin')`. Use the Supabase user client (not service role) so RLS applies.
  - Add `INBOUND_EMAIL_DOMAIN` to `.env.local.example` if not already there from Section M.

- **O3.** New page `app/(dashboard)/integrations/page.tsx` (server component — fetch account data server-side via `getCurrentAccount()`):
  - **Universal Capture Email card**: display `capture_email` in a read-only `<input>` styled as a code block, with a client-side "Copy" button (`navigator.clipboard.writeText`). Subtitle: "Add this as CC in any portal's notification settings to auto-import leads." (i18n key: `integrations.capture_email.subtitle`).
  - **Portal tiles grid** — 3 columns on desktop, 2 on tablet, 1 on mobile. The six portals and their initial states:

    | Portal | Connection source | Default state |
    |--------|------------------|---------------|
    | 99acres | `portal_connections['99acres']` | Not Connected |
    | MagicBricks | `portal_connections['MagicBricks']` | Not Connected |
    | Housing.com | `portal_connections['Housing.com']` | Not Connected |
    | Gmail | `portal_connections['Gmail']` | Not Connected |
    | WhatsApp Business | `whatsapp_config.phone_number_id IS NOT NULL` | reflects live config |
    | Instagram | hardcoded | Coming Soon |

  - Each tile: portal name, icon (`lucide-react` — use `Home` for 99acres/MagicBricks/Housing.com, `Mail` for Gmail, `MessageCircle` for WhatsApp, `Instagram` for Instagram), status badge ("✓ Connected" green / "Not Connected" grey / "Coming Soon" purple), CTA button ("Manage →" if connected / "+ Connect →" if not / disabled if Coming Soon). If `test_lead_received` is true, show a sub-label "✓ Test lead received" in green below the status badge.
  - Add `integrations` entry to `components/layout/sidebar.tsx` (desktop) under a "Connections" nav group. Add to the `MoreSheet` in `BottomNav` (Section B3's component).

- **O4.** Connect modal — new client component `components/integrations/portal-connect-modal.tsx`:
  - Triggered by "+ Connect →" button. Props: `portal: string`, `captureEmail: string`.
  - Renders as a `Sheet` (bottom sheet on mobile, dialog on desktop — use the existing `components/ui/sheet.tsx` with `side="bottom"` on mobile via a responsive prop).
  - Content: three numbered steps — (1) copy capture email (repeat the copy card), (2) portal-specific setup instructions (text keyed per portal in `messages/en.json` under `integrations.portals.<portal>.instructions`), (3) "Mark as Connected" button.
  - "Mark as Connected" calls `PATCH /api/account/portal-connections` → on success, optimistically update tile status via a `startTransition` + `router.refresh()` (App Router pattern — do not introduce a global state manager for this).

- **O5.** When Section M's email parser successfully imports a lead, it should `PATCH` the `portal_connections` JSONB to set `test_lead_received: true` for that portal. Find the email-parser handler (likely `app/api/inbound-email/route.ts` or similar from Section M) and add this write after a successful contact upsert. Use the Supabase service-role client (no user session in a webhook).

**Definition of done:** Integrations page renders all six tiles with correct statuses; copying the capture email works; "+ Connect" modal shows correct per-portal instructions; "Mark as Connected" updates tile immediately; WhatsApp tile reflects live `whatsapp_config` state; `npm run typecheck && npm run lint` pass.

---

## Section P — Tasks & Follow-ups

_Goal: power the "Today's Tasks" dashboard widget and the "Follow-ups Due" stat card visible in the demo. The only truly new backend in the post-L sections._

> **Codebase state:** No `tasks` table, no task API route, no task UI. The SLA query (migration 102, `lib/dashboard/queries.ts`) tracks conversation-level response time but not explicit task items. `quick_replies` exists but must not be repurposed for tasks — different data shape and UX.

- **P1.** New migration `108_tasks.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS tasks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    contact_id    UUID REFERENCES contacts(id) ON DELETE SET NULL,
    site_visit_id UUID REFERENCES site_visits(id) ON DELETE SET NULL,
    title         TEXT NOT NULL,
    due_at        TIMESTAMPTZ,
    done          BOOLEAN NOT NULL DEFAULT FALSE,
    done_at       TIMESTAMPTZ,
    created_by    UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    assigned_to   UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_account ON tasks(account_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_contact ON tasks(contact_id);
  -- Partial index for the "due today, not done" query pattern
  CREATE INDEX IF NOT EXISTS idx_tasks_due_pending
    ON tasks(account_id, due_at) WHERE done = FALSE;
  ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
  -- Copy the is_account_member pattern from migration 102
  CREATE POLICY tasks_select ON tasks FOR SELECT USING (is_account_member(account_id));
  CREATE POLICY tasks_insert ON tasks FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
  CREATE POLICY tasks_update ON tasks FOR UPDATE USING (is_account_member(account_id, 'agent'));
  CREATE POLICY tasks_delete ON tasks FOR DELETE USING (is_account_member(account_id, 'agent'));
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  ```
  Update `src/types/index.ts` — add a `Task` interface matching the table shape exactly, with doc-comments on each field explaining _why_ it exists (match the existing documentation style in the file — see `LeadDetail` as a model).

- **P2.** New dashboard API routes — pattern: `app/api/quick-replies/route.ts` (same `getCurrentAccount` + RLS-via-user-client read, service-role write, `try/catch → toErrorResponse`):
  - `app/api/tasks/route.ts`:
    - `GET`: supports query params `due_today=true` (filter `due_at::date <= now()::date AND done = false`), `contact_id=<uuid>`, `assigned_to=<uuid>`. Returns `{ tasks: Task[] }`. Use the RLS user client — no need for service role on reads.
    - `POST`: body `{ title: string, contact_id?: string, site_visit_id?: string, due_at?: string, assigned_to?: string }`. Validates `title` is non-empty. Sets `created_by` from `getCurrentAccount().userId`. Writes via service-role client after role check (`requireRole('agent')`).
  - `app/api/tasks/[id]/route.ts`:
    - `GET`: returns single task. User client + RLS.
    - `PATCH`: body is a partial `Task` (any subset of `title`, `due_at`, `done`, `assigned_to`). If `done=true` in the body, also set `done_at=new Date().toISOString()`. Requires `requireRole('agent')`.
    - `DELETE`: requires `requireRole('agent')`. Hard delete.

- **P3.** Extend `lib/dashboard/queries.ts` — add a new exported async function `getFollowupsDueCount(supabase: SupabaseClient, accountId: string): Promise<{ count: number; overdue: number }>`. Implementation:
  - `count` = (tasks due today, not done) + (conversations where `first_unanswered_at IS NOT NULL`). Use two parallel `supabase.from(...).select('*', { count: 'exact', head: true })` calls and sum.
  - `overdue` = (tasks where `due_at < now()` and `due_at::date < today` and `done = false`) + (conversations where `first_unanswered_at < now() - interval '30 minutes'`). Same pattern.
  - Return `{ count, overdue }`. Use this in C1's Dashboard page to drive the "Follow-ups Due" stat card (replace the `TODO(SectionP)` placeholder).

- **P4.** Dashboard widget — new client component `components/dashboard/tasks-widget.tsx`:
  - Fetches `GET /api/tasks?due_today=true` on mount with `useEffect` + `fetch`. Shows a `Skeleton` (reuse `components/dashboard/skeleton.tsx`) while loading.
  - Header: "Today's Tasks" + a count badge ("3 pending" / "0 pending").
  - Task list: each row has a checkbox (clicking calls `PATCH /api/tasks/[id]` with `{ done: true }` and optimistically removes the row), task title, linked lead name as a tappable link to `/contacts/[id]` (if `contact_id` set), due time formatted as "Due 2h ago" or "Due today at 3pm" using `date-fns` or the existing `lib/dashboard/date-utils.ts`.
  - Inline quick-create: a single text input + optional date picker + "Add" button at the bottom of the widget. Calls `POST /api/tasks`. On success, prepend the new task to the list optimistically.
  - On error (both read and write), show a toast via the existing `sonner` setup in `components/themed-toaster.tsx`.
  - Wire into the Dashboard page (`app/(dashboard)/dashboard/page.tsx`), replacing the `TODO(SectionP)` placeholder comment.

- **P5.** Lead detail Tasks tab — in `components/contacts/contact-detail-view.tsx`, add a "Tasks" tab alongside existing tabs. Fetch `GET /api/tasks?contact_id=<id>` when the tab is active (lazy load — only fetch on first tab open). Render the same `tasks-widget.tsx` component but pass `contactId` as a prop so the inline create pre-fills `contact_id`. Show task count in the tab label badge.

- **P6.** Wire "Follow-ups Due" stat card in Dashboard — update C1's Dashboard page: call `getFollowupsDueCount` server-side, pass `count` and `overdue` as props to the stat card. Show `overdue` as a sub-label with the same amber/red coloring as the `SlaBadge` from Section F (reuse those CSS variables).

**Definition of done:** creating a task from lead detail → appears in Dashboard widget within the same session; checking it off removes it optimistically; "Follow-ups Due" stat updates with real overdue data; `GET /api/tasks?due_today=true` returns correctly filtered rows; vitest unit tests for `getFollowupsDueCount` and the two new API route files pass; `npm run typecheck && npm run lint` pass.

---

## Section Q — Cost Sheet

_Goal: enable agents to send a formatted property cost breakdown to a lead via WhatsApp in one tap — the "Cost Sheet" quick-action visible in the demo. Zero new backend: uses existing `properties`, `lead_details`, and `api/whatsapp/send` infrastructure._

> **Codebase state:** `properties` table + `api/v1/properties` CRUD exist (migration 100). `lead_details` exists (migration 100). `api/whatsapp/send` accepts `{ contact_id, body }` for free-text WhatsApp sends. `quick_replies` table (`kind: 'text' | 'interactive'`) exists as a canned-reply store — the Cost Sheet template will live here as a `kind='cost_sheet'` record (extend the `QuickReplyKind` union in `src/types/index.ts`). No PDF generation for MVP — WhatsApp formatted text is sufficient.

- **Q1.** Extend types and schema:
  - In `src/types/index.ts`, add `'cost_sheet'` to the `QuickReplyKind` union. Add `cost_sheet_template_id?: string | null` to the `Account` interface.
  - New migration `109_cost_sheet.sql`:
    ```sql
    ALTER TABLE accounts
      ADD COLUMN IF NOT EXISTS cost_sheet_template_id UUID REFERENCES quick_replies(id) ON DELETE SET NULL;
    ```
  - Do NOT auto-seed a template at account creation — let the owner create one in Settings. The Cost Sheet button in C1's quick-action bar is disabled with a tooltip "Set up your Cost Sheet in Settings → Cost Sheet" until `cost_sheet_template_id` is non-null.

- **Q2.** Settings → Cost Sheet tab — new file `components/settings/cost-sheet-config.tsx` (follow the per-panel convention: `whatsapp-config.tsx`, `ai-config.tsx` are the models to read first):
  - Fetch the current account via `useEffect → GET /api/account`. If `cost_sheet_template_id` is set, also fetch `GET /api/quick-replies` and find the matching quick reply to pre-populate the textarea.
  - Show a labeled `<textarea>` with placeholder default template:
    ```
    🏠 *Property Details*
    Title: {{property_title}}
    Location: {{location}}
    Price: ₹{{price}}
    Type: {{property_type}} | {{bedrooms}} BHK

    💰 *Your Budget*
    ₹{{budget_min}} – ₹{{budget_max}}

    📞 *Your Agent*
    {{agent_name}} – {{agent_phone}}

    Reply to schedule a visit or ask any questions!
    ```
  - "Save Template" button: calls `POST /api/quick-replies` with `{ kind: 'cost_sheet', name: 'Default Cost Sheet', content: <textarea value> }` to create/update the template, then calls `PATCH /api/account` with `{ cost_sheet_template_id: <new_id> }`. Extend the existing `PATCH` handler in `app/api/account/route.ts` to accept and update this new column (add it to the allowed fields whitelist in that handler).
  - "Preview" button: renders a preview panel below the textarea, substituting placeholders with sample values (hardcoded sample: `property_title: "Prestige Elm Park"`, `price: "1.5Cr"`, etc.) using `content.replace(/\{\{(\w+)\}\}/g, ...)`. No library needed.
  - Visible to `owner` and `admin` roles (check with `canEditSettings` from `lib/auth/roles.ts`).

- **Q3.** Cost Sheet send modal — new client component `components/contacts/cost-sheet-modal.tsx`:
  - Props: `contactId: string` (pre-selected lead), optional `propertyId?: string`.
  - On mount: (a) fetch `GET /api/account` to get the template content; (b) fetch `GET /api/v1/contacts/[contactId]` joined with `lead_details` to get budget/location fields; (c) fetch `GET /api/v1/properties?limit=20` and client-side filter to top 3 matching properties (match on `lead_details.location_preference` substring and `property_type`).
  - UI flow:
    1. **Property selector**: dropdown or radio list of matching properties (show title, location, price). If `propertyId` prop is provided, pre-select it.
    2. **Preview**: after property selection, substitute all `{{placeholder}}` values in the template string client-side using `template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '')`. Show the filled text in a scrollable `<pre>` or styled box.
    3. **"Send via WhatsApp" button**: calls `POST /api/whatsapp/send` with `{ contact_id: contactId, body: filledTemplate }`. On success: sonner toast "Cost Sheet sent! ✓", close modal. On error: sonner toast with error message.
  - If `cost_sheet_template_id` is null on the account: show an inline message "No Cost Sheet template configured. Set one up in Settings → Cost Sheet." with a link to `/settings` — do not render the send flow.
  - Render as a `Sheet` (bottom sheet on mobile, dialog on desktop — use `components/ui/sheet.tsx`).

- **Q4.** Wire entry points:
  - Dashboard quick-action bar (C1): "Cost Sheet" button opens a contact-picker first (`components/contacts/contact-form.tsx` already has a contact search — check if a standalone contact-search combobox component exists; if so reuse it, otherwise inline a simple `<input>` + filtered list). After contact selection, open `cost-sheet-modal.tsx` with `contactId`.
  - Lead detail (`components/contacts/contact-detail-view.tsx`): add a "Cost Sheet" button in the action bar (alongside the existing WhatsApp/Call buttons). Opens `cost-sheet-modal.tsx` directly with the current `contactId`.

**Definition of done:** (a) saving a template in Settings → Cost Sheet creates a `quick_replies` row and sets `cost_sheet_template_id` on the account; (b) selecting a lead + property in the modal fills the template with real data; (c) tapping "Send via WhatsApp" in staging delivers the correct message to the lead's WhatsApp number; (d) Dashboard "Cost Sheet" button is disabled with tooltip when no template is configured; (e) `npm run typecheck && npm run lint` pass.

---

## Section R — India Localization & Compliance

_Goal: make the product feel native to Indian real estate agents and legally compliant. Must run BEFORE O/P/Q so those sections inherit correct currency formatting and the NoBroker portal tile._

> **Codebase state:** `lib/currency.ts` uses `formatCompactNumber` which outputs "₹1.5M" — wrong for India. `properties` table has no BHK, RERA, builder, or possession fields. `site_visits` has no pickup fields. All automation templates are English-only. `whatsapp_config` holds the team's shared WhatsApp number.

- **R1.** `lib/currency.ts` — add two new exported functions. Do NOT change the existing `formatCurrency` / `formatCurrencyShort` — they are used globally.
  ```ts
  /** Format a rupee value using Indian L/Cr scale. Always shows ₹ symbol.
   *  Examples: 4500000 → "₹45L", 10000000 → "₹1Cr", 15000000 → "₹1.5Cr", 75000 → "₹75,000" */
  export function formatINR(value: number): string {
    const v = Number(value || 0);
    if (v >= 1_00_00_000) return `₹${+(v / 1_00_00_000).toFixed(2)}Cr`;
    if (v >= 1_00_000)    return `₹${+(v / 1_00_000).toFixed(1)}L`;
    return `₹${v.toLocaleString('en-IN')}`;
  }
  /** Format a budget range: "₹45L–60L", "₹1.5Cr–2Cr", "₹45L+" if no max */
  export function formatINRRange(min?: number | null, max?: number | null): string {
    if (!min && !max) return '—';
    if (!max) return `${formatINR(min!)}+`;
    return `${formatINR(min!)}–${formatINR(max!)}`;
  }
  ```
  Find every place `formatCurrencyShort` or `formatCurrency` is called in RE-specific screens (C2 leads list, C4 pipeline cards, Dashboard stat cards, H2 property detail, H3 property match, Q cost sheet modal) and replace with `formatINR` / `formatINRRange` when the account's `default_currency === 'INR'`. Use a conditional: if INR use new functions, else fall back to existing ones — don't break other currencies.
  Also update the `handle_new_user` trigger in `supabase/migrations/100_real_estate_schema.sql` — add (in a new migration, not by editing 100): `UPDATE accounts SET default_currency = 'INR' WHERE id = v_account_id AND default_currency = 'USD';` in a new migration `110_india_defaults.sql`.

- **R2.** New migration `110_india_defaults.sql` (same file as the currency trigger update):
  ```sql
  -- Set INR as default for all existing accounts (safe, idempotent)
  UPDATE accounts SET default_currency = 'INR' WHERE default_currency = 'USD';

  -- Extend properties for Indian real estate
  ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS configuration TEXT,
      -- BHK type: '1BHK','2BHK','3BHK','4BHK','Studio','Villa','Plot','Commercial'
    ADD COLUMN IF NOT EXISTS builder_name TEXT,
    ADD COLUMN IF NOT EXISTS project_name TEXT,
    ADD COLUMN IF NOT EXISTS rera_id TEXT,
    ADD COLUMN IF NOT EXISTS possession_status TEXT
      CHECK (possession_status IN ('ready_to_move','under_construction','nearing_possession')),
    ADD COLUMN IF NOT EXISTS possession_date DATE,
    ADD COLUMN IF NOT EXISTS carpet_area NUMERIC,
      -- sq ft
    ADD COLUMN IF NOT EXISTS facing TEXT;
      -- 'East','West','North','South','North-East','South-West' etc.

  -- Extend lead_details for Indian buyer preferences
  ALTER TABLE lead_details
    ADD COLUMN IF NOT EXISTS configuration_preference TEXT[],
      -- e.g. ARRAY['2BHK','3BHK']
    ADD COLUMN IF NOT EXISTS possession_preference TEXT;
      -- 'ready_to_move_only','under_construction_ok','any'

  -- Extend site_visits for pickup logistics
  ALTER TABLE site_visits
    ADD COLUMN IF NOT EXISTS pickup_required BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS pickup_location TEXT;

  -- Extend accounts for team language preference
  ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'en'
      CHECK (preferred_language IN ('en','hi','hi-en'));
      -- 'hi-en' = Hinglish (Hindi-English mix, most common)
  ```

- **R3.** Update `src/types/index.ts` — add all new fields to `Property`, `LeadDetail`, `SiteVisit`, and `Account` interfaces with doc-comments on each field. Add a `PROPERTY_CONFIGURATIONS` constant array `['1BHK','2BHK','3BHK','4BHK','Studio','Villa','Plot','Commercial']` to use in form dropdowns and filter chips.

- **R4.** Update property form (wherever Section H built it — check `components/properties/` or `app/(dashboard)/properties/`): replace the `property_type` free-text input with a BHK/Config **chip selector** (tap to select, multi-select). Add fields: RERA ID (text input) with a small "Verify →" link that opens the state RERA portal in a new tab (hardcode URL `https://rera.gov.in` for now); possession status (3-option radio: Ready to Move / Under Construction / Nearing Possession); possession date (date picker, shown only when Under Construction); carpet area (number input, suffix "sq ft"); facing (dropdown). Also update the contact/lead form (Section D6's work): add `configuration_preference` as a multi-chip selector and `possession_preference` as a radio.
  Update site visit schedule form (Section E2): add a "Pickup needed?" toggle. When on, reveal a text field for pickup address. Pre-fill the T-2h WhatsApp automation template with pickup details when `pickup_required = true` — find the template in the automation seeds and add a conditional line: `{{#if pickup_required}}Our agent will pick you up from {{pickup_location}} at {{pickup_time}}.{{/if}}`.

- **R5.** Property detail screen (Section H2): display `rera_id` as a prominent badge ("RERA: MH/2023/12345"). If `rera_id` is null, show a subtle inline warning badge "RERA ID missing — required under RERA Act 2016" in amber. Display `configuration` as the primary headline metric (e.g. "3BHK" in large bold). Show possession status pill and carpet area. Update the Cost Sheet default template (Q2) to include `{{rera_id}}`, `{{configuration}}`, `{{builder_name}}`, `{{possession_status}}`, `{{carpet_area}} sq ft` as new placeholders.

- **R6.** Hinglish WhatsApp automation templates: in a new seed migration `111_hinglish_templates.sql`, add Hinglish-body variants of the three site-visit automations seeded in migration 101. Each is a new `automations` row with `name` prefixed `[HI]` and `trigger_type` / `step_config` identical to the English variant except for the message body:
  - T-24h: `"Namaste {{contact_name}} ji! 🙏 Kal {{visit_time}} baje aapka site visit confirm hai. Property: {{property_title}}, {{property_location}}. Koi bhi sawaal ho toh humein WhatsApp karein."`
  - T-2h: `"{{contact_name}} ji, 2 ghante baad aapka site visit hai! {{#if pickup_required}}Hamara agent aapko {{pickup_location}} se pick karenge {{pickup_time}} baje par.{{/if}} Property ka address: {{property_location}} 🏠"`
  - No-show: `"{{contact_name}} ji, lagta hai aaj site visit chhoot gayi. Koi baat nahi! Kab convenient rahega — is week ya agli week? Hum nayi timing arrange kar sakte hain 🙏"`
  In `lib/automations/engine.ts`, after resolving the automation to run, add a language-selection step: if `account.preferred_language !== 'en'`, prefer a template with the matching `[HI]` name prefix if one exists for the same trigger. This is a simple lookup — no new table needed.

- **R7.** Two client-side utility components (zero backend, zero new migrations):
  - `components/properties/emi-calculator.tsx`: a collapsible card on the property detail page. Inputs: loan amount (pre-filled as `property.price * 0.8`), tenure (years, default 20), interest rate % (default 8.5). Output: monthly EMI using standard formula `P × r × (1+r)^n / ((1+r)^n - 1)`, displayed as `formatINR(emi)/month`. Also show "Total interest: `formatINR(totalInterest)`" and a green/amber/red "Fits budget?" indicator comparing EMI to `lead_details.budget_max / 200` (rough monthly affordability heuristic). Wire into property detail (H2) as a collapsible bottom section.
  - `components/pipelines/brokerage-badge.tsx`: a small inline badge on deal cards in the Pipeline view. Formula: `deal.value * (brokerage_pct / 100)`. `brokerage_pct` defaults to 2 but is stored in `accounts.settings JSONB` — add key `brokerage_pct: number` to the JSONB (no migration needed, JSONB is schema-less). Show "≈ `formatINR(commission)` @ `brokerage_pct`%". Add a "Brokerage %" input to Settings → General.

- **R8.** Add NoBroker to the Integrations portal tile grid (Section O's grid component): same tile shape as others — portal name, icon (use `Home` from lucide-react), status from `portal_connections['NoBroker']`. Connection instructions in `messages/en.json` under `integrations.portals.NoBroker.instructions`. Add JustDial as a "Coming Soon" tile.

**Definition of done:** all INR amounts on RE screens display in L/Cr format; property form exposes BHK chip selector, RERA ID field, possession status; NoBroker appears in Integrations; site visit form has pickup toggle; EMI calculator renders on property detail with correct output; brokerage badge shows on pipeline cards; Hinglish template fires when `preferred_language = 'hi-en'`; `npm run typecheck && npm run lint && npm run test` pass.

---

## Section S — Lead Distribution & Team Workflows

_Goal: make lead management work for a 10-30 person team. The most business-critical new section — without real round-robin and lead-load visibility, this is a solo tool._

> **Codebase state:** Round-robin is a stub (literally returns `LIMIT 1`). No `is_available` on profiles. No lead routing rules. No bulk reassignment. No stale-lead detection. `loadTeamPerformance` returns per-agent stats but not open-lead counts.

- **S1.** Fix round-robin in `lib/automations/engine.ts` (`assign_conversation` case). Replace the stub with real load-balanced round-robin:
  ```ts
  if (cfg.mode === 'round_robin') {
    // Real round-robin: find the available agent with the fewest open assigned leads
    const { data: profiles } = await db
      .from('profiles')
      .select('user_id')
      .eq('account_id', args.automation.account_id)
      .eq('account_role', 'agent')
      .eq('is_available', true);  // only available agents (S2 adds this column)

    if (!profiles?.length) return 'no available agents';

    // Count open conversations per agent
    const counts = await Promise.all(
      profiles.map(async (p) => {
        const { count } = await db
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_agent_id', p.user_id)
          .eq('status', 'open');
        return { userId: p.user_id, count: count ?? 0 };
      })
    );
    // Assign to the agent with fewest open leads
    counts.sort((a, b) => a.count - b.count);
    agentId = counts[0].userId;
  }
  ```
  Add a unit test `lib/automations/engine.test.ts` specifically for round-robin: mock 3 agents with different open-conversation counts, assert the least-loaded one is selected.

- **S2.** New migration `112_agent_availability.sql`:
  ```sql
  ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS unavailable_reason TEXT;
    -- e.g. 'On leave', 'On a call', 'Out of office'
  ```
  UI: in Settings → Team (admin+ view), each agent row gets an availability toggle. An agent can also toggle their own availability from their profile menu (top-right avatar dropdown). Show an "On Leave" badge on unavailable agents in the Team Dashboard. The round-robin engine (S1) skips unavailable agents. If ALL agents are unavailable, create the contact/conversation unassigned and alert the admin via a push notification.

- **S3.** Lead routing rules — new migration `113_lead_routing_rules.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS lead_routing_rules (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    priority      INTEGER NOT NULL DEFAULT 0,
      -- lower number = evaluated first
    condition_type TEXT NOT NULL
      CHECK (condition_type IN ('source','budget_gte','budget_lte','location_contains','configuration')),
    condition_value TEXT NOT NULL,
      -- e.g. '99acres', '5000000', 'Noida', '3BHK'
    action_type   TEXT NOT NULL
      CHECK (action_type IN ('assign_to_agent','assign_to_role')),
    action_value  TEXT NOT NULL,
      -- agent user_id or role name ('agent','admin')
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_routing_rules_account ON lead_routing_rules(account_id, priority);
  ALTER TABLE lead_routing_rules ENABLE ROW LEVEL SECURITY;
  CREATE POLICY routing_rules_select ON lead_routing_rules FOR SELECT USING (is_account_member(account_id));
  CREATE POLICY routing_rules_manage ON lead_routing_rules FOR ALL USING (is_account_member(account_id, 'admin'));
  ```
  New API route `app/api/account/routing-rules/route.ts` (GET, POST) and `app/api/account/routing-rules/[id]/route.ts` (PATCH, DELETE). Follow the `try/catch → toErrorResponse` pattern of `app/api/account/route.ts`.
  In `lib/automations/engine.ts` `assign_conversation` case: before round-robin, evaluate routing rules for the account in priority order. If a rule matches the contact's `source`, `budget`, `location_preference`, or `configuration_preference`, apply its action. Fall through to round-robin only if no rule matches.
  UI: Settings → Team → "Lead Routing" tab. Shows a drag-reorderable list of rules. Each rule: condition (`source = 99acres`) → action (`assign to Agent: Rahul`). "+ Add Rule" button opens a simple form. Uses `@dnd-kit/sortable` (already in `package.json` — verify; if not, use `react-beautiful-dnd` or a simple up/down arrow UI instead). `admin+` only.

- **S4.** Stale lead detection — new API route `app/api/cron/stale-leads/route.ts`:
  - Trigger: `GET` called by Vercel Cron (add to `vercel.json`: `{ "path": "/api/cron/stale-leads", "schedule": "0 3 * * *" }` — 3 AM UTC = 8:30 AM IST). Gate with `CRON_SECRET` env var (same pattern as any other cron in the project — check `app/api/cron/` for the existing pattern).
  - Logic: for each account, find contacts where the latest deal stage is `New` or `Contacted` and `deals.updated_at < now() - interval '48 hours'` and `conversations.assigned_agent_id IS NOT NULL`. For each stale lead: (a) create a task (`POST`-equivalent insert into `tasks` table — Section P adds this; add a `TODO(SectionP)` comment and implement only after Section P merges) with title "Follow up: [contact name] — no activity for 2+ days" and `due_at = now()`; (b) send a push notification (use existing `lib/notifications/` or `push_subscriptions` — Section K adds this) to the assigned agent and to all admins.
  - Return `{ processed: number, stale: number }`.
  - Add `CRON_SECRET` to `.env.local.example` if not already there.

- **S5.** Bulk reassignment — in the Leads list (`app/(dashboard)/contacts/page.tsx`):
  - Add a `selectionMode` state. When enabled, each contact row shows a checkbox on the left. A floating bottom bar appears when ≥1 selected: "X leads selected · Reassign → · Tag → · Close". These are admin+ actions (show the checkbox toggle only for admin+).
  - New API route `app/api/contacts/bulk/route.ts` — `POST`, body: `{ action: 'reassign' | 'close' | 'tag', contact_ids: string[], payload: Record<string, string> }`. For `reassign`: update `conversations.assigned_agent_id` for all open conversations linked to those contacts. For `close`: set `conversations.status = 'closed'`. For `tag`: insert into `contact_tags`. All require `requireRole('admin')`. Use service-role client for the writes.
  - Show a confirmation dialog before bulk reassignment: "Reassign 12 leads from Rahul to Priya? This also updates their WhatsApp conversation assignments."

- **S6.** Escalation automation recipes — extend the Recipes list (Section J1). Add two pre-seeded, disabled-by-default automation records in migration `114_escalation_recipes.sql`:
  - "No WhatsApp reply in 30 min → notify manager": trigger `sla_breach` (the `first_unanswered_at` check from Section F), action: send a WhatsApp/push notification to all `admin`-role profiles in the account: "⚠️ SLA breach: {{contact_name}} has been waiting {{minutes}} min. Assigned to: {{agent_name}}."
  - "Lead in New stage for 48h → escalate": trigger `stale_lead` (from S4's cron), action: send notification to admin + optionally reassign round-robin. Config: threshold in hours (default 48), escalation action (notify-only or reassign).
  Toggle these on/off in the Recipes UI (Section J). The recipe config panel shows a "Threshold (hours)" number input.

**Definition of done:** round-robin assigns to the least-loaded available agent (verified by unit test); unavailable agents are skipped; a routing rule matching `source=99acres` assigns to the configured agent instead of round-robin; the stale-leads cron endpoint returns correct counts in a test DB; bulk reassignment of 5 contacts updates all their open conversation assignments; `npm run typecheck && npm run lint && npm run test` all pass.

---

## Section T — Manager Command Center

_Goal: the screen the business owner opens every morning. Upgrade the Team Dashboard from a stats grid into a real management surface._

> **Codebase state:** `app/(dashboard)/team/team-client.tsx` is 110 lines, shows agent cards with 5 stats (response time, leads worked, visits, no-show rate, conversion rate). `AgentPerformance` in `lib/dashboard/types.ts` has no `openLeadsCount`, `isAvailable`, `targetVisits`, or `staleLeadCount`. There is no unassigned lead pool view.

- **T1.** Extend `AgentPerformance` in `lib/dashboard/types.ts`:
  ```ts
  export interface AgentPerformance {
    // existing fields unchanged
    agentId: string; name: string; avatarUrl: string | null; role: string;
    avgResponseTimeMin: number | null; leadsWorked: number;
    visitsCompleted: number; noShowRate: number | null; conversionRate: number | null;
    // new B2B team fields
    openLeadsCount: number;       // currently open conversations assigned to this agent
    isAvailable: boolean;         // from profiles.is_available (Section S2)
    staleLeadCount: number;       // leads with deals.updated_at > 48h ago in early stages
    targetVisits: number | null;  // from agent_targets for current calendar month
    actualVisitsThisMonth: number; // completed site visits this calendar month
  }
  ```
  Update `loadTeamPerformance` in `lib/dashboard/queries.ts` to populate these new fields. Add a 6th parallel query for `openLeadsCount` (count conversations per `assigned_agent_id` where `status='open'`). Add `staleLeadCount` using the same query logic as S4's cron but returning per-agent counts. Fetch `agent_targets` for the current month (Section T2 adds this table). Fetch `is_available` from profiles.

- **T2.** New migration `115_agent_targets.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS agent_targets (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id   UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    agent_id     UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    period_start DATE NOT NULL,  -- first day of the month
    period_end   DATE NOT NULL,  -- last day of the month
    target_visits INTEGER NOT NULL DEFAULT 0,
    target_bookings INTEGER NOT NULL DEFAULT 0,
    UNIQUE (account_id, agent_id, period_start)
  );
  ALTER TABLE agent_targets ENABLE ROW LEVEL SECURITY;
  CREATE POLICY agent_targets_select ON agent_targets FOR SELECT USING (is_account_member(account_id));
  CREATE POLICY agent_targets_manage ON agent_targets FOR ALL USING (is_account_member(account_id, 'admin'));
  ```
  New API route `app/api/account/targets/route.ts` (GET, POST/PATCH). Admin can set monthly targets per agent from the Team Dashboard via an inline edit (click the target number → number input → save). Pre-populate new months by copying the previous month's targets.

- **T3.** Unassigned Lead Pool widget — new component `components/team/unassigned-pool.tsx`. Shows at the top of the Team Dashboard page (above agent cards), visible to `admin+` only. Content:
  - Count badge: "**18 unassigned leads**" (contacts where no open conversation exists, OR conversation exists but `assigned_agent_id IS NULL`)
  - A scrollable list of up to 10 unassigned leads: lead name, source badge, time since created ("3h ago"), one-tap assign button that opens an agent picker sheet
  - Agent picker sheet: list of available agents with their current open-lead count in a badge. Single-tap assigns the lead and calls `POST /api/contacts/bulk` with `action='reassign'`.
  - "View All →" link goes to the Leads list filtered by `unassigned=true`
  - Fetches `GET /api/contacts?unassigned=true` — extend the existing contacts API to support this filter (check for contacts with `status='open'` conversations where `assigned_agent_id IS NULL`).

- **T4.** Upgrade agent cards (`components/team/agent-card.tsx` — refactor out of `team-client.tsx`):
  - **Availability indicator**: green dot (available) or grey dot with "On Leave" text (unavailable). Admin can click the dot to toggle availability inline (calls `PATCH /api/account/members/[id]` — check if this route exists; if not, extend `app/api/account/route.ts` or add a sibling).
  - **Load bar**: "12 open leads" shown as a mini progress bar where 20 leads = 100% (configurable in Settings → Team → max leads per agent). Color: green (< 10), amber (10–18), red (> 18).
  - **Target progress**: "Visits: 14 / 20 this month" as a simple fraction + thin progress bar. Only shown if `agent_targets` row exists for current month.
  - **Stale lead warning**: if `staleLeadCount > 0`, show an amber "⚠️ `staleLeadCount` stale" badge. Tapping it opens a filtered lead list for that agent sorted by staleness.
  - Clicking the card's name/avatar area navigates to a filtered Leads list for that agent.

- **T5.** Pipeline funnel overview — a new `<PipelineFunnelChart />` component below the agent cards. Uses `recharts` `BarChart`. X-axis: pipeline stage names. Y-axis: total leads in that stage across all agents. Shows the business owner the full-team conversion funnel at a glance. Data fetched from a new `GET /api/dashboard/pipeline-funnel` route that queries `deals` grouped by `pipeline_stage_id`, joined with `pipeline_stages.name`. Visible to `admin+` only.

**Definition of done:** Team Dashboard shows unassigned pool count + list; each agent card shows open-lead count, availability dot, target vs actual, stale-lead warning; pipeline funnel chart renders with real stage data; admin can set monthly targets inline; `npm run typecheck && npm run lint` pass.

---

## Section U — Business Team Onboarding

_Goal: the first 10 minutes for a new business-owner customer. B2B SaaS retention depends heavily on activation: getting at least 3 agents using the product in the first week._

> **Codebase state:** Section I built an individual signup wizard (onboarding steps in `app/(dashboard)/onboarding/`). That wizard covers WhatsApp setup and basic pipeline config. It does NOT cover team-specific setup: importing existing leads, inviting agents, or setting routing rules.

- **U1.** CSV/Excel lead import — new page `app/(dashboard)/contacts/import/page.tsx`:
  - Step 1 — File upload: `<input type="file" accept=".csv,.xlsx">`. For `.xlsx`, use `xlsx` npm package (check if already in `package.json`; add if not — `npm install xlsx`). Parse on the client side to avoid file upload size limits. Max 2000 rows for MVP.
  - Step 2 — Column mapping: show a table of detected column headers from the file. For each header, show a dropdown to map it to a CRM field: Name, Mobile (required), Source, Budget Min, Budget Max, Location, BHK Config, Stage, Notes. Smart auto-map: if header is "Name" or "Customer Name" → Name; "Mobile" or "Phone" or "Contact" → Mobile; "Budget" → Budget Min; etc. Show a 5-row preview below the mapping table.
  - Step 3 — Import: "Import X contacts" button. Calls `POST /api/contacts/import` (new route) with the parsed + mapped data as a JSON array. The route does a batch upsert: use `phone_normalized` (existing deduplication column) to skip exact duplicates. For each row: create a `contacts` row, and if `source` is set, also upsert a `lead_details` row. Return `{ created: number, skipped: number, errors: number }`.
  - Parse Indian mobile numbers: strip leading 0, add +91 if 10 digits. Strip spaces and dashes.
  - Parse Indian budget strings: "45L" → 4500000, "1.5Cr" → 15000000, "80 Lakh" → 8000000. Use a simple regex-based parser in `lib/contacts/parse-budget.ts`.
  - Admin+ only. Add "Import Leads" button to the Leads list header.

- **U2.** Team setup onboarding checklist — new component `components/onboarding/team-setup-checklist.tsx`. Shown as a collapsible card at the top of the Dashboard for the `owner` role when `setupComplete` is false. `setupComplete = account.contacts_count > 5 AND account.agent_count >= 2 AND account.whatsapp_connected`. Steps:
  1. ✅ Account created — always checked
  2. Connect WhatsApp → links to Settings → WhatsApp
  3. Invite first agent → links to Settings → Team → Invite
  4. Import leads → links to `/contacts/import`
  5. Set routing rules → links to Settings → Team → Routing Rules (Section S3)
  6. Set monthly targets → links to `/team`
  Dismiss button: "Got it, don't show again" → sets `account.settings.onboarding_dismissed = true` (JSONB, no migration needed). Checklist disappears after all steps are done OR after dismissal.

- **U3.** Role-aware navigation — update `components/layout/sidebar.tsx` and the mobile `BottomNav` component. For users with role `agent` (not admin or owner):
  - **Show**: Dashboard (personal — scoped to their own leads), Leads (their assigned leads only), Site Visits (their scheduled visits), Inbox (their conversations)
  - **Hide**: Team, Integrations, full Settings (show only Profile and Notification preferences)
  - **Server-side gate**: `app/(dashboard)/team/page.tsx` already redirects agents (`requireRole('admin')`). Apply the same to `app/(dashboard)/integrations/page.tsx` and `app/(dashboard)/settings/page.tsx` (show a "Contact your admin" screen instead of an error).
  - **Query scoping**: for `agent` role, the Leads list query must add `.eq('conversations.assigned_agent_id', currentUserId)` to only show their own leads. Add this filter in the contacts list query — check where the data fetch happens and add the role-conditional filter.

**Definition of done:** (a) importing a CSV of 50 Indian contacts with "45L" budgets and "+91 98765 43210" phones creates 50 contacts with correct `phone_normalized` and `budget_min` values, skipping duplicates; (b) an agent logging in sees only their assigned leads and no Team/Integrations nav items; (c) the setup checklist shows on first login for owner role, with correct checked/unchecked state per account's actual setup progress; (d) `npm run typecheck && npm run lint && npm run test` pass.

---

## Section V — Reporting & Exports

_Goal: weekly data that keeps the business owner coming back. A CRM that produces a shareable weekly performance summary becomes indispensable._

> **Codebase state:** No export feature exists. The Team Dashboard shows live data but there's no way to share or persist a snapshot. No scheduled email reports. The cron infrastructure from Section S4 is the pattern to follow.

- **V1.** CSV/Excel export — new API route `app/api/contacts/export/route.ts`:
  - `GET`, `admin+` only. Query params: `from` (ISO date), `to` (ISO date), `agent_id` (optional filter).
  - Fetches contacts joined with `lead_details`, `deals`, `conversations` (latest), `profiles` (assigned agent). Streams the response as `text/csv`. Column order: Lead Name, Mobile, Source, Stage, Assigned Agent, Budget (INR), Location, BHK Config, RERA Property, Visits Completed, Last Activity (ISO), Created At.
  - Wire up: "Export CSV" button in the Leads list header (admin+). Triggers a `window.location.href = '/api/contacts/export?...'` download.

- **V2.** Weekly performance email — new cron route `app/api/cron/weekly-report/route.ts`:
  - Vercel Cron schedule: `0 3 * * 1` (Monday 3 AM UTC = 8:30 AM IST). Gate with `CRON_SECRET`.
  - For each account where `subscription_status IN ('active','trialing')`: generate a performance summary for the past 7 days. Use existing `loadTeamPerformance` and `loadMetrics` queries but parameterised to a 7-day window.
  - Email content (plain text + HTML): Subject: "📊 Weekly CRM Report — [Account Name] — [Date]". Body sections: New Leads This Week (count + vs last week), Site Visits (scheduled vs completed vs no-show), Deals Closed (count + ₹ value using `formatINR`), Top Agent (by visits completed), Stale Leads Needing Attention (count).
  - Send via the same email mechanism as Section L's billing emails or Section I's welcome email. If no email sender is configured, log the report JSON and skip send (don't fail).

- **V3.** Print-optimized team snapshot — a `?print=true` query param on `app/(dashboard)/team/page.tsx`. When `print=true`, render a simplified, A4-optimized layout with `@media print` CSS: remove nav, make tables compact, hide interactive elements (buttons, toggles). The owner can "Print → Save as PDF" from the browser. Add a "Print Report" button (printer icon) to the Team Dashboard header, visible admin+ only.

**Definition of done:** (a) the export CSV downloads correctly with INR-formatted budget columns and all required fields; (b) the weekly cron endpoint generates a correct JSON report object and (if email is configured) sends it to the account owner; (c) `?print=true` on the Team Dashboard renders a clean printable page; (d) `npm run typecheck && npm run lint` pass.

---

## How to run this with an AI coding agent

1. File locations — see "Where these files go in the repo" below. `AGENTS.md` at the repo root is what actually gets auto-loaded by Claude Code / Gemini CLI at session start, and it points to everything else — that linkage is what makes this whole document set self-enforcing rather than easy to ignore.
2. Run **one section per session**, e.g.: _"Read AGENTS.md, then IMPLEMENTATION_PLAN.md. Execute Section S only. Before writing code, list the specific files you'll create or modify and confirm they match the conventions in docs/agent/ARCHITECTURE.md. Then implement, and run typecheck/lint/format:check/test before finishing."_
3. **Current execution order** (dependency-ordered, updated 2026-09-27):
   ```
   D6 → (C6 + J3) → S → R → (J4 + J5 + J6) → T → U → L → O → P → Q → V → N
   ```
   Parentheses = can be done in one PR or parallel sessions; arrow = must complete left side before starting right side.

---

## Where these files go in the repo

```
wacrm/                                 ← your fork's root
├── AGENTS.md                          ← REPLACE the existing one (merge: keep the
│                                          <!-- BEGIN/END:nextjs-agent-rules --> block,
│                                          add the pointer section below it)
├── CLAUDE.md                          ← leave as-is, it already does `@AGENTS.md`
├── IMPLEMENTATION_PLAN.md             ← NEW, repo root
├── PROGRESS.md                        ← NEW, repo root (agent creates/maintains this
│                                          per AGENT_GUARDRAILS.md's workflow rule 8)
└── docs/
    ├── docker.md                      ← existing, don't touch
    ├── mcp.md                         ← existing, don't touch
    ├── multi-waba.md                  ← existing, don't touch
    ├── public-api.md                  ← existing, don't touch
    ├── whatsapp-connection-troubleshooting.md   ← existing, don't touch
    └── agent/                         ← NEW subfolder, keeps these separate
        ├── ARCHITECTURE.md            ← NEW
        ├── SCHEMA_REFERENCE.md        ← NEW
        └── AGENT_GUARDRAILS.md        ← NEW
```

The existing `docs/` folder is end-user/operator documentation (Docker, MCP, multi-WABA setup); `docs/agent/` is a deliberately separate subfolder for agent-facing reference material so the two don't get mixed up as the docs folder grows.
