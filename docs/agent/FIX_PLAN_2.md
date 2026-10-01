# FIX_PLAN_2.md — Second Audit Remediation

**Applies to:** `wacrm` real estate CRM
**Audit source:** `second_audit_report.md` (2026-10-01)
**Prerequisite:** `FIX_PLAN.md` (6 prior fixes) must already be applied.

---

## Agent Instructions — Before You Start

1. **Read `docs/agent/ARCHITECTURE.md`** if you haven't already this session.
2. **Read `docs/agent/SCHEMA_REFERENCE.md`** — you will reference `notifications`, `lead_details`, and `deals` tables.
3. Apply fixes **in the order listed below**. Each fix is self-contained.
4. After each fix, run `npm run typecheck` to confirm no new errors.
5. Do **not** rename or renumber any existing migration files.
6. Do **not** touch `supabase/migrations/` numbering — all required schema is already in place.

---

## FIX 1 — P0: Billing Webhook — invoice.subscription removed in Stripe 2026-08-26.dahlia

**File:** `src/app/api/billing/webhook/route.ts`

**Why:** `npm run typecheck` produces 4 errors at lines 114, 115, 146, 147. In Stripe API `2026-08-26.dahlia`, `Invoice.subscription` was moved to `invoice.parent.subscription_details.subscription`. FIX_PLAN Fix 3 updated `checkout.session.completed` but missed the `invoice.payment_succeeded` and `invoice.payment_failed` cases.

**Runtime impact:** Without this fix, subscription renewals never update `current_period_end`, and payment failures never set `subscription_status` to `past_due`.

### Reconnaissance

```bash
npm run typecheck 2>&1 | grep "billing/webhook"
# Expected: 4 errors on lines 114, 115, 146, 147
```

### Fix — `invoice.payment_succeeded` case

Find and replace inside `case 'invoice.payment_succeeded':` — only the `const invoice` + `const subscriptionId` block:

REPLACE:

```typescript
const invoice = event.data.object as Stripe.Invoice;
// In Stripe webhook payloads, invoice.subscription is always a
// string ID or null — the expanded object form only appears in
// API responses when explicitly requested with expand=[]. Cast
// to string directly; the @ts-ignore was masking correct types.
const subscriptionId =
  typeof invoice.subscription === 'string' ? invoice.subscription : null;
```

WITH:

```typescript
const invoice = event.data.object as Stripe.Invoice;
// In Stripe API 2026-08-26.dahlia, Invoice.subscription was removed.
// The subscription reference now lives at:
//   invoice.parent.subscription_details.subscription
// This is the same change applied to checkout.session.completed in
// FIX_PLAN Fix 3, now extended to the invoice event cases.
const subRef = invoice.parent?.subscription_details?.subscription;
const subscriptionId =
  typeof subRef === 'string'
    ? subRef
    : ((subRef as Stripe.Subscription | undefined)?.id ?? null);
```

### Fix — `invoice.payment_failed` case

Find and replace inside `case 'invoice.payment_failed':` — only the `const invoice` + `const subscriptionId` block:

REPLACE:

```typescript
const invoice = event.data.object as Stripe.Invoice;
// Same as payment_succeeded: subscription is a string ID in webhook
// payloads, never an expanded object.
const subscriptionId =
  typeof invoice.subscription === 'string' ? invoice.subscription : null;
```

WITH:

```typescript
const invoice = event.data.object as Stripe.Invoice;
// In Stripe API 2026-08-26.dahlia, Invoice.subscription was removed.
// Use parent.subscription_details.subscription instead.
const subRef = invoice.parent?.subscription_details?.subscription;
const subscriptionId =
  typeof subRef === 'string'
    ? subRef
    : ((subRef as Stripe.Subscription | undefined)?.id ?? null);
```

### Verify

```bash
npm run typecheck 2>&1 | grep "billing/webhook"
# Expected: NO output (zero errors)
npm run typecheck
# Must exit 0
```

---

## FIX 2 — P1: CRON_SECRET Missing from `.env.local.example`

**File:** `.env.local.example`

**Why:** `/api/cron/stale-leads` and `/api/cron/weekly-report` both gate on `process.env.CRON_SECRET`. The env template only has `AUTOMATION_CRON_SECRET` (commented out). `CRON_SECRET` is entirely absent, so both crons will always return 401 in production if Vercel dashboard is not set up with prior knowledge.

### Reconnaissance

```bash
grep "CRON_SECRET" .env.local.example
# Expected: NO output (confirming it's missing)
```

### Fix

Append to the end of `.env.local.example` (after the `INBOUND_EMAIL_DOMAIN` line):

```
# ------------------------------------------------------------------
# Cron Jobs (Sections C7, V2 — stale-leads and weekly-report)
# Set this to a long random string and configure the same value in
# your Vercel project environment variables under CRON_SECRET.
# vercel.json schedules the crons; they authenticate via Bearer token.
# ------------------------------------------------------------------
CRON_SECRET=generate-a-long-random-string
```

### Verify

```bash
grep "CRON_SECRET" .env.local.example
# Expected: CRON_SECRET=generate-a-long-random-string
```

---

## FIX 3 — P1: Inbound Email Parser Does Not Write `lead_details.source`

**File:** `src/app/api/webhooks/inbound-email/route.ts`

**Why:** The email webhook correctly parses `lead.source` (portal name), tags the contact, and marks `portal_connections.test_lead_received`. But it never upserts `lead_details.source`. Portal-imported contacts have `source = null` in `lead_details`, breaking source badges (C2, C4), routing rules on `source` (S3), and broadcast segmenting (J4).

### Reconnaissance

```bash
grep -n "lead_details" src/app/api/webhooks/inbound-email/route.ts
# Expected: NO output (confirming the upsert is absent)
```

### Fix

Find the `if (lead.source) {` block. Inside it, BEFORE the `if (created) { ... } else { ... }` tag-setting branch, insert:

```typescript
// Section D6: Persist source into lead_details so routing rules,
// source badges, and broadcast lead-segment targeting all work.
// upsert with ignoreDuplicates=false ensures existing contacts
// also get their source updated if re-imported from a portal.
const { error: ldErr } = await db
  .from('lead_details')
  .upsert(
    { contact_id: id, source: lead.source },
    { onConflict: 'contact_id', ignoreDuplicates: false }
  );
if (ldErr) {
  console.warn(
    '[inbound-email] Could not write lead_details.source:',
    ldErr.message
  );
}
```

The insertion point is immediately after the `findOrCreateContact()` call resolves (after the closing `}` of that `await`) and immediately before the `if (created) {` tag block.

### Verify

```bash
grep -n "lead_details\|ldErr" src/app/api/webhooks/inbound-email/route.ts
# Expected: shows the new upsert block
npm run typecheck
# Must exit 0
```

---

## FIX 4 — QUALITY-01: Stale-leads Cron — Deal Stage Filter Silently Fails

**File:** `src/app/api/cron/stale-leads/route.ts`

**Why:** `.in('stage.name', ['New', 'Contacted'])` filters on a joined relation column. PostgREST silently ignores this filter — all deals older than 48h match regardless of stage (including closed/won ones). Fix: two-step query — get stage IDs first, then filter on scalar `stage_id` FK column.

**Note:** Notification `type: 'conversation_assigned'` is the ONLY valid value in the CHECK constraint (`027_notifications.sql`), so the notification type is NOT changed.

### Reconnaissance

```bash
grep -n "stage.name\|in.*stage" src/app/api/cron/stale-leads/route.ts
# Expected: shows the broken .in('stage.name', ...) filter
grep -n "CHECK.*type\|type.*CHECK" supabase/migrations/027_notifications.sql
# Confirm: only 'conversation_assigned' is allowed
```

### Fix — Replace the entire GET handler (keep the auth guard line unchanged)

Replace everything from `const db = supabaseAdmin();` to the end of the function with:

```typescript
const db = supabaseAdmin();
let processed = 0;
let stale = 0;

try {
  const fortyEightHoursAgo = new Date(
    Date.now() - 48 * 60 * 60 * 1000
  ).toISOString();

  // Step 1: Resolve stage IDs for 'New' and 'Contacted'.
  // Cannot use .in('stage.name', ...) on a joined column — PostgREST
  // ignores that filter silently (audit QUALITY-01). Filter on the
  // scalar stage_id FK instead.
  const { data: earlyStages, error: stageErr } = await db
    .from('pipeline_stages')
    .select('id')
    .in('name', ['New', 'Contacted']);

  if (stageErr) {
    console.error('[cron/stale-leads] Failed to fetch stage ids', stageErr);
    return NextResponse.json({ error: stageErr.message }, { status: 500 });
  }

  const earlyStageIds = (earlyStages || []).map((s: { id: string }) => s.id);
  if (earlyStageIds.length === 0) {
    return NextResponse.json({ processed: 0, stale: 0 });
  }

  // Step 2: Fetch deals in early stages not updated in 48h.
  const { data: staleDeals, error: dealsErr } = await db
    .from('deals')
    .select(
      'id, title, account_id, contact_id, stage_id, contact:contacts(id, name, conversations!inner(assigned_agent_id))'
    )
    .lt('updated_at', fortyEightHoursAgo)
    .in('stage_id', earlyStageIds);

  if (dealsErr) {
    console.error('[cron/stale-leads] Failed to fetch deals', dealsErr);
    return NextResponse.json({ error: dealsErr.message }, { status: 500 });
  }

  if (!staleDeals || staleDeals.length === 0) {
    return NextResponse.json({ processed: 0, stale: 0 });
  }

  processed = staleDeals.length;

  for (const deal of staleDeals) {
    const conversations = Array.isArray(deal.contact?.conversations)
      ? deal.contact?.conversations
      : [deal.contact?.conversations];
    const conversation = conversations.find(
      (c: { assigned_agent_id?: string | null }) => c?.assigned_agent_id
    );

    if (conversation?.assigned_agent_id) {
      stale++;
      const agentId = conversation.assigned_agent_id;
      const contactName = deal.contact?.name || 'Unknown Contact';

      // (a) Create a follow-up task.
      const { error: taskErr } = await db.from('tasks').insert({
        account_id: deal.account_id,
        contact_id: deal.contact_id,
        title: `Follow up: ${contactName} — no activity for 2+ days`,
        due_at: new Date().toISOString(),
        assigned_to: agentId,
        created_by: agentId,
      });
      if (taskErr) {
        console.error(
          '[cron/stale-leads] task insert failed:',
          taskErr.message
        );
      }

      // (b) Notify the assigned agent.
      await db.from('notifications').insert({
        account_id: deal.account_id,
        user_id: agentId,
        type: 'conversation_assigned',
        contact_id: deal.contact_id,
        title: `Follow up: ${contactName} — no activity for 2+ days`,
        body: `Deal: ${deal.title}`,
      });

      // (c) Notify admins (deduplicated — skip if admin is the agent).
      const { data: admins } = await db
        .from('profiles')
        .select('user_id')
        .eq('account_id', deal.account_id)
        .eq('account_role', 'admin');

      if (admins) {
        const adminNotifs = admins
          .filter((a: { user_id: string }) => a.user_id !== agentId)
          .map((a: { user_id: string }) => ({
            account_id: deal.account_id,
            user_id: a.user_id,
            type: 'conversation_assigned' as const,
            contact_id: deal.contact_id,
            title: `Stale Lead Alert: ${contactName}`,
            body: `No activity for 2+ days. Deal: ${deal.title}`,
          }));
        if (adminNotifs.length > 0) {
          await db.from('notifications').insert(adminNotifs);
        }
      }
    }
  }

  return NextResponse.json({ processed, stale });
} catch (error) {
  console.error('[cron/stale-leads] Error:', error);
  return NextResponse.json({ error: String(error) }, { status: 500 });
}
```

### Verify

```bash
grep -n "stage.name\|in.*stage\.name" src/app/api/cron/stale-leads/route.ts
# Expected: NO output (broken filter gone)
grep -n "earlyStageIds\|stage_id" src/app/api/cron/stale-leads/route.ts
# Expected: shows the two-step approach
npm run typecheck
# Must exit 0
```

---

## FIX 5 — QUALITY-02: Bulk Contacts Route — `close` and `tag` Actions Missing

**File:** `src/app/api/contacts/bulk/route.ts`

**Why:** The route hardcodes rejection of any action that is not `reassign`. Implementation Plan S5 defines `close` and `tag` actions. The contacts page UI may show these buttons and will receive a 400 on click.

### Fix — Replace entire file

Replace the entire content of `src/app/api/contacts/bulk/route.ts` with:

```typescript
import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { createClient } from '@/lib/supabase/server';
import { hasMinRole } from '@/lib/auth/roles';
import { toApiErrorResponse } from '@/lib/api/v1/respond';

export async function POST(request: Request) {
  try {
    const account = await getCurrentAccount();
    if (!account)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasMinRole(account.role, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action, target_agent_id, contact_ids, tag_ids } = body;

    const validActions = ['reassign', 'close', 'tag'];
    if (
      !validActions.includes(action) ||
      !Array.isArray(contact_ids) ||
      contact_ids.length === 0
    ) {
      return NextResponse.json(
        {
          error: `Invalid request. action must be one of: ${validActions.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // ----------------------------------------------------------------
    // reassign — bulk move conversations to a different agent
    // ----------------------------------------------------------------
    if (action === 'reassign') {
      if (!target_agent_id) {
        return NextResponse.json(
          { error: 'target_agent_id is required for reassign action' },
          { status: 400 }
        );
      }

      const { data: convs, error: convsError } = await supabase
        .from('conversations')
        .select('contact_id, assigned_agent_id')
        .eq('account_id', account.accountId)
        .in('contact_id', contact_ids);

      if (convsError) throw convsError;

      const { error: updateError } = await supabase
        .from('conversations')
        .update({ assigned_agent_id: target_agent_id })
        .eq('account_id', account.accountId)
        .in('contact_id', contact_ids);

      if (updateError) throw updateError;

      const historyPayload = (convs || []).map((conv) => ({
        account_id: account.accountId,
        contact_id: conv.contact_id,
        from_agent_id: conv.assigned_agent_id,
        to_agent_id: target_agent_id,
        actor_id: account.userId,
        reason: 'bulk_reassign',
      }));

      if (historyPayload.length > 0) {
        await supabase.from('assignment_history').insert(historyPayload);
      }

      return NextResponse.json({
        success: true,
        updated: historyPayload.length,
      });
    }

    // ----------------------------------------------------------------
    // close — bulk resolve open conversations for the given contacts
    // ----------------------------------------------------------------
    if (action === 'close') {
      const { error: closeError, count } = await supabase
        .from('conversations')
        .update({ status: 'resolved' })
        .eq('account_id', account.accountId)
        .in('contact_id', contact_ids)
        .eq('status', 'open');

      if (closeError) throw closeError;

      return NextResponse.json({ success: true, updated: count ?? 0 });
    }

    // ----------------------------------------------------------------
    // tag — bulk add tags to contacts
    // ----------------------------------------------------------------
    if (action === 'tag') {
      if (!Array.isArray(tag_ids) || tag_ids.length === 0) {
        return NextResponse.json(
          { error: 'tag_ids array is required for tag action' },
          { status: 400 }
        );
      }

      // Scope-check: only tags owned by this account may be applied.
      const { data: validTags, error: tagVerifyErr } = await supabase
        .from('tags')
        .select('id')
        .eq('account_id', account.accountId)
        .in('id', tag_ids);

      if (tagVerifyErr) throw tagVerifyErr;

      const validTagIds = (validTags || []).map((t) => t.id);
      if (validTagIds.length === 0) {
        return NextResponse.json(
          { error: 'No valid tags found for this account' },
          { status: 400 }
        );
      }

      const tagRows = contact_ids.flatMap((contactId: string) =>
        validTagIds.map((tagId: string) => ({
          contact_id: contactId,
          tag_id: tagId,
        }))
      );

      const { error: tagErr } = await supabase
        .from('contact_tags')
        .upsert(tagRows, {
          onConflict: 'contact_id,tag_id',
          ignoreDuplicates: true,
        });

      if (tagErr) throw tagErr;

      return NextResponse.json({ success: true, updated: contact_ids.length });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
```

### Verify

```bash
npm run typecheck
# Must exit 0
grep -n "close\|tag_ids\|validActions" src/app/api/contacts/bulk/route.ts
# Expected: shows all three action branches
```

---

## FIX 6 — MISSING-03: Hinglish Language Selection in Automation Engine

**File:** `src/lib/automations/engine.ts`

**Why:** `accounts.preferred_language` column exists. Hinglish templates are seeded. But the engine never reads the account's language preference. All automations always fire in English. Section R6 requires the engine to prefer `[HI] <template_name>` when `preferred_language` is `'hi'` or `'hi-en'`.

### Reconnaissance

```bash
grep -n "send_template\|cfg\.template_name\|engineSendTemplate" src/lib/automations/engine.ts | head -20
# Note the line numbers of the send_template case (~line 425)
wc -l src/lib/automations/engine.ts
# Note last line number for helper insertion point
```

### Fix — Step A: Add helper function at end of file

Append the following function **before the last line** of `src/lib/automations/engine.ts` (after all other private functions):

```typescript
// ---------------------------------------------------------------
// Section R6: Language selection helper
//
// When account.preferred_language is 'hi' or 'hi-en', the engine
// tries to find a sibling template named '[HI] <templateName>'
// in message_templates. If one exists, it is used; otherwise the
// original name is returned unchanged. This allows bilingual
// automation setups without requiring template-level config changes.
// ---------------------------------------------------------------
async function resolveLocalizedTemplateName(
  db: ReturnType<typeof supabaseAdmin>,
  accountId: string,
  templateName: string
): Promise<string> {
  // Already a localised template — no swap needed.
  if (templateName.startsWith('[HI]')) return templateName;

  const { data: acc } = await db
    .from('accounts')
    .select('preferred_language')
    .eq('id', accountId)
    .single();

  const lang = acc?.preferred_language ?? 'en';
  if (lang === 'en') return templateName;

  const hiName = `[HI] ${templateName}`;
  const { data: hiTemplate } = await db
    .from('message_templates')
    .select('name')
    .eq('account_id', accountId)
    .eq('name', hiName)
    .maybeSingle();

  if (hiTemplate) {
    console.log(
      `[automations:R6] language swap "${templateName}" → "${hiName}" (lang=${lang})`
    );
    return hiName;
  }

  // No [HI] sibling found — use the original.
  return templateName;
}
```

### Fix — Step B: Patch the `send_template` case

Inside the `send_template` case, find:

```typescript
if (!cfg.template_name) throw new Error('send_template needs template_name');
const conversationId = await resolveConversationId(args);
```

Replace with:

```typescript
if (!cfg.template_name) throw new Error('send_template needs template_name');
// Section R6: swap to [HI] sibling if account prefers Hindi/Hinglish.
const resolvedTemplateName = await resolveLocalizedTemplateName(
  db,
  args.automation.account_id,
  cfg.template_name
);
const conversationId = await resolveConversationId(args);
```

Then find the `engineSendTemplate` call:

```typescript
        templateName: cfg.template_name,
```

Replace with:

```typescript
        templateName: resolvedTemplateName,
```

### Verify

```bash
grep -n "resolveLocalizedTemplateName\|preferred_language\|\[HI\]" src/lib/automations/engine.ts
# Expected: shows helper definition and two call-site lines
npm run typecheck
# Must exit 0
npm run test
# Must pass: 1023 tests
```

---

## FIX 7 — MISSING-01: EMI Calculator Component

**Files:**

- `src/components/properties/emi-calculator.tsx` — CREATE
- `src/app/(dashboard)/properties/[id]/page.tsx` — MODIFY

### Fix — Create `src/components/properties/emi-calculator.tsx`

```typescript
'use client';

import { useState, useCallback } from 'react';
import { formatINR } from '@/lib/currency';

interface EmiCalculatorProps {
  /** Property price in INR — pre-fills loan amount at 80% LTV. */
  propertyPrice?: number | null;
  /**
   * Lead's budget_max used as a proxy for affordability check.
   * If set, EMI is compared against 40% of (budget_max / 12).
   */
  budgetMax?: number | null;
}

/**
 * Section R7 — EMI calculator embedded in the property detail page.
 * Pure client component: all calculations are local, no network calls.
 */
export function EmiCalculator({ propertyPrice, budgetMax }: EmiCalculatorProps) {
  const [loanAmount, setLoanAmount] = useState(
    propertyPrice ? Math.round(propertyPrice * 0.8) : 5000000
  );
  const [interestRate, setInterestRate] = useState(8.5);
  const [tenureYears, setTenureYears] = useState(20);

  const calculateEmi = useCallback(
    (principal: number, annualRate: number, years: number): number => {
      if (principal <= 0 || annualRate <= 0 || years <= 0) return 0;
      const r = annualRate / 100 / 12;
      const n = years * 12;
      return Math.round((principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
    },
    []
  );

  const emi = calculateEmi(loanAmount, interestRate, tenureYears);
  const totalPayable = emi * tenureYears * 12;
  const totalInterest = totalPayable - loanAmount;

  const monthlyBudgetProxy = budgetMax ? Math.round(budgetMax / 12) : null;
  const isAffordable =
    monthlyBudgetProxy && emi > 0 ? emi <= monthlyBudgetProxy * 0.4 : null;

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-base font-semibold">EMI Calculator</h3>

      <div className="space-y-4">
        <div>
          <label className="text-muted-foreground mb-1 block text-sm">
            Loan Amount
          </label>
          <input
            type="number"
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            value={loanAmount}
            min={0}
            step={100000}
            onChange={(e) => setLoanAmount(Number(e.target.value))}
            aria-label="Loan amount in rupees"
          />
          {loanAmount > 0 && (
            <p className="text-muted-foreground mt-0.5 text-xs">{formatINR(loanAmount)}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-muted-foreground mb-1 block text-sm">
              Rate (% p.a.)
            </label>
            <input
              type="number"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              value={interestRate}
              min={1}
              max={30}
              step={0.1}
              onChange={(e) => setInterestRate(Number(e.target.value))}
              aria-label="Annual interest rate"
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-sm">
              Tenure (Years)
            </label>
            <input
              type="number"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              value={tenureYears}
              min={1}
              max={30}
              step={1}
              onChange={(e) => setTenureYears(Number(e.target.value))}
              aria-label="Loan tenure in years"
            />
          </div>
        </div>
      </div>

      {emi > 0 && (
        <div className="bg-muted/50 mt-4 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Monthly EMI</span>
            <span className="text-primary text-lg font-bold">{formatINR(emi)}</span>
          </div>
          <div className="text-muted-foreground mt-2 space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Total Interest</span>
              <span>{formatINR(totalInterest)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Payable</span>
              <span>{formatINR(totalPayable)}</span>
            </div>
          </div>

          {isAffordable !== null && (
            <div
              className={`mt-3 rounded-md px-3 py-2 text-xs font-medium ${
                isAffordable
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
              }`}
            >
              {isAffordable
                ? '✓ Fits budget — EMI is within 40% of monthly budget'
                : '⚠ May stretch budget — EMI exceeds 40% of monthly budget'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Fix — Wire into property detail page

Read `src/app/(dashboard)/properties/[id]/page.tsx` in full first. Then:

1. Add import at top of file:

```typescript
import { EmiCalculator } from '@/components/properties/emi-calculator';
```

2. Find the main property detail grid/section and append the EMI calculator after the last detail card:

```tsx
{
  /* Section R7: EMI Calculator */
}
<div className="mt-6">
  <EmiCalculator propertyPrice={property.price ?? null} />
</div>;
```

### Verify

```bash
ls src/components/properties/emi-calculator.tsx
# Must exist
grep -n "EmiCalculator" "src/app/(dashboard)/properties/[id]/page.tsx"
# Must show import and usage
npm run typecheck
# Must exit 0
```

---

## FIX 8 — MISSING-02: Brokerage Badge on Deal Cards

**Files:**

- `src/components/pipelines/brokerage-badge.tsx` — CREATE
- `src/components/pipelines/deal-card.tsx` — MODIFY
- `src/components/pipelines/pipeline-board.tsx` — MODIFY (pass prop down)
- `src/components/settings/deals-settings.tsx` — MODIFY (add input)

### Fix — Create `src/components/pipelines/brokerage-badge.tsx`

```typescript
import { formatINR } from '@/lib/currency';

interface BrokerageBadgeProps {
  dealValue: number | null | undefined;
  /** Brokerage %, e.g. 2 for 2%. Sourced from accounts.settings.brokerage_pct. */
  brokeragePct: number | null | undefined;
  className?: string;
}

/**
 * Section R7 — Displays estimated brokerage for a deal.
 * Renders nothing if dealValue or brokeragePct is missing/zero.
 */
export function BrokerageBadge({
  dealValue,
  brokeragePct,
  className,
}: BrokerageBadgeProps) {
  if (!dealValue || !brokeragePct || brokeragePct <= 0) return null;

  const brokerage = Math.round((dealValue * brokeragePct) / 100);

  return (
    <span
      className={`inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 ${className ?? ''}`}
      title={`Brokerage @ ${brokeragePct}%`}
    >
      {formatINR(brokerage)} brokerage
    </span>
  );
}
```

### Fix — Modify `deal-card.tsx`

**Read the file in full first.** Then:

1. Add import:

```typescript
import { BrokerageBadge } from '@/components/pipelines/brokerage-badge';
```

2. Add `brokeragePct?: number | null` to the component's props interface.

3. In the JSX section where `deal.value` is displayed (find the `formatINR(deal.value)` block), add the badge immediately below:

```tsx
<BrokerageBadge dealValue={deal.value} brokeragePct={brokeragePct} />
```

### Fix — Modify `pipeline-board.tsx`

**Read the file in full first.** Then:

1. Fetch `settings` from the account (check if there is an existing account query; if not, add):

```typescript
const { data: accountRow } = await supabase
  .from('accounts')
  .select('settings')
  .eq('id', accountId)
  .single();

const brokeragePct =
  ((accountRow?.settings as Record<string, unknown> | null)?.brokerage_pct as
    number | null) ?? null;
```

2. Pass `brokeragePct={brokeragePct}` into each `<DealCard>` render call.

### Fix — Add Brokerage % input to `deals-settings.tsx`

**Read the file in full first** to understand how other settings are saved. Then add a controlled numeric input for `brokerage_pct` that saves to `accounts.settings` via `PATCH /api/account`:

```typescript
// State
const [brokeragePct, setBrokeragePct] = useState<number | null>(null);

// Load from account settings on mount (use existing load pattern in the file)

// Save handler (call alongside other save operations)
await fetch('/api/account', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    settings: { ...existingSettings, brokerage_pct: brokeragePct },
  }),
});
```

JSX input:

```tsx
<div className="space-y-2">
  <label className="text-sm font-medium" htmlFor="brokerage-pct">
    Brokerage Percentage (%)
  </label>
  <input
    id="brokerage-pct"
    type="number"
    min={0}
    max={10}
    step={0.1}
    className="border-input bg-background w-32 rounded-md border px-3 py-2 text-sm"
    value={brokeragePct ?? ''}
    onChange={(e) =>
      setBrokeragePct(e.target.value ? Number(e.target.value) : null)
    }
    placeholder="e.g. 2"
  />
  <p className="text-muted-foreground text-xs">
    Shown as estimated brokerage on Pipeline deal cards.
  </p>
</div>
```

> **Agent note on PATCH /api/account:** Verify that `src/app/api/account/route.ts` handles a `settings` field in the PATCH body. If not, add it following the same pattern as `cost_sheet_template_id` (JSONB merge, not overwrite).

### Verify

```bash
ls src/components/pipelines/brokerage-badge.tsx
# Must exist
grep -n "BrokerageBadge\|brokeragePct" src/components/pipelines/deal-card.tsx
# Must show import and usage
npm run typecheck
# Must exit 0
```

---

## FIX 9 — MISSING-04: Print Report on Team Dashboard

**Files:**

- `src/app/(dashboard)/team/page.tsx` — MODIFY
- `src/app/(dashboard)/team/team-client.tsx` — MODIFY

### Reconnaissance

```bash
cat "src/app/(dashboard)/team/page.tsx"
cat "src/app/(dashboard)/team/team-client.tsx"
# Read both files IN FULL before making any changes.
# Understand the existing props interface for TeamClient.
```

### Fix — `page.tsx` — Read `?print` param and add Print button

1. Update the page function signature to accept `searchParams`:

```typescript
export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ print?: string }>;
}) {
  const params = await searchParams;
  const isPrint = params.print === 'true';
  // ... existing data fetching ...
  return <TeamClient /* existing props */ isPrint={isPrint} />;
}
```

2. Add a "Print Report" button in the page header (find the existing header/action area):

```tsx
import { Printer } from 'lucide-react';

// In the header:
<a
  href="?print=true"
  target="_blank"
  rel="noopener noreferrer"
  className="hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
  aria-label="Open printable team report"
>
  <Printer className="size-4" />
  Print Report
</a>;
```

### Fix — `team-client.tsx` — Accept `isPrint` prop, add CSS and auto-trigger

1. Add `isPrint?: boolean` to the component props interface.

2. Add `useEffect` import if not already present. Add the auto-print trigger:

```typescript
useEffect(() => {
  if (!isPrint) return;
  const t = setTimeout(() => window.print(), 600);
  return () => clearTimeout(t);
}, [isPrint]);
```

3. Add a `<style>` element for `@media print` when `isPrint` is true:

```tsx
{
  isPrint && (
    <style>{`
    @media print {
      @page { size: A4 portrait; margin: 15mm; }
      body { background: white !important; color: black !important; }
      nav, aside, [data-sidebar], .no-print { display: none !important; }
      .print\\:break-inside-avoid { break-inside: avoid; }
    }
  `}</style>
  );
}
```

### Verify

```bash
grep -n "isPrint\|print=true\|@media print\|Printer" \
  "src/app/(dashboard)/team/page.tsx" \
  "src/app/(dashboard)/team/team-client.tsx"
# Expected: shows all four patterns
npm run typecheck
# Must exit 0
```

---

## FIX 10 — QUALITY-03: Replace `window.location.href` with `router.push()` for Internal Routes

**Files:**

- `src/components/settings/billing-tab.tsx`
- `src/components/contacts/cost-sheet-modal.tsx`

### Reconnaissance

```bash
grep -n "window.location.href" \
  src/components/settings/billing-tab.tsx \
  src/components/contacts/cost-sheet-modal.tsx
# Note exact lines and target paths
```

### Fix — For each internal-route `window.location.href` assignment

> **Agent note:** Only replace assignments pointing to **internal** paths (starting with `/`). Do NOT touch external Stripe checkout URLs — those MUST remain as `window.location.href`.

For each file:

1. Add `useRouter` import if not present:

```typescript
import { useRouter } from 'next/navigation';
```

2. Add `const router = useRouter();` inside the component function.

3. Replace:

```typescript
window.location.href = '/internal/path';
```

With:

```typescript
router.push('/internal/path');
```

### Verify

```bash
npm run lint 2>&1 | grep "no-location-assign-relative-destination"
# Expected: NO output for these two files
npm run typecheck
# Must exit 0
```

---

## FIX 11 — QUALITY-04: Onboarding Checklist — Persist Dismiss to DB

**File:** `src/components/onboarding/team-setup-checklist.tsx`

### Reconnaissance

```bash
cat src/components/onboarding/team-setup-checklist.tsx
# Read in full before editing

# Also check what PATCH /api/account supports:
grep -n "settings\|PATCH" src/app/api/account/route.ts | head -20
```

> **Prerequisite check:** If `PATCH /api/account` does not support a `settings` field merge, add it first following the same pattern as `cost_sheet_template_id`. Look for the `updates` object construction block in that route.

### Fix — Replace dismiss handler

Replace:

```typescript
const handleDismiss = () => {
  localStorage.setItem('wacrm_hide_team_checklist', 'true');
  setVisible(false);
};
```

With:

```typescript
const handleDismiss = async () => {
  setVisible(false); // Optimistic hide — instant UX
  try {
    await fetch('/api/account', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: { onboarding_dismissed: true },
      }),
    });
  } catch {
    // Non-critical — fall back to localStorage so the banner
    // stays hidden for this session at minimum.
    localStorage.setItem('wacrm_hide_team_checklist', 'true');
  }
};
```

### Fix — Check DB dismiss state on mount

In the `checkMembers` async function (inside `useEffect`), add a DB dismiss check BEFORE the localStorage check:

```typescript
// Check DB-persisted dismiss state first (works across devices/browsers).
const supabase = createClient();
const { data: acc } = await supabase
  .from('accounts')
  .select('settings')
  .eq('id', accountId)
  .single();

const settings = (acc?.settings as Record<string, unknown> | null) ?? {};
if (settings.onboarding_dismissed === true) {
  setLoading(false);
  return;
}
```

### Verify

```bash
grep -n "onboarding_dismissed\|PATCH\|settings" src/components/onboarding/team-setup-checklist.tsx
# Expected: shows DB persist pattern
npm run typecheck
# Must exit 0
```

---

## FIX 12 — MISSING-05: Update IMPLEMENTATION_PLAN.md Migration References

**File:** `IMPLEMENTATION_PLAN.md`

**Why:** The plan references migrations 106–111 that don't exist as files, misleading future agents.

### Reconnaissance

```bash
ls supabase/migrations/ | sort
# Capture the authoritative list of actual filenames
grep -n "106_\|107_\|108_\|110_\|111_" IMPLEMENTATION_PLAN.md
# Find all stale references
```

### Fix

1. Replace all stale references found in the grep above with the correct filenames:

| Old (in plan)                | Correct (actual file)                                       |
| ---------------------------- | ----------------------------------------------------------- |
| `106_billing.sql`            | `119_billing.sql`                                           |
| `107_portal_connections.sql` | `120_portal_connections.sql`                                |
| `108_tasks.sql`              | `121_tasks.sql`                                             |
| `110_india_defaults.sql`     | `115_india_localization.sql`                                |
| `111_hinglish_templates.sql` | (verify with `ls supabase/migrations/ \| grep -i hinglish`) |

2. Add the following note to the **top of the "Migrations" section** in `IMPLEMENTATION_PLAN.md`:

```markdown
> **Note for agents (added 2026-10-01):** Migration filenames in this plan reflect
> the original numbering intent but were renumbered during execution. Always run
> `ls supabase/migrations/ | sort` to see actual filenames before referencing or
> creating migrations. Do not renumber existing migration files.
```

3. Also update `docs/agent/SCHEMA_REFERENCE.md` if it references the same stale numbers.

### Verify

```bash
grep "106_\|107_billing\|107_portal\|108_tasks\|110_india\|111_hinglish" IMPLEMENTATION_PLAN.md
# Expected: NO output (all stale references replaced)
```

---

## Final Verification (Run All After Completing FIX 1–12)

```bash
# TypeScript — must be completely clean
npm run typecheck
# Expected: exit 0, zero errors

# Full test suite — must all pass
npm run test
# Expected: 1023 tests, 89 test files

# Lint — no new errors (warnings acceptable)
npm run lint 2>&1 | grep " error " | grep -v node_modules
# Expected: no output

# Spot-checks
grep -c "subscription_details" src/app/api/billing/webhook/route.ts
# Expected: 2

grep "CRON_SECRET" .env.local.example
# Expected: CRON_SECRET=generate-a-long-random-string

grep "lead_details" src/app/api/webhooks/inbound-email/route.ts
# Expected: shows upsert call

ls src/components/properties/emi-calculator.tsx src/components/pipelines/brokerage-badge.tsx
# Both must exist

grep "resolveLocalizedTemplateName" src/lib/automations/engine.ts
# Expected: shows helper + call site

grep "earlyStageIds" src/app/api/cron/stale-leads/route.ts
# Expected: shows two-step query approach

grep "validActions\|'close'\|'tag'" src/app/api/contacts/bulk/route.ts
# Expected: shows all three action branches
```

## Post-Fix: Update PROGRESS.md

After all fixes are verified and committed:

1. Add a section in `PROGRESS.md` under a new heading `## Second Audit Fixes (FIX_PLAN_2.md)` listing all 12 fixes as ✅ done.
2. Mark R6 (Hinglish engine wiring) and R7 (EMI Calculator, Brokerage Badge) as ✅ complete.
3. Mark V3 (Print Report) as ✅ complete.
