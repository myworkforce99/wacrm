# Architecture Reference

This document describes the codebase **as it actually exists**, verified
by direct inspection of the repo — not inferred from the framework name.
It is the ground truth `IMPLEMENTATION_PLAN.md` should be checked
against; where the plan's assumptions differ from this document, this
document wins.

Regenerate the relevant section here if a task in the implementation
plan changes something described below (new route group, new lib
module, new design token) — keep this file honest as the codebase
grows.

---

## 1. Stack (exact versions, from `package.json`)

| Layer               | Choice                                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework           | Next.js 16.3.5, App Router, Turbopack dev server                                                                                                   |
| UI runtime          | React 19.2.4                                                                                                                                       |
| Language            | TypeScript ^6, `tsc --noEmit` for typecheck                                                                                                        |
| Styling             | Tailwind CSS v4 (`@tailwindcss/postcss`)                                                                                                           |
| Component kit       | shadcn (`style: "base-nova"`) on top of **`@base-ui/react`** — not Radix. Check an existing `components/ui/*.tsx` file before assuming Radix APIs. |
| Icons               | `lucide-react`                                                                                                                                     |
| DB / Auth / Storage | Supabase (`@supabase/ssr`, `@supabase/supabase-js`)                                                                                                |
| Drag & drop         | `@dnd-kit/core` + `@dnd-kit/sortable` (used by the pipeline kanban board)                                                                          |
| Flow builder canvas | `@xyflow/react` + `@dagrejs/dagre` for auto-layout                                                                                                 |
| i18n                | `next-intl` — see §5, strict 4-locale parity required (`en`, `es`, `ko`, `pt`)                                                                     |
| Charts              | `recharts`, plus a local `components/tremor/*` chart wrapper set                                                                                   |
| Forms/validation    | Native controlled state / FormData patterns, plus `date-fns`, `xlsx` for spreadsheet parsing, `web-push`, and `stripe`                             |
| Toasts              | `sonner`, wrapped by `components/themed-toaster.tsx`                                                                                               |
| Tests               | `vitest` (`npm run test`, `npm run test:watch`) — 105 test suites, 1,126+ tests                                                                    |

**Node:** `>=20.0.0`. **Package manager:** npm (`packageManager: npm@10.9.9` — do not switch to pnpm/yarn).

### Scripts (from `package.json` / `CONTRIBUTING.md`) — the only commands to trust

```
npm run dev           # Turbopack dev server, port 3000
npm run build         # production build (also runs Next's own typecheck)
npm run typecheck     # tsc --noEmit, fast TS-only pass
npm run lint          # ESLint
npm run format        # Prettier --write
npm run format:check  # Prettier check-only (CI)
npm run test          # vitest run
npm run test:watch    # vitest watch
npm run i18n:sync     # synchronize missing keys across all 4 locales
```

Run `typecheck`, `lint`, `format:check`, and `test` before considering any task done — this matches what CI actually runs.

---

## 2. Directory map (verified, `src/`)

```
src/
  app/
    (auth)/                     # login, signup, forgot-password — route group, shared layout.tsx
    (dashboard)/                # authenticated dashboard views — route group, shared layout.tsx + dashboard-shell.tsx
      dashboard/page.tsx        # Overview analytics, recent leads, today's visits/tasks
      contacts/page.tsx         # Leads directory (table, mobile cards, filters, bulk reassign)
      inbox/page.tsx            # WhatsApp shared chat workspace (Mine, Unassigned, All)
      pipelines/page.tsx        # Deals Kanban & table view, loss tracking modal
      properties/page.tsx       # Inventory listings, RERA compliance, specs, brochure share
      site-visits/page.tsx      # Scheduled field visits, pickup logistics, status tracking
      social-media/page.tsx     # Multi-channel marketing (table, monthly calendar, 3x3 grid, composer)
      team/page.tsx             # Manager Command Center, targets, agent availability, unassigned pool
      automations/              # Trigger-action rules (list, new, [id]/edit, [id]/logs)
      flows/                    # Visual qualifier flow builder (list, [id], [id]/runs)
      broadcasts/               # Template broadcast campaign wizard (list, new, [id])
      integrations/page.tsx     # Portal & social lead integrations (99acres, MagicBricks, Housing, NoBroker, Meta)
      agents/page.tsx           # AI playground, knowledge base dropzone, prompt editor
      notifications/page.tsx    # Notification center
      settings/page.tsx         # Account settings (WhatsApp, Team, API keys, Billing, Appearance)
    join/[token]/page.tsx       # invite-acceptance flow, own layout.tsx
    offline/page.tsx            # PWA offline fallback screen
    api/
      account/…                 # account, members, invitations, availability, routing rules
      ai/…                      # autoreply, draft, knowledge, playground, usage, social-caption
      automations/…             # execution triggers and logs
      flows/…                   # visual builder execution
      contacts/[id]/tags/…      # contact tag actions
      deals/…                   # deal lifecycle updates and moves
      portal/…                  # inbound portal webhooks and email forwarding parser
      properties/…              # property CRUD endpoints
      site-visits/…             # site visit scheduling and logistics endpoints
      social/…                  # Meta OAuth connect, callback, disconnect, post publish, draft
      tasks/…                   # agent tasks management
      invitations/[token]/…     # invitation token verification and redemption
      quick-replies/…           # canned response endpoints
      whatsapp/…                # config, webhook, send, broadcast, media, templates, react
      v1/…                      # the PUBLIC REST API (scoped strictly by account_id via API key) — see §4
    layout.tsx / page.tsx / icon.tsx / globals.css
  components/
    ui/            # shadcn primitives on @base-ui/react — button, card, dialog, input, select, tabs, sheet, etc.
    layout/        # sidebar.tsx, header.tsx, mode-toggle.tsx, account-access-alert.tsx, bottom-nav.tsx
    dashboard/     # metric-card, activity-feed, pipeline-donut, response-time-chart, skeleton, empty-state
    inbox/          # message-bubble, message-composer, message-thread, conversation-list, template-picker, …
    pipelines/      # pipeline-board, deal-card, deal-form, lost-reason-modal, pipeline-analytics
    properties/     # property-form-modal, property-share-modal, property-delete-dialog, emi-calculator
    site-visits/    # schedule-visit-sheet, visit cards, calendar view
    social/         # post-composer-sheet, post-calendar, post-grid-view, post-history-table, post-preview-dialog, property-attach-picker, template-picker, post-delete-dialog
    team/           # agent-card, agent-table, unassigned-pool, pipeline-funnel, set-target-modal
    flows/          # flow-builder, flow-canvas (React Flow), flow-editor-state, node-config-form
    automations/    # automation-builder.tsx
    contacts/       # contact-detail-view, contact-form, bulk-reassign-modal, custom-fields-manager, import-modal
    broadcasts/     # step1..step4 wizard components
    settings/       # one file per settings sub-panel (whatsapp-config, ai-config, members-tab, …)
    interactive/    # WhatsApp interactive-message builder/preview
    presence/       # presence-dot, presence-heartbeat
    tremor/         # local chart wrapper components (not the npm `tremor` package)
  hooks/            # use-auth, use-realtime, use-presence, use-can, use-theme, use-total-unread, …
  i18n/             # next-intl request.ts + message-safety tests
  lib/
    supabase/       # client.ts (browser), server.ts (SSR/server components)
    auth/           # account.ts, api-context.ts, roles.ts, invitations.ts — see §3
    api/v1/         # shared helpers for the public API — pagination.ts, respond.ts, contacts.ts, conversations.ts, properties.ts, site-visits.ts
    api-keys/       # keys.ts (hash/format), scopes.ts, store.ts
    currency.ts     # formatINR(), formatINRRange(), formatCurrency()
    whatsapp/       # Meta Cloud API, send-message.ts, webhook handling, templates, encryption, phone-utils, …
    social/         # meta-api.ts (Graph API v22.0), scheduler.ts, accounts.ts, templates.ts, encryption.ts
    automations/    # engine.ts, builder-tree.ts, templates.ts, admin-client.ts
    flows/          # engine.ts, edges.ts, validate.ts, templates.ts, admin-client.ts
    ai/             # generate.ts, embeddings.ts, knowledge.ts, context.ts, providers/{anthropic,openai}.ts
    contacts/       # dedupe.ts, parse-budget.ts, parse-contact-csv.ts, tag-write.ts, tag-events.ts
    dashboard/      # queries.ts, types.ts, date-utils.ts — read this before building the Team dashboard
    webhooks/       # deliver.ts, sign.ts, ssrf.ts, endpoints.ts, events.ts
    rate-limit.ts   # in-memory limiter — see §6, this is a known scaling caveat, not a bug
    themes.ts, utils.ts
  middleware.ts     # session refresh + auth-page redirects — see §3, fragile, has an explicit bug-history comment
  types/index.ts    # the canonical TypeScript shape of every DB entity — read before writing a query
```

Almost every non-trivial `lib/` file has a substantial header comment explaining _why_, not just what. **Match this documentation style** in new files — a one-line JSDoc is not sufficient for anything touching auth, money, or tenant isolation in this codebase.

---

## 3. Auth & tenancy pattern

Two parallel authentication paths, both documented in-code:

- **Dashboard (human) auth** — Supabase cookie session, resolved server-side via `lib/auth/account.ts` (`getCurrentAccount`-style helper). Role comes from `profiles.account_role`, typed as `AccountRole` in `lib/auth/roles.ts`.
- **Public API (`/api/v1/*`) auth** — `lib/auth/api-context.ts`'s `requireApiKey(request, scope)`. No Supabase session exists for an API caller; the key lookup itself establishes `accountId`, and **every downstream query must explicitly filter by that `accountId`** — RLS doesn't help here because the query runs on a service-role client. Read the full header comment in that file before writing any new `/api/v1` route; it explains this discipline directly.

**Roles**: `"owner" | "admin" | "agent" | "viewer"`, ranked in that order (`roleRank` in `lib/auth/roles.ts`). Never compare role strings directly anywhere — always call the existing predicates:

- `canManageMembers`: Admin/Owner only (invites, role changes, member removal).
- `canEditSettings`: Admin/Owner only (WABA configuration, templates, pipelines).
- `canSendMessages`: Agent, Admin, Owner (Viewers are read-only).
- `canViewOnly`: True for Viewer only (useful for read-only banners and tooltips).
- `canDeleteAccount` / `canTransferOwnership`: Owner only.
- `canMoveDeal`: Agents can only move their own deals; Admins/Owners can move any deal.
- `canCreateBroadcast`: Admin/Owner only.
- `canManageSocialPosts`: Agent, Admin, Owner (create draft posts, edit saved drafts).
- `canPublishSocialPost`: Admin, Owner only (live publish, approve agent drafts, schedule future posts).
- `canConnectSocialAccount`: Admin, Owner only (connect/disconnect Instagram and Facebook accounts).
- `canManageLead`: Agents can only manage/reply to leads assigned to themselves; Admins/Owners can manage all leads.
- `canClaimLead`: Agents and Admins can claim unassigned leads.
- `canReassignLead`: Admin/Owner only.
- `canReleaseLead`: Agents can release their own lead back to the unassigned pool; Admins can release any lead.

**`middleware.ts`** handles session refresh and auth-page redirects. It carries an explicit comment about a prior production bug (#288: refreshed cookies not propagating on redirect responses, causing wedged sessions after idling) and the fix pattern (`withRefreshedCookies`). Any new redirect branch added to this file must go through that same helper — copy the pattern, don't bypass it.

---

## 4. Public API (`/api/v1`) pattern

Every `/api/v1/*` route follows the same shape (see `app/api/v1/contacts/route.ts` for the reference example):

```ts
try {
  const ctx = await requireApiKey(request, "contacts:read"); // scope string, see lib/api-keys/scopes.ts
  // ctx.supabase  — service-role client
  // ctx.accountId — scope every query by this, explicitly
  ...
} catch (err) {
  return toApiErrorResponse(err);
}
```

Shared helpers already exist for pagination (`lib/api/v1/pagination.ts`) and consistent error/response envelopes (`lib/api/v1/respond.ts`) — use them rather than hand-rolling response shapes in a new route. Public-API resources include:

- `contacts` (`contacts:read`, `contacts:write`) — `lib/api/v1/contacts.ts`
- `conversations` (`conversations:read`) — `lib/api/v1/conversations.ts`
- `messages` (`messages:read`, `messages:send`)
- `broadcasts` (`broadcasts:send`)
- `webhooks` (`webhooks:manage`)
- `properties` (`properties:read`, `properties:write`) — `lib/api/v1/properties.ts`
- `site_visits` (`site_visits:read`, `site_visits:write`) — `lib/api/v1/site-visits.ts`
- `me` (scope-free, verifies key validity and echoes account context)

---

## 5. i18n — strictly enforced 4-locale parity

`next-intl` is wired in, with message files at repo-root `messages/{en,es,ko,pt}.json`. **New user-facing strings go into these files, not inline as hardcoded English**.

The test suite (`i18n/messages.test.ts` and `i18n/icu-safety.test.ts`) strictly asserts **zero-drift key parity across all four locales** (`en`, `es`, `ko`, `pt`) and validates ICU interpolation placeholders. If a key is added to `en.json` without matching entries in `es.json`, `ko.json`, and `pt.json`, the test suite and CI fail. Never hardcode raw strings in JSX — always use `useTranslations()` / `getTranslations()`.

---

## 6. Known, intentional trade-offs (don't "fix" these without a scaling need)

- **`lib/rate-limit.ts` is in-memory, single-process.** The file's own header comment states this is a deliberate trade-off for a single-instance VPS deployment (the template's default target) and explicitly says to swap to Redis/Upstash only if horizontal scaling is introduced, keeping the same return shape. Don't silently rewrite this unless a task specifically calls for horizontal scaling.
- **Deal/Pipeline account-scoping**: Pipelines and deals are account-scoped. Deal lifecycle tracking is governed by `deals.status` (`open` | `won` | `lost`), `deals.closed_at`, and `lost_reasons` (migration 129). Anti-poaching rules (`canMoveDeal`) prevent agents from moving deals assigned to other team members.
- **`profiles.role`** (the free-form legacy column from migration 001) is dead code per its own doc-comment — never read it; use `profiles.account_role` (migration 017) instead.

---

## 7. Design tokens — reuse, don't reinvent

`src/app/globals.css` already defines a full shadcn-style CSS variable token set: `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--sidebar*` (7 variables for the sidebar specifically), and `--chart-1` through `--chart-5`. **A mobile design pass should extend this existing token set with a small number of new semantic variables** (e.g. status-pill colors for the real estate pipeline stages, SLA-badge thresholds) rather than introducing a parallel token system — `components.json` confirms `cssVariables: true` and `baseColor: "neutral"` as the established convention.

---

## 8. Local setup (from `CONTRIBUTING.md`, verified against `.env.local.example`)

```bash
cp .env.local.example .env.local   # fill in Supabase + Meta creds
npm install
npm run dev
```

Required env vars (from `.env.local.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`, `META_APP_SECRET`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_LOCALE`.
