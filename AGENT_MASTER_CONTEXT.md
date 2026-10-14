# WaCRM: Master Agent Architecture, Guardrails & Context Guide

> **TARGET AUDIENCE:** Any AI Agent, LLM, or Engineer working on this repository in a fresh or existing session.
> **HOW TO USE:** Attach or include this document at the start of any new agent conversation. It contains the verified architectural ground truth, database conventions, component invariants, and definition-of-done checklists required to write zero-regression code.

---

## 1. PROJECT VISION & OVERVIEW

**WaCRM** is a multi-tenant, WhatsApp-first **B2B Real Estate Vertical CRM** built for Indian and global property developers, brokerages, and sales teams (typically 10–50+ agents managed by team owners/managers).

### Core Functional Modules:

1. **Shared WhatsApp Inbox:** Multi-agent conversation management, template dispatch, media rendering, and AI auto-replies.
2. **Contacts & Leads:** Lead capture from portals (99acres, MagicBricks, Housing.com, NoBroker, Meta Ads), lead qualification (budget in INR, BHK configurations, location preferences), SLA badges, and auto-routing.
3. **Deals & Pipelines:** Drag-and-drop Kanban board (`@dnd-kit`), strict deal lifecycle tracking (Won/Lost states, `lost_reasons` lookup, re-engagement dates, frozen close timestamps).
4. **Site Visits:** Field visit scheduling, pickup logistics, agent assignments, automated T-24h / T-2h reminders, and automated no-show recovery flows.
5. **Properties & Inventory:** Listings repository, unit specs, carpet area, facing direction, RERA compliance badges, live ₹ INR pricing, and 1-click WhatsApp brochure sharing.
6. **Automations & Flows:** Visual flow builder (`@xyflow/react`) for inbound lead qualifier flows, appointment reminders, and automated stage movement.
7. **Team Command Center & RBAC:** Role-based dashboards, agent availability toggles, response SLAs, conversion analytics, and audit trails.

---

## 2. HARDWARE, STACK & VERSION INVARIANTS

Do NOT guess dependencies or framework versions. The repository relies on specific versions with strict rules:

| Layer          | Exact Technology & Version                          | Critical Agent Invariants                                                                                                                                                                                                   |
| :------------- | :-------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**  | Next.js 16.3.5 (App Router, Turbopack)              | Use `useRouter().push()` in event handlers. **NEVER use `window.location.href = ...`** for internal routing.                                                                                                                |
| **UI Runtime** | React 19.2.4                                        | **React 19 Effect Rule:** Synchronous `setState` in `useEffect` triggers cascading render errors. Defer initial fetches with `const timer = setTimeout(() => { void fetchData(); }, 0); return () => clearTimeout(timer);`. |
| **Language**   | TypeScript ^6 (`tsc --noEmit`)                      | Strict type checking. Zero `any` where types are available in `src/types/index.ts`.                                                                                                                                         |
| **Styling**    | Tailwind CSS v4 (`@tailwindcss/postcss`)            | Use existing CSS variables defined in `src/app/globals.css`. Do not introduce parallel token frameworks.                                                                                                                    |
| **Components** | shadcn based on **`@base-ui/react`**                | **CRITICAL: NEVER IMPORT FROM `@radix-ui/*`**. All primitives in `src/components/ui/*.tsx` wrap `@base-ui/react`. Always inspect the target `components/ui/` file for exact prop signatures.                                |
| **Icons**      | `lucide-react`                                      | Exclusive icon library. Small WhatsApp icons use clean inline SVG or `MessageCircle`.                                                                                                                                       |
| **Toasts**     | `sonner` via `components/themed-toaster.tsx`        | Use `toast.success()`, `toast.error()`, or `toast.info()`.                                                                                                                                                                  |
| **Database**   | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) | Human auth uses cookie sessions; Public API (`/api/v1`) uses `requireApiKey`.                                                                                                                                               |
| **i18n**       | `next-intl`                                         | **MANDATORY.** Zero hardcoded English strings in JSX. Strict parity across 4 locales (`en`, `es`, `ko`, `pt`).                                                                                                              |
| **Testing**    | Vitest (`vitest run`)                               | 89+ test suites with 1,024+ tests must all pass without failures.                                                                                                                                                           |

---

## 3. DIRECTORY MAP & RESPONSIBILITY BOUNDARIES

```
wacrm/
├── messages/                  # next-intl translations (en.json, es.json, ko.json, pt.json) - STRICT PARITY
├── supabase/
│   └── migrations/            # SQL migrations (001_*.sql to 129_*.sql - IMMUTABLE)
├── src/
│   ├── app/
│   │   ├── (auth)/            # Auth routes (login, signup, forgot-password)
│   │   ├── (dashboard)/       # Authenticated dashboard views:
│   │   │   ├── contacts/      # Leads management (table, mobile cards, filters, bulk actions)
│   │   │   ├── inbox/         # Shared WhatsApp chat workspace
│   │   │   ├── pipelines/     # Sales pipelines & deals Kanban
│   │   │   ├── properties/    # Inventory listings, RERA compliance, specs, brochure share
│   │   │   ├── site-visits/   # Scheduled visits, pickup logistics, confirmation statuses
│   │   │   ├── team/          # Manager Command Center, agent targets, availability
│   │   │   ├── automations/   # Trigger-action rules
│   │   │   └── flows/         # Visual qualifier flow builder
│   │   └── api/
│   │       ├── v1/            # PUBLIC REST API (scoped strictly by account_id via API key)
│   │       └── [internal]/    # Dashboard server actions & webhooks
│   ├── components/
│   │   ├── ui/                # Base primitives (@base-ui/react wrapped: button, dialog, select, etc.)
│   │   ├── layout/            # page-header, sidebar, header, pull-to-refresh
│   │   ├── contacts/          # contact-form, contact-detail-view, bulk-reassign-modal
│   │   ├── properties/        # property-form-modal, property-share-modal, property-delete-dialog, emi-calculator
│   │   ├── site-visits/       # schedule-visit-sheet, visit cards
│   │   └── pipelines/         # deal-form, lost-reason-modal, pipeline-board
│   ├── hooks/                 # use-auth, use-can, use-realtime, use-theme
│   ├── lib/
│   │   ├── auth/              # roles.ts (SINGLE SOURCE OF TRUTH for RBAC), api-context.ts, account.ts
│   │   ├── currency.ts        # formatINR(), formatCurrency()
│   │   ├── contacts/          # parse-budget.ts, dedupe.ts, tag-write.ts
│   │   ├── supabase/          # client.ts (browser), server.ts (SSR)
│   │   └── whatsapp/          # Meta API, webhooks, message sender, template validators
│   └── types/index.ts         # CANONICAL TypeScript definitions for all DB entities
```

---

## 4. DATABASE INVARIANTS, ID SPACES & RLS

### A. The 3 Distinct ID Spaces (DO NOT CONFUSE)

1. **`accounts.id` (UUID):** The multi-tenant root. Every organization/brokerage has one `account_id`.
   - In `/api/v1/*` routes, the service-role client **must explicitly filter every query by `ctx.accountId`** because service-role bypasses RLS.
2. **`profiles.id` (UUID):** The primary key of the `profiles` table.
   - Referenced by `deals.assigned_to`, `agent_availability.user_id`, etc.
3. **`auth.users.id` (UUID):** Supabase internal auth ID.
   - Referenced by `conversations.assigned_agent_id`, `contacts.user_id`, and `accounts.owner_user_id`.
   - **Agent Rule:** When resolving agent names for assignees across contacts, conversations, and deals, always maintain dual lookup maps (`profilesById` and `profilesByUserId`).

### B. Role-Based Access Control (RBAC)

- Roles in order of rank: `"owner" > "admin" > "agent" > "viewer"`.
- Column: `profiles.account_role` (migration 017). The old `profiles.role` column is dead legacy code; never read it.
- **Rule:** **NEVER compare role strings inline** (e.g. `role === 'admin'`). Always call the predicates in `src/lib/auth/roles.ts`:
  - `canManageMembers(accountRole)`
  - `canEditSettings(accountRole)`
  - `canSendMessages(accountRole)`
  - `canViewOnly(accountRole)`
  - In React components, use `const isViewOnly = useCan('view-only');`.

### C. Row Level Security (RLS)

- Every account-scoped table enforces tenant isolation via the Postgres helper function:
  `is_account_member(account_id, min_role?)`
- **Rule:** Never loosen, bypass, or delete an existing RLS policy.

### D. Migration Rules

- Existing migrations `001_*.sql` through `129_*.sql` are **IMMUTABLE**. Never edit, renumber, or delete them.
- Any future schema change requires a strictly incremented migration file (`130_*.sql` onwards) and must update `docs/agent/SCHEMA_REFERENCE.md`.

---

## 5. REAL ESTATE DOMAIN & DATA SHAPES

### A. Indian Real Estate Fields

- **Budgets & Prices:** Must always be formatted using `formatINR()` from `@/lib/currency.ts` (e.g. `₹50 L`, `₹1.5 Cr`, `₹2.25 Cr`).
- **Text Budget Parsing:** Use `parseBudget(input)` from `@/lib/contacts/parse-budget.ts` which handles strings like `"1.5 cr"`, `"85 lac"`, `"50L"`, or raw numbers.
- **Configurations:** Use `PROPERTY_CONFIGURATIONS` from `@/types` (`1BHK`, `2BHK`, `3BHK`, `4BHK`, `Studio`, `Villa`, `Plot`, `Commercial`).
- **RERA Compliance:** Properties require a `rera_id`. Missing RERA IDs must show warning indicators in line with RERA Act 2016 guidelines.
- **Possession Statuses:** `'ready_to_move' | 'under_construction' | 'nearing_possession'`.
- **Facing Directions:** `'East' | 'North' | 'North-East' | 'West' | 'South' | 'North-West' | 'South-East' | 'South-West'`.

### B. Key Table Extensions

- `lead_details`: 1-to-1 extension of `contacts` with `source`, `location_preference`, `budget_min`, `budget_max`, `configuration_preference` (array), `possession_preference`.
- `properties`: Inventory listings with `title`, `project_name`, `builder_name`, `location`, `price`, `property_type`, `bedrooms`, `configuration`, `carpet_area`, `facing`, `rera_id`, `possession_status`, `possession_date`, `tags`.
- `site_visits`: Scheduled visits with `contact_id`, `property_id`, `scheduled_at`, `status` (`pending`, `confirmed`, `completed`, `no_show`, `rescheduled`), `pickup_required`, `pickup_location`, `notes`.
- `deals`: Pipeline deals with `status` (`open`, `won`, `lost`), `closed_at`, `lost_reason_id`, `lost_note`, `lost_from_stage_id`, `won_value`, `reopened_count`, `last_activity_at`, `re_engage_on`.

---

## 6. STRICT 4-LOCALE i18n RULES (ZERO-DRIFT GUARANTEE)

The repository uses `next-intl`. A dedicated test suite (`src/i18n/messages.test.ts`) enforces strict parity across all 4 locales on every commit:

- `messages/en.json` (English - source of truth)
- `messages/es.json` (Spanish)
- `messages/pt.json` (Portuguese)
- `messages/ko.json` (Korean)

### Mandatory Invariants:

1. **No Hardcoded English in JSX:** Always route strings through `const t = useTranslations('Namespace');`.
2. **Exact Key Hierarchy Parity:** If you add a key `Properties.page.filterConfig` in `en.json`, you **MUST** simultaneously add `Properties.page.filterConfig` in `es.json`, `pt.json`, and `ko.json`.
3. **Identical ICU Token Signatures:** Every ICU placeholder argument must be identical across all 4 files. If `en.json` uses `{count}` or `{title}` or `{formatted}`, translations must preserve `{count}`, `{title}`, `{formatted}` without renaming.
4. **Verification Command:** Always verify with `npx vitest run src/i18n/messages.test.ts`.

---

## 7. UI/UX BENCHMARK & IMPLEMENTATION CHECKLIST

Whenever auditing or creating dashboard pages in this CRM (e.g. `/properties`, `/contacts`, `/site-visits`, `/pipelines`), you must adhere to the 6-pillar standard:

- [ ] **1. Situational Awareness KPI Strip:** Top-of-page stat cards (3–4 cards) displaying high-level operational counts (e.g., Total Units, Ready to Move, Under Construction, Portfolio Value) with responsive grids and theme tokens.
- [ ] **2. Omni-Search & Multi-Dimensional Filters:** Search input covering titles, names, locations, and IDs with a clear button, plus dropdown selects for config, type, status, and price, with an active filter counter and "Clear all" button.
- [ ] **3. Desktop High-Density View:** Clean table or grid view with no horizontal overflow, truncated text with tooltips, clear badges (RERA, status, sources), live ₹ INR formatting, and 1-click inline action buttons.
- [ ] **4. Dedicated Native Mobile Layout (`< 768px`):** Never allow cramped or horizontal scrolling tables on mobile. Condense into card views with 1-tap action buttons (Schedule Visit, Share on WhatsApp, Call, Edit).
- [ ] **5. Full Real Estate Qualification & Data Wiring:** Complete modal forms (`PropertyFormModal`, `ContactForm`, `ScheduleVisitSheet`) wired directly to Supabase tables with live INR previews, field validations, and `sonner` toast feedback.
- [ ] **6. Cross-Module Wiring:** Ensure features interconnect smoothly:
  - Scheduling a visit from a property pre-fills `defaultPropertyId` in `ScheduleVisitSheet`.
  - Scheduling a visit from a lead pre-fills `defaultContactId`.
  - Sharing inventory opens formatted WhatsApp brochure messages.

---

## 8. CODEBASE FILES THAT MUST NEVER BE MODIFIED WITHOUT FLAGGING

1. **`supabase/migrations/001_*.sql` through `129_*.sql`** — strictly immutable.
2. **Existing RLS Policies** — tenant isolation is paramount.
3. **`src/middleware.ts`** — contains critical session-refresh logic (`withRefreshedCookies`) fixing production bug #288 (session wedging after idle).
4. **`src/lib/rate-limit.ts`** — deliberately in-memory for single-instance VPS architecture.
5. **`src/lib/auth/roles.ts`** — centralized RBAC authority. Add new predicates here; do not rewrite.
6. **`AGENTS.md` `<!-- BEGIN:nextjs-agent-rules -->` block** — framework-managed; preserve as is.

---

## 9. DEFINITION OF DONE & VERIFICATION GATES

Before considering any task or pull request complete, you MUST execute and pass all verification gates in the terminal:

```bash
# 1. Fast TypeScript compilation check (must exit with 0 errors)
npm run typecheck

# 2. ESLint check (must pass with 0 errors)
npm run lint

# 3. Code formatting check (Prettier)
npm run format:check

# 4. i18n parity check (must pass 10/10 tests)
npx vitest run src/i18n/messages.test.ts

# 5. Full test suite (all 89+ test suites, 1,024+ tests must pass)
npm run test
```

If any check fails, resolve it before declaring the task finished.
