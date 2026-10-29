# Schema Fix Implementation Plan (P1 → P3)

> **For:** Gemini executing agent
> **Scope:** Fix all P1, P2, and P3 schema/type issues from the WaCRM schema audit.
> **Prerequisite reading:** Read `AGENTS.md`, `docs/agent/ARCHITECTURE.md`, and `docs/agent/SCHEMA_REFERENCE.md` before writing any code.
> **Verification gate (run after ALL fixes):**
>
> ```bash
> npm run typecheck && npm run lint && npx vitest run src/lib/schemas && npx vitest run src/i18n/messages.test.ts
> ```

---

## CRITICAL CONTEXT — Read Before Starting

- **Do NOT touch any file under `supabase/migrations/`** — all migrations 001–133 are immutable. These fixes are purely TypeScript/Zod-layer corrections.
- **`src/types/index.ts`** is the canonical TypeScript type file. All DB-entity interfaces live here.
- **`src/lib/schemas/`** contains all Zod validation schemas. They are the API validation layer.
- **`src/lib/auth/roles.ts`** is protected — do not modify it.
- The `assigned_agent_id` sentinel `'unassigned'` is a **UI-only concept** used in `contact-form.tsx`. The API and schema layers must treat it as `null`. The fix must be surgical — the form's own handling of the sentinel value (lines 550–617 of `contact-form.tsx`) must be preserved.
- After each group of changes, run `npm run typecheck` and fix any cascading type errors before proceeding.

---

## Group 1 — P1 Fixes (Critical Schema Bugs)

### Fix 1A: `DealInputSchema` — Add lifecycle fields + `re_engage_on` DATE coercion

**File:** [`src/lib/schemas/deal.ts`](file:///home/ayush/Documents/Projects/wacrm/src/lib/schemas/deal.ts)

**What to do:**
Replace the entire file with the following content. Key changes:

1. Add a `DealStatusEnum` Zod enum.
2. Extend `DealInputSchema` with all migration-129 lifecycle fields.
3. Add `.superRefine()` validation: when `status === 'lost'`, `lost_reason_id` is required and must be a valid UUID.
4. Add `re_engage_on` as a `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` (date-only string, NOT datetime) — this enforces the DB `DATE` column type.
5. Fix `value` from `z.union([z.string(), z.number()])` to `z.coerce.number().nonnegative()` in `DealInputSchema` (the API schema). Keep `z.union([z.string(), z.number()])` in `DealFormSchema` since the form uses a string input for currency display.

**Exact replacement for `src/lib/schemas/deal.ts`:**

```ts
import { z } from 'zod';

export const DealStatusEnum = z.enum(['open', 'won', 'lost']);

/**
 * Base fields shared between create and patch API requests.
 * Note: `value` uses z.coerce.number() — the DB column is NUMERIC,
 * so string representations are rejected early with a typed error.
 */
const DealBaseSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title cannot exceed 200 characters'),
  value: z.coerce
    .number({ invalid_type_error: 'Value must be a number' })
    .nonnegative('Value cannot be negative')
    .optional(),
  currency: z.string().default('INR'),
  stage_id: z.string().min(1, 'Stage is required'),
  contact_id: z.string().min(1, 'Contact is required'),
  assigned_to: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  expected_close_date: z.string().nullable().optional(),
  // Lifecycle fields (migration 129)
  status: DealStatusEnum.optional(),
  lost_reason_id: z
    .string()
    .uuid('lost_reason_id must be a valid UUID')
    .nullable()
    .optional(),
  lost_note: z.string().max(2000).nullable().optional(),
  /**
   * Date-only ISO string (YYYY-MM-DD). DB column type is DATE, not TIMESTAMPTZ.
   * Do NOT pass a full datetime-local string — Postgres will reject it.
   */
  re_engage_on: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      're_engage_on must be a date string in YYYY-MM-DD format'
    )
    .nullable()
    .optional(),
  won_value: z.coerce
    .number({ invalid_type_error: 'Won value must be a number' })
    .nonnegative()
    .nullable()
    .optional(),
});

/**
 * API create/update schema. Validates that lost_reason_id is provided
 * when status is 'lost'.
 */
export const DealInputSchema = DealBaseSchema.superRefine((data, ctx) => {
  if (data.status === 'lost' && !data.lost_reason_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'lost_reason_id is required when marking a deal as lost',
      path: ['lost_reason_id'],
    });
  }
});

export const DealPatchSchema = DealBaseSchema.partial().superRefine(
  (data, ctx) => {
    if (data.status === 'lost' && !data.lost_reason_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'lost_reason_id is required when marking a deal as lost',
        path: ['lost_reason_id'],
      });
    }
  }
);

/**
 * Form schema — keeps string union for value since the form uses a
 * formatted currency string input (e.g. "1,50,000"). The form submit
 * handler is responsible for parsing before sending to the API.
 */
export const DealFormSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title cannot exceed 200 characters'),
  value: z.union([z.string(), z.number()]).optional(),
  currency: z.string(),
  stage_id: z.string().min(1, 'Stage is required'),
  contact_id: z.string().min(1, 'Contact is required'),
  assigned_to: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  expected_close_date: z.string().nullable().optional(),
});

export type DealStatus = z.infer<typeof DealStatusEnum>;
export type DealInput = z.infer<typeof DealInputSchema>;
export type DealPatch = z.infer<typeof DealPatchSchema>;
export type DealFormValues = z.infer<typeof DealFormSchema>;
```

**After writing this file:** Run `npm run typecheck`. If any downstream consumers of `DealInput` or `DealPatch` break because they relied on `value: string | number`, fix them to use `number | undefined`.

---

### Fix 1B: `re_engage_on` — Ensure date-only string sent from deal form

**File:** [`src/components/pipelines/deal-form.tsx`](file:///home/ayush/Documents/Projects/wacrm/src/components/pipelines/deal-form.tsx)

**What to find:** The `handleLostConfirmed` function at approximately line 410. It accepts `re_engage_on?: string` from the `LostReasonModal`. The value comes from a date picker in the modal.

**What to do:** In `handleLostConfirmed`, before sending `payload` to the API, coerce `re_engage_on` to a date-only string by slicing off any time component:

```ts
async function handleLostConfirmed(payload: {
  lost_reason_id: string;
  lost_note?: string;
  re_engage_on?: string;
}) {
  if (!deal) return;
  setLostLoading(true);

  // Ensure re_engage_on is date-only (YYYY-MM-DD) — DB column is DATE type, not TIMESTAMPTZ.
  // datetime-local inputs produce "YYYY-MM-DDTHH:mm" which Postgres rejects.
  const safePayload = {
    ...payload,
    re_engage_on: payload.re_engage_on
      ? payload.re_engage_on.slice(0, 10)
      : undefined,
  };

  const res = await fetch(`/api/deals/${deal.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'lost', ...safePayload }),
    headers: { 'Content-Type': 'application/json' },
  });
  // ... rest of function unchanged
```

---

### Fix 1C: `ContactInputSchema` — Fix `assigned_agent_id` sentinel leak

**File:** [`src/lib/schemas/contact.ts`](file:///home/ayush/Documents/Projects/wacrm/src/lib/schemas/contact.ts)

**Context:** The `'unassigned'` sentinel is a UI-only concept. It is handled in `contact-form.tsx` at lines 550–617 where the form checks `values.assigned_agent_id === 'unassigned'` and converts it to `null` before calling the API. The Zod schema itself should allow `null` and `undefined` as valid values, and should NOT set `'unassigned'` as a default.

**What to change:** Line 27:

```ts
// BEFORE:
assigned_agent_id: z.string().default('unassigned'),

// AFTER:
/**
 * UUID of the agent to assign, or null/undefined for unassigned.
 * NOTE: The contact form uses the sentinel string 'unassigned' in its
 * local state (for the dropdown), but converts it to null before
 * calling the API. Never pass 'unassigned' to the DB.
 */
assigned_agent_id: z.string().uuid().nullable().optional(),
```

**After this change:** Search all consumers of `ContactInput` / `ContactFormValues` for `assigned_agent_id`. The only downstream file that must be updated is `contact-form.tsx` — change its default value at approximately line 137 from:

```ts
assigned_agent_id: 'unassigned',
```

to:

```ts
assigned_agent_id: null as string | null | undefined,
```

And update line ~203 where it reads `watch('assigned_agent_id') || 'unassigned'` to:

```ts
const assignedAgentId = watch('assigned_agent_id') ?? null;
```

And update all comparisons like `values.assigned_agent_id === 'unassigned'` → `!values.assigned_agent_id`, and `assigned_agent_id: resolvedAssignedAgentId` where `resolvedAssignedAgentId` was `'unassigned'` → `null`.

> ⚠️ **Be careful:** The UI dropdowns that show "Unassigned" use the string `'unassigned'` as a `<SelectItem value>`. These are pure UI — they must convert to `null` before submission. Do NOT change the `<SelectItem>` values; only change what gets submitted.

---

### Fix 1D: `SiteVisitInputSchema` — Make `scheduled_at` optional

**File:** [`src/lib/schemas/site-visit.ts`](file:///home/ayush/Documents/Projects/wacrm/src/lib/schemas/site-visit.ts)

**What to change:** Lines 21–23:

```ts
// BEFORE:
scheduled_at: z
  .string({ required_error: 'scheduled_at is required' })
  .datetime({ offset: true, message: 'Must be a valid ISO datetime' }),

// AFTER:
/**
 * ISO-8601 datetime with offset. Required when creating a visit, but
 * nullable in the DB (TIMESTAMPTZ without NOT NULL) — null on legacy rows.
 * SiteVisitPatchSchema inherits this as optional via .partial().
 */
scheduled_at: z
  .string()
  .datetime({ offset: true, message: 'Must be a valid ISO datetime' })
  .nullable()
  .optional(),
```

No other file changes needed — `SiteVisitPatchSchema = SiteVisitInputSchema.partial()` automatically inherits the fix.

---

## Group 2 — P2 Fixes (Missing Types + Critical Missing Enums)

### Fix 2A: Add `AgentTarget`, `WebhookEndpoint`, `ApiKey` interfaces to `src/types/index.ts`

**File:** [`src/types/index.ts`](file:///home/ayush/Documents/Projects/wacrm/src/types/index.ts)

**Where to insert:** After line 530 (after the `AssignmentHistory` interface), add the three interfaces. Insert them as a new section:

```ts
// ============================================================
// Agent Targets (migration 116)
// ============================================================

/**
 * Monthly site-visit and booking targets set per agent by managers.
 * One row per (account, agent, month). Uses period_start as the
 * canonical month key (first day of the month, YYYY-MM-DD).
 */
export interface AgentTarget {
  id: string;
  account_id: string;
  /** References profiles.user_id — NOT profiles.id */
  agent_id: string;
  /** First day of the target month (YYYY-MM-DD). Unique key with agent_id. */
  period_start: string;
  /** Last day of the target month (YYYY-MM-DD). */
  period_end: string;
  target_visits: number;
  target_bookings: number;
}

// ============================================================
// API Keys (migration 026)
// ============================================================

/**
 * Public REST API key row. The raw key is only returned once at
 * creation time. Only the SHA-256 hash is stored; it is never
 * reconstructed or returned in list responses.
 */
export interface ApiKey {
  id: string;
  account_id: string;
  /** auth.users.id of the creator. NULL if creator was deleted. */
  created_by: string | null;
  /** Human-readable label set by the admin (e.g. "Zapier Integration"). */
  name: string;
  /** SHA-256 hash of the raw key — never expose as plaintext. */
  key_hash: string;
  /** Scope strings e.g. ['contacts:read', 'messages:send']. */
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
}

// ============================================================
// Webhook Endpoints (migration 028)
// ============================================================

/**
 * Outbound webhook endpoint registered by an account to receive
 * CRM event notifications via HTTP POST. The `secret` column stores
 * an AES-256-GCM-encrypted HMAC signing key — never expose as
 * plaintext in client-facing API responses.
 */
export interface WebhookEndpoint {
  id: string;
  account_id: string;
  /** auth.users.id of the creator. NULL if creator was deleted. */
  created_by: string | null;
  /** HTTPS endpoint to POST events to. */
  url: string;
  /** AES-256-GCM encrypted HMAC secret. Server-side use only. */
  secret: string;
  /** Event type subscriptions e.g. ['message.received', 'conversation.created']. */
  events: string[];
  is_active: boolean;
  last_delivery_at: string | null;
  /** Consecutive failure counter. Auto-disables endpoint when threshold exceeded. */
  failure_count: number;
  created_at: string;
}
```

---

### Fix 2B: `PROPERTY_CONFIGURATIONS` — Add `Villa`, `Plot`, `Commercial`

**File:** [`src/types/index.ts`](file:///home/ayush/Documents/Projects/wacrm/src/types/index.ts)

**Where:** Lines 887–894. Replace with:

```ts
/**
 * Canonical buyer configuration preferences for lead filtering and
 * qualification. Includes both BHK options and asset-class options.
 * This is the single source of truth used in /properties and /site-visits filters.
 */
export const PROPERTY_CONFIGURATIONS = [
  'Studio',
  '1BHK',
  '2BHK',
  '3BHK',
  '4BHK',
  '5+ BHK',
  'Villa',
  'Plot',
  'Commercial',
] as const;

export type PropertyConfiguration = (typeof PROPERTY_CONFIGURATIONS)[number];
```

> **Note:** The `property-form-modal.tsx` uses its own local `RESIDENTIAL_CONFIGURATIONS` constant for the form's configuration picker (which only shows BHK options, not Villa/Plot/Commercial). Do NOT modify that local constant — it is intentionally a subset used only in the form for residential unit selection. The exported `PROPERTY_CONFIGURATIONS` is used by filter dropdowns.

---

### Fix 2C: `FacingDirectionEnum` — Add enum to property schema

**File:** [`src/lib/schemas/property.ts`](file:///home/ayush/Documents/Projects/wacrm/src/lib/schemas/property.ts)

**Context:** The `property-form-modal.tsx` already has a local `FACING_OPTIONS` array (lines 78–87) with the exact 8 values. We now promote these to the canonical schema. The `FACING_OPTIONS` local constant in `property-form-modal.tsx` should be replaced with an import from the schema.

**Step 1 — Add to `src/lib/schemas/property.ts`** (after `PossessionStatusEnum`, before `PropertyInputSchema`):

```ts
/**
 * Canonical compass-facing directions for property listings.
 * Matches the UI options in property-form-modal.tsx.
 * DB column `properties.facing` is plain TEXT — no DB-level CHECK constraint.
 */
export const FacingDirectionEnum = z.enum([
  'East',
  'North',
  'North-East',
  'West',
  'South',
  'North-West',
  'South-East',
  'South-West',
]);

export type FacingDirection = z.infer<typeof FacingDirectionEnum>;

export const FACING_DIRECTIONS = FacingDirectionEnum.options;
```

**Step 2 — Update `PropertyInputSchema`** (line 53): Change:

```ts
facing: z.string().nullable().optional(),
```

to:

```ts
facing: FacingDirectionEnum.nullable().optional(),
```

**Step 3 — Update `PropertyFormSchema`** (line 76): Change:

```ts
facing: z.string().optional(),
```

to:

```ts
facing: FacingDirectionEnum.optional(),
```

**Step 4 — Update `src/components/properties/property-form-modal.tsx`**: Replace the local `FACING_OPTIONS` array (lines 78–87) with an import:

```ts
// Add to imports at the top:
import { FACING_DIRECTIONS } from '@/lib/schemas';

// Remove lines 78–87 (the const FACING_OPTIONS array).
// Replace all usages of FACING_OPTIONS in the JSX with FACING_DIRECTIONS.
```

---

## Group 3 — P3 Fixes (Weak Typing and Type Narrowing)

### Fix 3A: `AssignmentHistory.reason` — Narrow to union type

**File:** [`src/types/index.ts`](file:///home/ayush/Documents/Projects/wacrm/src/types/index.ts)

**Where:** Line 526. Change:

```ts
reason: string;
```

to:

```ts
/**
 * Canonical reason values written by the system:
 * - 'claim'           — agent claimed an unassigned lead
 * - 'release_pool'    — agent released lead back to unassigned pool
 * - 'manual_reassign' — admin/manager manually reassigned
 * - 'round_robin'     — auto-assigned by the routing engine (round-robin fallback)
 * - 'routing_rule'    — auto-assigned by a matching lead routing rule
 * - 'manual'          — DB trigger fallback (auth.uid() was available)
 * - 'automation'      — DB trigger fallback (no auth.uid(), automation context)
 */
reason:
  | 'claim'
  | 'release_pool'
  | 'manual_reassign'
  | 'round_robin'
  | 'routing_rule'
  | 'manual'
  | 'automation';
```

**After this change:** Run `npm run typecheck`. Fix any switch statements or comparisons on `reason` that TypeScript now flags as unreachable or incorrectly typed.

---

### Fix 3B: `PropertyFormSchema` — Make `property_type` and `possession_status` optional

**File:** [`src/lib/schemas/property.ts`](file:///home/ayush/Documents/Projects/wacrm/src/lib/schemas/property.ts)

**Where:** `PropertyFormSchema` definition (lines 63–81). Change:

```ts
property_type: PropertyTypeEnum,
```

to:

```ts
property_type: PropertyTypeEnum.optional(),
```

And:

```ts
possession_status: PossessionStatusEnum,
```

to:

```ts
possession_status: PossessionStatusEnum.optional(),
```

**After this change:** In `property-form-modal.tsx`, the default values for these fields (currently `'East'` and fixed enums) should still work because the form always pre-selects defaults. Run `npm run typecheck` to confirm no breakage in form submit handlers that destructure these fields.

---

### Fix 3C: `Deal.value` — Add JSDoc to note coercion behavior

**File:** [`src/types/index.ts`](file:///home/ayush/Documents/Projects/wacrm/src/types/index.ts)

**Where:** Line 465 (the `value` field on `Deal` interface). Add a comment:

```ts
/**
 * Expected deal value in the account's default currency (INR).
 * DB column type is NUMERIC. Always store and read as a number.
 * The form uses string-formatted display values — parse before persisting.
 */
value: number;
```

---

### Fix 3D: Add JSDoc to `LeadDetail` to distinguish `property_type` vs `configuration_preference`

**File:** [`src/types/index.ts`](file:///home/ayush/Documents/Projects/wacrm/src/types/index.ts)

**Where:** Lines 177–181. Replace the bare fields with documented versions:

```ts
/**
 * Asset class the buyer is interested in.
 * Values: 'Apartment' | 'Villa' | 'Plot' | 'Commercial' | 'Penthouse' | 'Builder Floor'.
 * Distinct from `configuration_preference` which stores BHK options.
 */
property_type?: string;
```

And below it:

```ts
/**
 * BHK/unit type preferences, e.g. ['2BHK', '3BHK']. Set during qualification.
 * Distinct from `property_type` which stores the asset class.
 */
configuration_preference?: string[];
```

---

### Fix 3E: Add JSDoc to `SiteVisit.scheduled_at`

**File:** [`src/types/index.ts`](file:///home/ayush/Documents/Projects/wacrm/src/types/index.ts)

**Where:** Line 603. Change:

```ts
scheduled_at?: string;
```

to:

```ts
/** ISO-8601 datetime with timezone offset. Required when creating; null only on legacy/draft rows. */
scheduled_at?: string;
```

---

## Verification Checklist

After completing all groups, run these checks in order:

```bash
# 1. TypeScript — zero errors required
npm run typecheck

# 2. ESLint — zero errors required
npm run lint

# 3. Schema unit tests
npx vitest run src/lib/schemas

# 4. i18n parity (must pass — no new strings added, so this is a regression guard)
npx vitest run src/i18n/messages.test.ts

# 5. Deals route test (covers lifecycle fields)
npx vitest run src/app/api/deals

# 6. Full suite last (catch any regressions)
npm run test
```

### Expected outcomes:

- `npm run typecheck` — 0 errors (was likely already 0; confirm no regressions from type narrowing changes in Group 3)
- Schema tests — all pass (the `scheduled_at` fix makes `SiteVisitPatchSchema` correctly accept omitting `scheduled_at`)
- No new `any` types introduced

---

## DO NOT Touch

- Any file under `supabase/migrations/` — all migrations are immutable
- `src/lib/auth/roles.ts` — RBAC authority file
- `src/middleware.ts` — production session bug fix
- `src/lib/rate-limit.ts` — deliberate in-memory design
- The `<SelectItem value="unassigned">` elements in UI dropdowns — these are display-only sentinels
- The local `RESIDENTIAL_CONFIGURATIONS` constant in `property-form-modal.tsx` — it is an intentional subset for the BHK picker, not a bug
