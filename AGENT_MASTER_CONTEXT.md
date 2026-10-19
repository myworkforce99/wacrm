# WaCRM: Master Agent Architecture, Guardrails & Context Guide

> **TARGET AUDIENCE:** Any AI Agent, LLM, or Engineer working on this repository in a fresh or existing session.
> **HOW TO USE:** Attach or include this document at the start of any new agent conversation. It contains the verified architectural ground truth, database conventions, component invariants, multi-agent workflows, and definition-of-done checklists required to write zero-regression code.

---

## 1. PROJECT VISION & CORE MODULES

**WaCRM** is a multi-tenant, WhatsApp-first **B2B Real Estate Vertical CRM** built specifically for Indian and global property developers, brokerages, and sales teams (typically 10–50+ agents managed by team owners/managers).

### Core Functional Modules:

1. **Shared WhatsApp Inbox (`/inbox`):**
   - Multi-agent real-time conversation management via Supabase Realtime.
   - Filtered workspace tabs: **Mine** (assigned to current agent), **Unassigned** (lead pool), and **All** (team overview for managers).
   - Strict **24-hour Meta Service Window** compliance (free-form text inside 24h; approved templates outside 24h).
   - Media rendering & sending (images, PDFs, floor plans, audio, location cards, interactive buttons & list pickers).
   - WhatsApp brochure dispatch & live agent presence indicators (`online`, `away`, `offline`).

2. **Contacts & Lead Intelligence (`/contacts`):**
   - Lead ingestion from property portals (99acres, MagicBricks, Housing.com, NoBroker, Meta Ads) via webhooks and inbound email forwarding parser (`/api/portal/webhook`).
   - Automatic contact deduplication on normalized phone numbers (`+91` E.164 format).
   - Deep real estate qualification: Budget in ₹ INR (min/max), BHK preferences (`1BHK`–`4BHK`, Villa, Plot), location preferences, and possession timeline.
   - First-response SLA badges (`<15m` green, `15-60m` amber, `>60m` critical breach).
   - 1-click bulk reassignment, tag management, and CSV contact import with custom field mapping.

3. **Deals & Pipelines (`/pipelines`):**
   - Drag-and-drop Kanban board (`@dnd-kit`) + high-density table view with search and stage filters.
   - Strict deal lifecycle management: `open`, `won`, `lost`.
   - Loss tracking via structured lookup table (`lost_reasons`), capturing `lost_from_stage_id`, `lost_note`, frozen `closed_at`, and optional re-engagement date (`re_engage_on`).
   - Anti-poaching deal move guard: Agents can only move their own deals; admins/owners can move or reassign any deal.
   - Estimated brokerage commission calculations and stage-weighted revenue forecasting.

4. **Property Inventory & RERA Management (`/properties`):**
   - Central property listings repository with unit specs, carpet area, facing direction, builder, and project name.
   - **RERA Compliance Badging:** Valid RERA IDs show verified badges; missing IDs show warning indicators under the RERA Act 2016.
   - Live ₹ INR pricing with `formatINR()` (Lakhs / Crores).
   - **RBAC Mutation Gate (Migration 130):** Only `admin` and `owner` roles can create, edit, or delete properties. Agents and viewers have read and WhatsApp share permissions.
   - 1-click WhatsApp brochure sharing and built-in real estate EMI calculator.

5. **Site Visits & Field Logistics (`/site-visits`):**
   - Field visit scheduling tied directly to contacts and properties.
   - Pickup logistics tracking (pickup required flag, pickup location address).
   - Automated WhatsApp reminders at **T-24h** and **T-2h** prior to scheduled visit.
   - Automated no-show recovery flows and status tracking (`pending`, `confirmed`, `completed`, `no_show`, `rescheduled`).

6. **Visual Automations & Qualifier Flows (`/automations`, `/flows`):**
   - Drag-and-drop visual flow builder (`@xyflow/react` + `@dagrejs/dagre`).
   - Inbound lead qualification bot asking budget, configuration, and timeline before handing off to a human agent.
   - Rule-based triggers: keyword matching, SLA breaches, site-visit reminders, and stale-lead auto-nudges.

7. **Broadcast Campaigns (`/broadcasts`):**
   - Multi-step template broadcast wizard with contact segment targeting.
   - Global real estate broadcast template library (`broadcast_templates`).
   - Resumable background dispatching with CSV parameter mapping and delivery telemetry (`sent`, `delivered`, `read`, `replied`).

8. **AI Co-Pilot & Knowledge Base (`/agents`):**
   - Real estate knowledge base supporting PDF/text document uploads chunked with `pgvector` full-text search.
   - AI auto-reply bot with configurable response caps, system prompt editor, and seamless human handoff.
   - AI draft assistance directly within the message composer.

9. **Team Command Center & Leaderboard (`/team`):**
   - Real-time agent availability switcher (`profiles.is_available`).
   - Workload capacity progress bars and monthly site-visit target attainment (`agent_targets`).
   - First-response SLA monitoring and average response time metrics.
   - **Unassigned Lead Pool:** Central staging area with 1-click claim and reassign controls.
   - Printable team performance reports with clean print-media layouts.

10. **Portal Integrations (`/integrations`):**
    - Connection tiles for Indian portals: 99acres, MagicBricks, Housing.com, NoBroker, and Meta Lead Ads.
    - Webhook setup modals with secret tokens, API documentation, and test lead simulation.

11. **Public REST API (`/api/v1`) & Model Context Protocol (MCP Server):**
    - High-performance REST API secured by scoped API keys (`wacrm_live_*`).
    - Dedicated Model Context Protocol server (`wacrm-mcp` in `mcp-server/`) enabling AI assistants (Claude, Cursor, etc.) to query and drive CRM operations in natural language.

---

## 2. HARDWARE, STACK & VERSION INVARIANTS

Do NOT guess dependencies or framework versions. The repository relies on specific versions with strict rules:

| Layer           | Exact Technology & Version                          | Critical Agent Invariants                                                                                                                                                                                                   |
| :-------------- | :-------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**   | Next.js 16.3.5 (App Router, Turbopack)              | Use `useRouter().push()` in event handlers. **NEVER use `window.location.href = ...`** for internal routing.                                                                                                                |
| **UI Runtime**  | React 19.2.4                                        | **React 19 Effect Rule:** Synchronous `setState` in `useEffect` triggers cascading render errors. Defer initial fetches with `const timer = setTimeout(() => { void fetchData(); }, 0); return () => clearTimeout(timer);`. |
| **Language**    | TypeScript ^6 (`tsc --noEmit`)                      | Strict type checking. Zero `any` where types are available in `src/types/index.ts`.                                                                                                                                         |
| **Styling**     | Tailwind CSS v4 (`@tailwindcss/postcss`)            | Use existing CSS variables defined in `src/app/globals.css`. Do not introduce parallel token frameworks or hardcoded hex colors.                                                                                            |
| **Components**  | shadcn based on **`@base-ui/react`**                | **CRITICAL: NEVER IMPORT FROM `@radix-ui/*`**. All primitives in `src/components/ui/*.tsx` wrap `@base-ui/react`. Always inspect the target `components/ui/` file for exact prop signatures.                                |
| **Icons**       | `lucide-react`                                      | Exclusive icon library. Small WhatsApp icons use clean inline SVG or `MessageCircle`.                                                                                                                                       |
| **Toasts**      | `sonner` via `components/themed-toaster.tsx`        | Use `toast.success()`, `toast.error()`, or `toast.info()`.                                                                                                                                                                  |
| **Database**    | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) | Human auth uses cookie sessions; Public API (`/api/v1`) uses `requireApiKey`. Service-role queries must explicitly filter by `account_id`.                                                                                  |
| **i18n**        | `next-intl`                                         | **MANDATORY.** Zero hardcoded English strings in JSX. Strict parity across 4 locales (`en`, `es`, `ko`, `pt`).                                                                                                              |
| **Drag & Drop** | `@dnd-kit/core` & `@dnd-kit/sortable`               | Used in Pipeline Kanban boards. Touch sensors configured for mobile.                                                                                                                                                        |
| **Visual Flow** | `@xyflow/react` + `@dagrejs/dagre`                  | Visual flow canvas for qualifier and automation trees.                                                                                                                                                                      |
| **Charts**      | `recharts` + `components/tremor/*`                  | Local chart wrappers for analytics and metric tiles.                                                                                                                                                                        |
| **Testing**     | Vitest (`vitest run`)                               | **96 test suites with 1,076+ tests** must all pass without failures.                                                                                                                                                        |

---

## 3. DIRECTORY MAP & RESPONSIBILITY BOUNDARIES

```
wacrm/
├── messages/                  # next-intl translations (en.json, es.json, ko.json, pt.json) - STRICT PARITY
├── supabase/
│   ├── migrations/            # SQL migrations (001_*.sql to 130_*.sql - IMMUTABLE)
│   └── ci/                    # verify-schema.sql, verify-rls-isolation.sql
├── mcp-server/                # Model Context Protocol server (published as wacrm-mcp)
├── src/
│   ├── app/
│   │   ├── (auth)/            # Auth routes: login, signup, forgot-password
│   │   ├── (dashboard)/       # Authenticated dashboard views:
│   │   │   ├── inbox/         # Shared WhatsApp chat workspace & conversation list
│   │   │   ├── contacts/      # Leads management (table, mobile cards, filters, bulk reassign)
│   │   │   ├── pipelines/     # Sales pipelines & deals Kanban + table view
│   │   │   ├── properties/    # Inventory listings, RERA compliance, specs, brochure share
│   │   │   ├── site-visits/   # Scheduled visits, pickup logistics, confirmation statuses
│   │   │   ├── team/          # Manager Command Center, targets, agent availability, unassigned pool
│   │   │   ├── automations/   # Trigger-action rules
│   │   │   ├── flows/         # Visual qualifier flow builder (@xyflow/react)
│   │   │   ├── broadcasts/    # WhatsApp broadcast campaign wizard
│   │   │   ├── integrations/  # Portal lead connections (99acres, MagicBricks, Housing, NoBroker)
│   │   │   ├── agents/        # AI playground, knowledge base dropzone, prompt editor
│   │   │   ├── notifications/ # User and manager notification center
│   │   │   └── settings/      # Account settings (WhatsApp, Team, API keys, Billing, Appearance)
│   │   ├── join/[token]/      # Invite-acceptance flow
│   │   ├── offline/           # PWA offline fallback screen
│   │   └── api/
│   │       ├── v1/            # PUBLIC REST API (scoped strictly by account_id via API key)
│   │       ├── whatsapp/      # Meta webhook, outbound send, media, templates, test connection
│   │       ├── portal/        # Inbound portal webhooks (email forwarding parser, webhook leads)
│   │       ├── account/       # Account members, availability, invitations, routing rules
│   │       ├── ai/            # AI autoreply, draft generation, knowledge base upload
│   │       └── [internal]/    # Tasks, contacts, deals, quick-replies, flows
│   ├── components/
│   │   ├── ui/                # Base primitives (@base-ui/react wrapped: button, dialog, select, etc.)
│   │   ├── layout/            # page-header, sidebar, header, bottom-nav, pull-to-refresh
│   │   ├── inbox/             # message-bubble, message-composer, message-thread, conversation-list, contact-sidebar
│   │   ├── contacts/          # contact-form, contact-detail-view, bulk-reassign-modal, import-modal
│   │   ├── properties/        # property-form-modal, property-share-modal, property-delete-dialog, emi-calculator
│   │   ├── site-visits/       # schedule-visit-sheet, visit cards, calendar view
│   │   ├── pipelines/         # deal-form, lost-reason-modal, pipeline-board, deal-table
│   │   ├── team/              # agent-card, agent-table, unassigned-pool, pipeline-funnel, set-target-modal
│   │   ├── flows/             # flow-builder, flow-canvas, node-config-form
│   │   └── broadcasts/        # step1..step4 broadcast wizard components
│   ├── hooks/                 # use-auth, use-can, use-realtime, use-presence, use-theme, use-total-unread
│   ├── lib/
│   │   ├── auth/              # roles.ts (SINGLE SOURCE OF TRUTH for RBAC), api-context.ts, account.ts
│   │   ├── currency.ts        # formatINR(), formatINRRange(), formatCurrency()
│   │   ├── contacts/          # parse-budget.ts, dedupe.ts, tag-write.ts
│   │   ├── whatsapp/          # send-message.ts, meta-api.ts, webhook handlers, phone-utils.ts, encryption.ts
│   │   ├── supabase/          # client.ts (browser), server.ts (SSR)
│   │   ├── api/v1/            # pagination.ts, respond.ts, shared resource helpers
│   │   └── rate-limit.ts      # deliberate in-memory rate limiter for single-instance VPS
│   └── types/index.ts         # CANONICAL TypeScript definitions for all DB entities
```

---

## 4. DATABASE ARCHITECTURE, 3 ID SPACES, RBAC & RLS

### A. The 3 Distinct ID Spaces (DO NOT CONFUSE)

1. **`accounts.id` (UUID):** The multi-tenant root organization/brokerage ID.
   - Present on all account-scoped tables (`contacts`, `properties`, `site_visits`, `whatsapp_config`, `lead_details`).
   - In `/api/v1/*` routes, the service-role client **must explicitly filter every query by `ctx.accountId`** because service-role bypasses RLS.
2. **`profiles.id` (UUID):** The primary key of the `profiles` table.
   - Referenced by `deals.assigned_to`, `agent_targets.user_id`, etc.
3. **`auth.users.id` (UUID):** Supabase internal auth ID.
   - Referenced by `conversations.assigned_agent_id`, `contacts.user_id`, `accounts.owner_user_id`, and `profiles.user_id`.
   - **Dual Lookup Rule:** When resolving agent names for assignees across contacts, conversations, and deals, always maintain dual lookup maps (`profilesById` and `profilesByUserId`).

### B. Role-Based Access Control (RBAC Authority)

- Hierarchy: `"owner"` (4) > `"admin"` (3) > `"agent"` (2) > `"viewer"` (1).
- Authority Column: `profiles.account_role` (migration 017). The old `profiles.role` column is dead legacy code; never read it.
- **Rule:** **NEVER compare role strings inline** (e.g. `role === 'admin'`). Always use the predicate functions in `src/lib/auth/roles.ts`:
  - `canManageMembers(role)`: Admin/Owner only (invites, role changes, member removal).
  - `canEditSettings(role)`: Admin/Owner only (WABA configuration, templates, pipelines).
  - `canSendMessages(role)`: Agent, Admin, Owner (Viewers are read-only).
  - `canViewOnly(role)`: True for Viewer only (useful for read-only banners and tooltips).
  - `canDeleteAccount(role)` / `canTransferOwnership(role)`: Owner only.
  - `canMoveDeal(role, dealAssignedTo, contactAssignedAgentId, currentUserId)`: Agents can only move their own deals; Admins/Owners can move any deal.
  - `canCreateBroadcast(role)`: Admin/Owner only.
  - `canManageLead(role, assignedAgentId, currentUserId)`: Agents can only manage/reply to leads assigned to themselves; Admins/Owners can manage all leads.
  - `canClaimLead(role, assignedAgentId)`: Agents and Admins can claim unassigned leads (`assignedAgentId === null`).
  - `canReassignLead(role)`: Admin/Owner only.
  - `canReleaseLead(role, assignedAgentId, currentUserId)`: Agents can release their own lead back to the unassigned pool; Admins can release any lead.
  - `hasMinRole(role, minRole)`: Rank comparison.
  - In React components: `const isViewOnly = useCan('view-only');`.

### C. Row Level Security (RLS)

- Every account-scoped table enforces tenant isolation via the Postgres helper function:
  `is_account_member(account_id, min_role?)`
- **Rule:** Never loosen, bypass, or delete an existing RLS policy. When creating new tables, always copy the policy pattern from recent migrations (e.g., `129_deal_lifecycle_fields.sql`, `130_properties_admin_manage_only.sql`).

### D. Migration Rules

- Existing migrations `001_*.sql` through `130_*.sql` are **IMMUTABLE**. Never edit, renumber, or delete them.
- Any future schema change requires a strictly incremented migration file (`131_*.sql` onwards) and must update `docs/agent/SCHEMA_REFERENCE.md`.

---

## 5. META WHATSAPP CLOUD API & MESSAGING ARCHITECTURE

### A. Core Messaging Pipeline

All outbound messages go through `sendMessage()` in `src/lib/whatsapp/send-message.ts`:

1. **Validation:** Checks payload shape based on `messageType` (`text`, `template`, `interactive`, `image`, `video`, `document`, `audio`).
2. **Identity & Phone Normalization:** Resolves Indian phone variations (`phoneVariants()` handles `+91`, `91`, leading `0`, and unformatted numbers). If Meta accepts a corrected variant, `contacts.phone` is auto-updated in the database.
3. **Encrypted Credentials:** Per-account credentials stored encrypted in `whatsapp_config` using `ENCRYPTION_KEY`.
4. **Meta Cloud API Dispatch:** Dispatches to Graph API (v21.0/v22.0).
5. **Persistence & Speed-to-Lead Auto-Claim:** Inserts the message record in `messages`, updates `conversations.last_message_at`, and **if the conversation is unassigned and an agent dispatches a reply, automatically claims and assigns it to that agent**.
6. **Active Flow Yield:** Sending an agent reply automatically pauses any active automated Flow run for that contact (`status = 'paused_by_agent'`, `end_reason = 'agent_replied'`).

### B. The 24-Hour Customer Service Window Rule

Meta enforces strict anti-spam messaging windows:

- **Inside 24 Hours (`<= 24h` since last inbound customer message):**
  - Agents can send free-form text, quick replies, images, PDF brochures, cost sheets, and interactive messages.
  - The UI displays a green session badge (`"Xh remaining"`).
- **Outside 24 Hours (`> 24h` since last inbound message or no customer message yet):**
  - Free-form text and media sends are **BLOCKED** by Meta.
  - The UI displays a red session banner (`"Session Expired"`), disables the text composer, and requires sending an approved WhatsApp Template (`message_templates`).
  - When the customer replies to the template, the 24-hour customer service window reopens immediately.

### C. Multi-WABA and Webhook Architecture

- Supported setups (`docs/multi-waba.md`):
  - Setup A: Many accounts, one Meta App, many WABAs (differentiated by `phone_number_id`).
  - Setup B: WABAs under multiple Meta Apps (webhook validates against comma-separated `META_APP_SECRET`).
- Webhook Handshake: `GET /api/whatsapp/webhook` verifies `hub.verify_token`.
- Webhook Ingestion: `POST /api/whatsapp/webhook` validates `x-hub-signature-256`, deduplicates payloads, automatically creates contacts/conversations, and reopens closed conversations on customer replies.
- Media Mirroring: When `whatsapp_config.mirror_inbound_media` is enabled, media files delivered by Meta (which expire in minutes) are mirrored directly into Supabase Storage.

---

## 6. LEAD DISTRIBUTION, ROUTING RULES & MULTI-AGENT WORKFLOWS

### A. Lead Routing Engine (`src/lib/automations/engine.ts`)

Incoming leads are routed through an automated hierarchy:

1. **Lead Routing Rules (`lead_routing_rules`):** Evaluated by priority order.
   - Condition Types: `source` (e.g. 99acres), `budget_gte` (e.g. >= ₹2 Cr), `budget_lte`, `location_contains`, `configuration` (e.g. 3BHK).
   - Actions: `assign_to_agent` (specific user) or `assign_to_role` (distributes to least-loaded available agent with that role).
2. **Round-Robin Workload Balancing:** Fallback if no specific rule matches.
   - Evaluates active agents (`account_role = 'agent'`, `is_available = true`).
   - Counts currently open conversations (`status = 'open'`) per agent.
   - Assigns the new lead to the agent with the lowest open workload.
3. **Agent Availability & On-Leave Awareness:**
   - Agents can toggle availability from the sidebar or header (`profiles.is_available`).
   - The router completely skips unavailable agents.
4. **Unassigned Lead Pool & Manager Alerts:**
   - If all agents are unavailable or no routing rules match, the conversation remains unassigned (`assigned_agent_id = null`).
   - Lead appears in the **Unassigned Pool** on `/team` and the "Unassigned" tab in `/inbox`.
   - Push/In-app notification is sent to account admins.

### B. Lead Claiming & Peer Protection Workflows

- **Atomic Claiming:** When an agent clicks "Claim Lead", the update runs:
  ```ts
  supabase
    .from('conversations')
    .update({ assigned_agent_id: currentUserId })
    .eq('id', conversationId)
    .is('assigned_agent_id', null);
  ```
  If 0 rows are affected, another agent claimed it concurrently, preventing double-claiming race conditions.
- **Peer Lead Lock (Anti-Poaching):** If a lead is assigned to another agent:
  - The message composer is disabled with a lock banner: `"This conversation is assigned to [Agent Name]. You have view-only access."`
  - Contact qualification inputs are read-only.
  - Peer agents cannot reassign leads to arbitrary teammates.
  - Managers (`admin`, `owner`) retain full override authority.
- **Lead Release:** If an agent cannot service a claimed lead, they can click "Release to Pool". The lead returns to the unassigned pool with an audit trail entry in `assignment_history` (`reason = 'release_pool'`).
- **Seamless Tab Switching:** When an agent claims an unassigned lead, the inbox UI automatically detects the atomic assignment transition and switches the active tab from "Unassigned" to "Mine" without losing scroll or selection context.

---

## 7. INDIAN REAL ESTATE DOMAIN & DATA SHAPES

### A. Indian Currency & Real Estate Attributes

- **INR Formatting:** Must always use `formatINR(value)` or `formatINRRange(min, max)` from `@/lib/currency.ts` (e.g. `₹45 L`, `₹1.65 Cr`, `₹2.25 Cr`). Never format Indian budgets with standard Western million/thousand delimiters.
- **Budget Text Parsing:** Use `parseBudget(input)` from `@/lib/contacts/parse-budget.ts` which handles Indian colloquialisms (`"1.5 cr"`, `"85 lac"`, `"50L"`, `"1.2 crore"`).
- **Configurations:** Canonical list in `PROPERTY_CONFIGURATIONS` from `@/types` (`1BHK`, `2BHK`, `3BHK`, `4BHK`, `Studio`, `Villa`, `Plot`, `Commercial`).
- **RERA Compliance:** Real estate inventory requires a `rera_id`. RERA Act 2016 warnings must be displayed on listings lacking registration IDs.
- **Possession Statuses:** `'ready_to_move' | 'under_construction' | 'nearing_possession'`.
- **Facing Directions:** `'East' | 'North' | 'North-East' | 'West' | 'South' | 'North-West' | 'South-East' | 'South-West'`.

### B. Core Real Estate Tables

- `lead_details`: 1-to-1 extension of `contacts` with `source`, `location_preference`, `budget_min`, `budget_max`, `configuration_preference` (text array), `possession_preference`, and `intent`.
- `properties`: Inventory listings with `title`, `project_name`, `builder_name`, `location`, `price`, `property_type`, `bedrooms`, `configuration`, `carpet_area`, `facing`, `rera_id`, `possession_status`, `possession_date`, `tags`.
  - _Protected by Migration 130: write=admin+, read=all members._
- `site_visits`: Scheduled visits with `contact_id`, `property_id`, `scheduled_at`, `status` (`pending`, `confirmed`, `completed`, `no_show`, `rescheduled`), `pickup_required`, `pickup_location`, `reminded_24h`, `reminded_2h`, `notes`.
- `deals`: Pipeline deals with `status` (`open`, `won`, `lost`), `closed_at`, `lost_reason_id`, `lost_note`, `lost_from_stage_id`, `won_value`, `reopened_count`, `last_activity_at`, `re_engage_on`.
- `lost_reasons`: Account-scoped lookup table of loss reasons (seeded with 8 real estate defaults per account).
- `assignment_history`: Immutable audit trail documenting `from_agent_id`, `to_agent_id`, `actor_id`, and `reason` (`'claim'`, `'release_pool'`, `'manual_reassign'`, `'round_robin'`, `'routing_rule'`).
- `agent_targets`: Monthly site-visit targets per agent (`target_visits`, `month`).

---

## 8. STRICT 4-LOCALE i18n RULES (ZERO-DRIFT GUARANTEE)

The repository uses `next-intl`. A dedicated test suite (`src/i18n/messages.test.ts`) enforces strict parity across all 4 locales on every commit:

- `messages/en.json` (English - source of truth)
- `messages/es.json` (Spanish)
- `messages/pt.json` (Portuguese)
- `messages/ko.json` (Korean)

### Mandatory Invariants:

1. **No Hardcoded English in JSX:** Always route strings through `const t = useTranslations('Namespace');`.
2. **Exact Key Hierarchy Parity:** If you add a key `Properties.page.filterConfig` in `en.json`, you **MUST** simultaneously add `Properties.page.filterConfig` in `es.json`, `pt.json`, and `ko.json`.
3. **Identical ICU Token Signatures:** Every ICU placeholder argument must be identical across all 4 files. If `en.json` uses `{count}` or `{title}` or `{formatted}`, translations must preserve `{count}`, `{title}`, `{formatted}` without renaming or omitting.
4. **Verification Command:** Always verify with `npx vitest run src/i18n/messages.test.ts`.

---

## 9. UI/UX BENCHMARK & MOBILE ADAPTATION STANDARD

The application adheres to a strict 6-viewport standard (`375px` Small Mobile, `390px` iPhone, `412px` Android, `768px` Tablet, `1440px` Desktop, `1920px` Ultrawide):

1. **Situational Awareness KPI Strip:** Top-of-page stat cards (3–4 cards) displaying high-level operational counts (e.g. Total Units, Active Deals, Pipeline Value in ₹ Cr) with responsive grids.
2. **Omni-Search & Multi-Dimensional Filters:** Search input covering titles, names, locations, and IDs with a clear button, plus dropdown selects for config, type, status, and price, with an active filter counter and "Clear all" button.
3. **Desktop High-Density View:** Clean table or grid view with no horizontal overflow, truncated text with tooltips, clear badges (RERA, SLA, sources), live ₹ INR formatting, and 1-click inline action buttons.
4. **Dedicated Native Mobile Layout (`< 768px`):**
   - **Never allow cramped or horizontal scrolling tables on mobile.**
   - Tables convert into rich stacked cards with 1-tap touch action buttons (`tel:`, WhatsApp chat, Schedule Visit).
   - **Inbox Master-Detail:** 3 panes on desktop transform into single-pane push-pop navigation on mobile: Conversation List -> Message Thread (with sticky back button `<`) -> Slide-over Contact Sheet (`Sheet` / `Drawer`).
   - **Pipeline Kanban:** Drag-and-drop on desktop transforms into segmented stage switcher pills on mobile (`[New (4)] [Contacted (2)] [Visit (3)]`).
   - Touch targets must be at least `44 × 44 px`. Bottom navigation respects `pb-safe` and `env(safe-area-inset-bottom)`.
5. **Centralized Design Tokens:**
   - **Zero Hardcoded Colors:** No raw hex codes (`#10b981`, `#ffffff`) in component JSX. Use theme variables from `src/app/globals.css` (`bg-background`, `bg-card`, `bg-card-2`, `bg-muted`, `text-foreground`, `border-border`).
6. **Cross-Module Wiring:**
   - Scheduling a visit from a property pre-fills `defaultPropertyId` in `ScheduleVisitSheet`.
   - Scheduling a visit from a lead pre-fills `defaultContactId`.
   - Sharing inventory opens formatted WhatsApp brochure messages directly in `/inbox`.

---

## 10. PUBLIC REST API (`/api/v1`) & MODEL CONTEXT PROTOCOL (MCP)

### A. Public REST API Pattern

Every `/api/v1/*` route follows a strict security discipline (see `src/app/api/v1/contacts/route.ts`):

```ts
try {
  const ctx = await requireApiKey(request, 'contacts:read');
  // ctx.supabase  — service-role client (BYPASSES RLS)
  // ctx.accountId — tenant ID
  // CRITICAL: MUST explicitly filter EVERY database query by ctx.accountId!
  const { data } = await ctx.supabase
    .from('contacts')
    .select('*')
    .eq('account_id', ctx.accountId);
  return toSuccessResponse(data);
} catch (err) {
  return toApiErrorResponse(err);
}
```

- API keys format: `wacrm_live_*` stored as SHA-256 hashes in `api_keys`.
- Standard Scopes: `messages:send`, `messages:read`, `contacts:read`, `contacts:write`, `conversations:read`, `broadcasts:send`, `webhooks:manage`.

### B. Model Context Protocol (MCP Server)

The `mcp-server/` directory contains the official MCP server package (`wacrm-mcp`):

- Connects AI assistants (Claude Desktop, Cursor, etc.) directly to the CRM via natural language.
- Exposes tools: `whoami`, `list_contacts`, `get_contact`, `list_conversations`, `get_messages`, `send_message`, `create_contact`.
- Safety rule: Read-only by default. Mutations require explicit `WACRM_ENABLE_WRITES=true` in environment configuration.

---

## 11. PROTECTED FILES (NEVER MODIFY WITHOUT FLAGGING)

1. **`supabase/migrations/001_*.sql` through `130_*.sql`** — strictly immutable. Any new migration starts at `131_*.sql`.
2. **Existing RLS Policies** — tenant isolation via `is_account_member(account_id, min_role)` is paramount.
3. **`src/middleware.ts`** — contains critical session-refresh logic (`withRefreshedCookies`) fixing production bug #288 (session wedging after idle). Any redirect branch must reuse this helper.
4. **`src/lib/rate-limit.ts`** — deliberately in-memory for single-instance VPS architecture.
5. **`src/lib/auth/roles.ts`** — centralized RBAC authority. Add new capability predicates here; do not rewrite or open-code role strings.
6. **`AGENTS.md` `<!-- BEGIN:nextjs-agent-rules -->` block** — framework-managed; preserve as is.

---

## 12. DEFINITION OF DONE & VERIFICATION GATES

Before considering any task or pull request complete, you MUST execute and pass all verification gates in the terminal:

```bash
# 1. Fast TypeScript compilation check (must exit with 0 errors)
npm run typecheck

# 2. ESLint check (must pass with 0 errors)
npm run lint

# 3. Code formatting check (Prettier)
npm run format:check

# 4. i18n parity check (must pass all 10 tests across 4 locales)
npx vitest run src/i18n/messages.test.ts

# 5. Full test suite (all 96 test suites, 1,076+ tests must pass)
npm run test
```

If any check fails, resolve it before declaring the task finished.

---

## 13. DEVELOPER CHEATSHEET & COMMON TASK RECIPES

### Recipe 1: Adding a New Database Migration

1. Name file `supabase/migrations/131_<snake_case_description>.sql` (strictly incremented from 130).
2. For account-scoped tables, always enforce RLS:
   ```sql
   ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
   CREATE POLICY my_table_tenant_isolation ON my_table
     FOR ALL USING (is_account_member(account_id));
   ```
3. Update `docs/agent/SCHEMA_REFERENCE.md` table inventory.
4. Verify schema with `supabase/ci/verify-schema.sql`.

### Recipe 2: Adding a New Dashboard Route

1. Create page under `src/app/(dashboard)/<feature>/page.tsx`.
2. Wrap content with responsive layouts supporting desktop table and mobile stacked cards.
3. Add i18n translation strings under a dedicated namespace across all 4 files: `en.json`, `es.json`, `ko.json`, `pt.json`.
4. Run `npx vitest run src/i18n/messages.test.ts`.

### Recipe 3: Dispatching a WhatsApp Message

1. Use `sendMessage()` from `@/lib/whatsapp/send-message.ts`.
2. Do not call Meta API endpoints directly; `sendMessage` automatically handles encryption, phone normalization, auto-claim, flow pausing, and DB persistence.
3. Check session window: if expired (>24h), dispatch with `messageType: 'template'`.

### Recipe 4: Checking User Permissions

- In backend / API routes:
  ```ts
  import { canManageLead, canManageMembers } from '@/lib/auth/roles';
  if (!canManageLead(accountRole, conversation.assigned_agent_id, user.id)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  ```
- In React components:
  ```tsx
  import { useCan } from '@/hooks/use-can';
  const isViewOnly = useCan('view-only');
  const canManage = useCan('manage-members');
  ```
