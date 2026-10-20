# Comprehensive Audit & Remediation Plan: Agent Lead Isolation & RBAC Anti-Poaching

> **Status:** ✅ Completed  
> **Source Documents:** `AGENT_MASTER_CONTEXT.md`, `wacrm_manual_testing_plan.md` (TC-LEAD-03 & Section 21 RBAC Matrix), `docs/agent/ARCHITECTURE.md`.

---

## 1. Executive Summary & Root Cause

Postgres RLS on `contacts`, `deals`, `site_visits`, and `tasks` enforces **account-level multi-tenancy** (`is_account_member(account_id)`). This isolates between different organizations/brokerages (tenants).

However, within an organization:

- **Managers (`owner`, `admin`)** see all contacts, deals, tasks, and visits.
- **Agents (`agent`)** must **only see and interact with their own assigned leads** (contacts created by them, or with open deals/conversations assigned to them).
- Viewers (`viewer`) are strictly read-only.

All components, modals, forms, dashboard widgets, and server routes now strictly adhere to these boundaries.

---

## 2. Completed Fixes

### ✅ `ScheduleVisitSheet` (`src/components/site-visits/schedule-visit-sheet.tsx`)

- Scoped `loadFormData` when `!isManager && user?.id` to query contacts where:
  - `user_id = user.id` OR `user_id = profile.id`
  - Deals assigned to agent: `deals.assigned_to IN (profile.id, user.id)`
  - WhatsApp conversations assigned to agent: `conversations.assigned_agent_id = user.id`
  - Preserves `defaultContactId` or `visit.contact_id` when editing/pre-filled.
- Added validation guard in `handleSubmit`: rejects submissions if non-manager selects unauthorized contact.
- Refactored to use shared `getAgentAssignedContactIds` and `buildAgentContactFilter`.

### ✅ Item 1: `DealForm` (`src/components/pipelines/deal-form.tsx`)

- Scoped contact loading in supporting data load using `getAgentAssignedContactIds` and `buildAgentContactFilter` when `!isManager && (profile?.id || user?.id)`.
- Preserves `deal?.contact_id` when editing an existing deal.
- Added anti-poaching guard in `handleSave`: if `!isManager && !contacts.some(c => c.id === contactId)`, submission is aborted with error toast.

### ✅ Item 2: Server-Side Send API Route (`src/app/api/whatsapp/send/route.ts`)

- Added `canManageLead(role, data.assigned_agent_id, userId)` authorization check when `conversation_id` is passed.
- Rejects non-manager sending to another agent's conversation with HTTP 403 (`{ error: 'This conversation is assigned to another agent' }`).
- Added unit tests in `src/app/api/whatsapp/send/route.test.ts`.

### ✅ Item 3: `PropertyShareModal` (`src/components/properties/property-share-modal.tsx`)

- Added `useAuth()` and `canManageMembers(accountRole)`.
- Scoped `loadContacts` using `getAgentAssignedContactIds` and `buildAgentContactFilter` when `!isManager && user?.id`.

### ✅ Item 4: `CostSheetModal` (`src/components/contacts/cost-sheet-modal.tsx`)

- Added `useAuth()` and `canManageMembers(accountRole)`.
- Scoped `fetchContacts` using `getAgentAssignedContactIds` and `buildAgentContactFilter` when `!isManager && user?.id`.

### ✅ Item 5: `DashboardPage` (`src/app/(dashboard)/dashboard/page.tsx`)

- `Recent leads`: Scoped using `getAgentAssignedContactIds` and `buildAgentContactFilter` when `!isManager && user?.id`.
- `Today's site visits`: Fetches visits with tasks and contact creator, then filters in-memory so non-managers only see visits for contacts/tasks assigned to them.
- `Today's tasks`: Appends `&assigned_to=${profile?.id || user.id}` when fetching `/api/tasks` for non-managers.

### ✅ Item 6: `CommandPalette` (`src/components/layout/command-palette.tsx`)

- Added `useAuth()` (`user, profile, accountRole`).
- Scoped contacts query with `getAgentAssignedContactIds` and `buildAgentContactFilter` when `!isManager && user?.id`.

### ✅ Item 7: Server-Side Tasks Route (`src/app/api/tasks/route.ts`)

- In `GET /api/tasks`, checks `canManageMembers(role)`.
- If non-manager without `assigned_to` parameter: automatically constrains query to `query.or('assigned_to.eq.' + userId + ',created_by.eq.' + userId)`.
- If non-manager attempts to query another agent's tasks via `assigned_to`: returns `{ tasks: [] }`.
- Added unit tests in `src/app/api/tasks/route.test.ts`.

---

## 3. Shared Scoping Helper (`src/lib/contacts/agent-scoping.ts`)

Centralized helper functions used across all modals, pages, and sheets:

- `getAgentAssignedContactIds(supabase, userId, profileId?)`: Resolves assigned contact IDs via deals and conversations.
- `buildAgentContactFilter(userId, profileId?, additionalContactIds?)`: Formats PostgREST `.or(...)` filter string combining direct ownership and indirect assignment.
- Fully tested in `src/lib/contacts/agent-scoping.test.ts` (7 tests).

---

## 4. Verification Results

- `npx tsc --noEmit`: 0 errors.
- `npx eslint`: 0 errors, 0 warnings across all touched files.
- `npm test`: 97 test suites passed, 1,089 tests passed (100%).
