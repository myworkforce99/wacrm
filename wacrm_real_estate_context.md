# wacrm: B2B Real Estate Team CRM - Context & Knowledge Base

This document provides a comprehensive overview of the `wacrm` fork configured for a **B2B Real Estate Team CRM**. It is designed to act as a context file for AI coding agents to understand the project structure, architectural decisions, database schemas, workflow guardrails, and the end product goal.

---

## 1. Product Vision & End Goal

**Target Audience:** The project is a B2B SaaS tailored for Indian real estate businesses (10–30 agents managed by a business owner/broker).
**Primary Users:** Real estate sales agents and team managers/owners.
**Core Proposition:** A WhatsApp-based shared inbox CRM featuring contacts, pipelines (Kanban), no-code automations (qualifier flows, appointment reminders), broadcast campaigns, team dashboards, and role-based access control. The product aims to replace manual lead qualification, improve lead distribution, and provide deep visibility into agent response SLAs and conversion rates.

**Key Features (Real Estate specific extensions):**

- Real estate lead tracking (budget, location preference, property type, intent, source).
- Scheduled site visits and automated no-show recovery via WhatsApp.
- Property listing matching and distribution via WhatsApp.
- Agent accountability tracking (SLA badges, response time dashboards).

---

## 2. Technology Stack & Environment Setup

- **Framework:** Next.js 16.3.5 (App Router, Server Actions, Turbopack)
- **UI Runtime & Language:** React 19.2.4, TypeScript (v6+), `tsc --noEmit` type checking.
- **Styling & Components:** Tailwind CSS v4, `shadcn` on top of `@base-ui/react`, `lucide-react` icons.
- **Database & Auth:** Supabase (Postgres, Auth, Storage, RLS) via `@supabase/ssr` & `@supabase/supabase-js`.
- **Other Key Libraries:**
  - `next-intl` (i18n is mandatory; do not hardcode English strings).
  - `@xyflow/react` (Visual flow builder).
  - `@dnd-kit/core` (Drag and drop for pipelines).
  - `recharts` / custom tremor wrapper for charts.

### Environment variables (from `.env.local.example`):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY` (64-char hex string)
- `META_APP_SECRET`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_LOCALE` (One of `en | ko | pt | es`)

### Setup Commands:

```bash
npm install
cp .env.local.example .env.local  # Fill required vars
supabase db reset --local --no-seed # Run all migrations locally
npm run dev
```

---

## 3. Architecture & Directory Map (`src/`)

### Key Directories

- **`app/`**: Route definitions using Next.js App Router.
  - `(auth)/`: Login, signup, invite flows.
  - `(dashboard)/`: Authenticated dashboard routes (contacts, inbox, pipelines, automations, settings, etc.).
  - `api/v1/`: Public REST API routes requiring API Key authentication.
- **`components/`**: Modularized UI components.
  - `ui/`: shadcn base primitives.
  - `layout/`: App shell, sidebar, mobile navigation.
  - Features: `inbox/`, `pipelines/`, `contacts/`, `flows/`, `automations/`, etc.
- **`hooks/`**: Custom hooks (`use-auth`, `use-can`, `use-realtime`, etc.).
- **`lib/`**: Core logic and utilities. **(Must match documentation style with thorough header comments).**
  - `auth/`: `roles.ts` (source of truth for RBAC), `api-context.ts`, `account.ts`.
  - `whatsapp/`: Largest module handling Meta API, webhooks, sending, etc.
  - `api/v1/`: Helpers for public API (`pagination.ts`, `respond.ts`).
  - Feature domains: `automations/`, `contacts/`, `ai/`, `webhooks/`.
- **`types/index.ts`**: The canonical TypeScript shape of every DB entity.

### Auth & Tenancy

- **Dashboard Auth:** Handled via Supabase cookie session. `profiles.account_role` determines access (`"owner" | "admin" | "agent" | "viewer"`).
- **Public API Auth:** Handled via `requireApiKey` in `lib/auth/api-context.ts`. **Every DB query in `/api/v1` must explicitly filter by `accountId` since it uses the service-role client.**
- **Role Verification:** Always use predicates from `src/lib/auth/roles.ts` (e.g., `canManageMembers`, `canSendMessages`), never compare string roles directly.

---

## 4. Database Schema & Migrations

- **Strict Migration Rules:** Never edit, renumber, or delete an existing migration (`supabase/migrations/`). New changes require a new migration file numbered after the current highest (e.g., `125_description.sql`).
- **Core Entities:** `accounts`, `profiles`, `contacts`, `conversations`, `messages`, `pipelines`, `deals`, `automations`, `flows`, `whatsapp_config`.
- **Real Estate Entities (Added later):**
  - `lead_details`: 1-to-1 extension of `contacts` (`budget_min`, `budget_max`, `location_preference`, `property_type`, `intent`, `source`).
  - `site_visits`: Scheduled visits tied to a contact and property.
  - `properties`: Real estate listings.
- **Row Level Security (RLS):** All account-scoped tables MUST enforce isolation using the shared `is_account_member(account_id, min_role)` SQL helper. Never loosen or rewrite an existing RLS policy.

---

## 5. Agent Guardrails & Workflow

### DO NOT MODIFY:

1. **Existing Migrations (`001_*.sql` onwards)**.
2. **Existing RLS Policies**.
3. **`src/middleware.ts`**: Contains complex redirect + session refresh logic (fixing production bugs). Only reuse `withRefreshedCookies`.
4. **`src/lib/rate-limit.ts`**: Deliberately in-memory for single-instance scaling.
5. **i18n Structure (`messages/*.json`)**: Add new keys to `en.json`; do not restructure or hardcode English text in JSX.
6. **`src/lib/auth/roles.ts`**: Centralized source of truth for role permissions.

### Task Definition of Done:

- Code matches conventions of the nearest existing equivalent file.
- Database changes use a newly numbered migration file; `SCHEMA_REFERENCE.md` updated.
- RLS verified/added for new account-scoped tables using `is_account_member`.
- New UI text uses `next-intl` (`messages/en.json`).
- Passed local validation: `npm run typecheck && npm run lint && npm run format:check && npm run test`.
- Included/Updated co-located unit tests (e.g., `module.test.ts`).
- Updated `PROGRESS.md` with the completed step.

---

## 6. Development Workflow & Git Operations

- **Branching Strategy:** Fork the `wacrm` repo. Maintain `main` for production, `staging` for pilot testing, and feature branches per `IMPLEMENTATION_PLAN.md` section (e.g., `section/D`).
- **Upstream Sync:** Pull updates from the base `ArnasDon/wacrm` occasionally via a `sync/upstream-YYYY-MM-DD` branch. Resolve conflicts prioritizing local modifications, especially around migrations and `middleware.ts`.
- **CI/CD:** Github Actions (`ci.yml`, `migrations.yml`) enforce code quality and test migrations against a spun-up local Supabase instance. CI MUST pass before merging.

_Refer to the actual source code and files in `docs/agent/` for detailed, up-to-date implementation specifics._
