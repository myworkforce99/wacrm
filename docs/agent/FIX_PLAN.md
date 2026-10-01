# Audit Fix Plan — wacrm Real Estate CRM

**For execution by AI coding agent**
**Based on audit dated 2026-09-30**

> Read docs/agent/ARCHITECTURE.md and docs/agent/SCHEMA_REFERENCE.md before touching any file.
> Do reconnaissance: read the full current file before editing any line in it.
> After every fix: npm run typecheck && npm run lint && npm run format:check.
> These fixes are deliberately scoped to be minimal and surgical.
> This entire plan is one branch / one PR.

---

## Fix 1 — P0: Rename Migration Files to Resolve 115_* Conflict

### Problem

Two migration files share the 115_ prefix:

- supabase/migrations/115_agent_targets.sql
- supabase/migrations/115_india_localization.sql

Supabase orders migrations by filename string sort. 115_agent_targets < 115_india_localization
alphabetically. 115_india_localization.sql calls DROP FUNCTION IF EXISTS handle_new_user()
then recreates it WITHOUT the qualifier flow. Then 117_re_qualifier_flow.sql re-adds it.
If migrations ever replay on a fresh DB, the order issue causes unpredictable trigger state.

### Steps

1a. Rename files using git mv (preserves history):

cd supabase/migrations
git mv 115_agent_targets.sql 116_agent_targets.sql
git mv 116_re_broadcast_templates.sql 117_re_broadcast_templates.sql
git mv 117_re_qualifier_flow.sql 118_re_qualifier_flow.sql
git mv 118_billing.sql 119_billing.sql
git mv 119_portal_connections.sql 120_portal_connections.sql
git mv 120_tasks.sql 121_tasks.sql

115_india_localization.sql stays unchanged.

1b. Grep for any cross-references to old migration numbers in comments/docs/CI:
grep -r "116_re_broadcast\|117_re_qualifier\|118_billing\|119_portal\|120_tasks" \
--include="_.ts" --include="_.tsx" --include="_.md" --include="_.sql" \
--include="_.yml" --include="_.yaml" .
Update any found references.

1c. Update the internal comment in 119_portal_connections.sql (currently says
"-- migration 119_portal_connections.sql" on line 1) to match the new filename.

1d. Verify correct ordering after rename:
ls supabase/migrations/ | sort | grep -E "^11[5-9]|^12[0-9]"

Expected output (no duplicates, no gaps):
115_india_localization.sql
116_agent_targets.sql
117_re_broadcast_templates.sql
118_re_qualifier_flow.sql
119_billing.sql
120_portal_connections.sql
121_tasks.sql

1e. IMPORTANT: Do NOT re-run these migrations on an existing DB. All use
IF NOT EXISTS / ADD COLUMN IF NOT EXISTS — they are idempotent. On a
fresh DB they apply in the correct new order. On existing staging/prod,
no action needed — schema is already correct, only filenames were wrong.

### Verification

npm run typecheck && npm run lint
(No code files reference migration filenames at runtime — file-system-only change.)

---

## Fix 2 — P0: Forward leadSegment in Broadcast New Page

### Problem

File: src/app/(dashboard)/broadcasts/new/page.tsx

The handleSend() function builds an audience object for createAndSendBroadcast.
It passes type/tagIds/customField/csvContacts/excludeTagIds but OMITS leadSegment.
The use-broadcast-sending.ts hook DOES implement resolveLeadSegmentAudience (line 214)
but it is never called because the payload never carries leadSegment.filters.
Result: every "Lead Details Segment" broadcast silently sends to ALL contacts.

### Reconnaissance before editing

Read full src/app/(dashboard)/broadcasts/new/page.tsx.
Read full src/hooks/use-broadcast-sending.ts.
Confirm AudienceConfig at lines 18-32 of use-broadcast-sending.ts includes:
leadSegment?: { filters: { field: string; operator: string; value: string }[] }

### The Fix

File: src/app/(dashboard)/broadcasts/new/page.tsx

Find the handleSend function. Locate the audience: { ... } object passed to
createAndSendBroadcast. Add exactly ONE line: leadSegment: audience.leadSegment

CURRENT CODE (inside handleSend, lines ~55-67):
audience: {
type: audience.type,
tagIds: audience.tagIds,
customField: audience.customField,
csvContacts: audience.csvContacts,
excludeTagIds: audience.excludeTagIds,
},

REPLACE WITH:
audience: {
type: audience.type,
tagIds: audience.tagIds,
customField: audience.customField,
csvContacts: audience.csvContacts,
excludeTagIds: audience.excludeTagIds,
leadSegment: audience.leadSegment,
},

That is the ENTIRE change. Do not touch anything else in this file.

### Verification

npm run typecheck — audience.leadSegment matches AudienceConfig.leadSegment, no type error.
npm run lint — no lint issues.

---

## Fix 3 — P1: Fix current_period_end in Billing Webhook

### Problem

File: src/app/api/billing/webhook/route.ts (in checkout.session.completed case)

The handler tries to read subscription.current_period_end from the top-level Stripe
Subscription object. This field was removed in Stripe API 2026-08-26.dahlia and moved
to subscription.items.data[0].current_period_end. The @ts-ignore suppresses the TypeScript
error. Result: new Date(undefined * 1000) = Invalid Date. The DB write is skipped (falsy
guard). current_period_end is always null. The billing tab "Renews in N days" is always empty.

### Reconnaissance before editing

Read full src/app/api/billing/webhook/route.ts.
Note the stripe instance is already created at the top of the file with apiVersion 2026-08-26.dahlia.

### The Fix

File: src/app/api/billing/webhook/route.ts

Find the checkout.session.completed case block. Locate this exact code block:

// Expand the subscription to get the period end
let current_period_end: Date | null = null;
if (session.subscription) {
const subscriptionId =
typeof session.subscription === 'string'
? session.subscription
: session.subscription.id;
const subscription =
await stripe.subscriptions.retrieve(subscriptionId);
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
current_period_end = new Date(subscription.current_period_end * 1000);
}

REPLACE WITH:

// Retrieve the subscription to get the current period end.
// In Stripe API 2026-08-26.dahlia, current_period_end lives on each
// subscription item (subscription.items.data[0].current_period_end),
// not on the top-level subscription object — which is why the previous
// implementation required @ts-ignore and silently produced null.
let current_period_end: Date | null = null;
if (session.subscription) {
const subscriptionId =
typeof session.subscription === 'string'
? session.subscription
: session.subscription.id;
const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
expand: ['items.data'],
});
const periodEnd = subscription.items?.data?.[0]?.current_period_end;
if (typeof periodEnd === 'number') {
current_period_end = new Date(periodEnd * 1000);
}
}

Key changes from current code:

- Removed the @ts-ignore and eslint-disable-next-line comments.
- Added { expand: ['items.data'] } to the retrieve() call.
- Read from subscription.items.data[0].current_period_end instead of top-level field.
- Added typeof periodEnd === 'number' guard before constructing the Date.

### Verification

npm run typecheck — no @ts-ignore needed; path resolves cleanly through Stripe TS types.
npm run lint — no dangling ignore comments.
Integration test with Stripe CLI:
stripe events resend evt_<your_checkout_session_completed_event_id>
Confirm current_period_end is written to accounts table.

---

## Fix 4 — P2: Expand Middleware Billing Gate to All Protected Routes

### Problem

File: src/middleware.ts

The protectedPaths array is used for both:
(a) redirecting unauthenticated users to /login
(b) redirecting past_due/canceled accounts to /billing

It currently only has 8 entries, missing: /integrations, /site-visits, /properties,
/flows, /team, /agents, /notifications. A past_due or canceled account can access
these routes freely.

### Reconnaissance before editing

Read full src/middleware.ts. Note protectedPaths is declared once and used in two
separate if-blocks. Adding paths here automatically applies BOTH the auth redirect
and the billing gate — no other code changes needed.
Check src/app/(dashboard)/ to confirm all current route folders (run: ls src/app/(dashboard)/).

### The Fix

File: src/middleware.ts

Find the protectedPaths array declaration (lines ~78-87).

CURRENT CODE:
const protectedPaths = [
'/dashboard',
'/inbox',
'/contacts',
'/pipelines',
'/broadcasts',
'/automations',
'/settings',
'/billing',
];

REPLACE WITH:
// All dashboard routes that require (a) authentication and (b) an active
// subscription. Add any new dashboard route here when it is created so it
// automatically gets both the auth redirect and the billing gate.
// NOTE: /billing itself must be in this list for the auth redirect to fire
// on unauthenticated users trying to directly access /billing.
const protectedPaths = [
'/dashboard',
'/inbox',
'/contacts',
'/pipelines',
'/broadcasts',
'/automations',
'/settings',
'/billing',
'/integrations',
'/site-visits',
'/properties',
'/flows',
'/team',
'/agents',
'/notifications',
];

That is the ENTIRE change — 7 new string entries. Do not touch any redirect logic.
The withRefreshedCookies wrapper is already applied to all redirect branches.

### Verification

npm run typecheck && npm run lint — trivial string array, no type impact.
Manual: with a past_due account, navigate to /integrations → redirects to /billing.

---

## Fix 5 — P2: Fix Infinite Re-render in BillingTab useEffect

### Problem

File: src/components/settings/billing-tab.tsx

createClient() is called at component scope (line ~19), creating a new Supabase client
object on every render. It is then included in the useEffect dependency array (line ~67).
React sees a new reference on every render → runs the effect → sets state → re-renders
→ new supabase object → runs effect again → infinite loop of billing data fetches.

### Reconnaissance before editing

Read full src/components/settings/billing-tab.tsx. Confirm:

- supabase is used ONLY inside the useEffect's loadData function (lines ~37-56).
- supabase is NOT used in handleCheckout, handleManage, or any JSX — those use fetch().
- Therefore moving createClient() inside the effect has zero impact on the rest of the component.

### The Fix

File: src/components/settings/billing-tab.tsx

STEP A: Find and DELETE the top-level supabase declaration (approximately line 19):
const supabase = createClient();
DELETE THIS LINE ENTIRELY. The createClient import stays — it is still needed inside the effect.

STEP B: Find the useEffect block (lines ~31-67).
Add const supabase = createClient(); as the first statement inside the effect callback,
AFTER the early return guard.
Change the dependency array from [accountId, supabase] to [accountId].

CURRENT STRUCTURE of the useEffect:
useEffect(() => {
if (!accountId) return;

    async function loadData() {
      setLoading(true);
      try {
        const [accountRes, profilesRes] = await Promise.all([
          supabase.from('accounts').select(...).eq('id', accountId).single(),
          supabase.from('profiles').select(...).eq('account_id', accountId),
        ]);
        if (accountRes.error) throw accountRes.error;
        if (profilesRes.error) throw profilesRes.error;
        setData({ ...accountRes.data, seat_usage: profilesRes.count || 0 });
      } catch (err: unknown) {
        console.error('Failed to load billing info:', err);
        toast.error('Failed to load billing info');
      } finally {
        setLoading(false);
      }
    }

    loadData();

}, [accountId, supabase]);

REPLACE WITH:
useEffect(() => {
if (!accountId) return;

    // Create the Supabase client inside the effect so it is not a reactive
    // dependency. createClient() returns a new object reference on every
    // call — including it in deps causes an infinite re-fetch loop.
    const supabase = createClient();

    async function loadData() {
      setLoading(true);
      try {
        const [accountRes, profilesRes] = await Promise.all([
          supabase.from('accounts').select(...).eq('id', accountId).single(),
          supabase.from('profiles').select(...).eq('account_id', accountId),
        ]);
        if (accountRes.error) throw accountRes.error;
        if (profilesRes.error) throw profilesRes.error;
        setData({ ...accountRes.data, seat_usage: profilesRes.count || 0 });
      } catch (err: unknown) {
        console.error('Failed to load billing info:', err);
        toast.error('Failed to load billing info');
      } finally {
        setLoading(false);
      }
    }

    loadData();

}, [accountId]);

IMPORTANT: The ... placeholders above represent the ACTUAL code in the file.
Do NOT copy the placeholder text. Edit only:

1. Add const supabase = createClient(); after the early return.
2. Change [accountId, supabase] to [accountId].
   Leave all other code inside loadData exactly as-is.

### Verification

npm run typecheck — supabase is now in scope within the effect; no type errors.
npm run lint — react-hooks/exhaustive-deps rule is satisfied.
Manual: open Settings → Billing tab, check Network tab in DevTools.
Should see exactly 2 Supabase requests on mount, not a continuous stream.

---

## Fix 6 — P3: Fix Unsafe Type Cast in step1-choose-template.tsx

### Problem

File: src/components/broadcasts/step1-choose-template.tsx (lines ~137-141)

The filter for the "Real Estate" tag chip uses:
// eslint-disable-next-line @typescript-eslint/no-explicit-any
((t as any).tags && (t as any).tags.includes(filterTag))

This is an unsafe cast that bypasses TypeScript's type checking.
The broadcast_templates rows carry a tags: string[] field not on MessageTemplate.

### Reconnaissance before editing

Read the filter block in step1-choose-template.tsx (~lines 135-141).
Confirm globalTemplates maps broadcast_templates rows to MessageTemplate shape at lines ~57-64
(the tags field is spread in via ...t).

### The Fix

File: src/components/broadcasts/step1-choose-template.tsx

Find this exact block:
.filter(
(t: MessageTemplate) =>
filterTag === 'all' ||
// eslint-disable-next-line @typescript-eslint/no-explicit-any
((t as any).tags && (t as any).tags.includes(filterTag))
)

REPLACE WITH:
.filter((t: MessageTemplate) => {
if (filterTag === 'all') return true;
// broadcast_templates rows are spread into MessageTemplate shape but
// carry an extra tags?: string[] field. Use a typed intersection
// cast rather than `as any` to keep the compiler's structural checks.
const tags = (t as MessageTemplate & { tags?: string[] }).tags;
return Array.isArray(tags) && tags.includes(filterTag);
})

Remove the eslint-disable-next-line comment entirely — the as any is gone.
No logic change — same filter, type-safe.

### Verification

npm run typecheck — no no-explicit-any violations.
npm run lint — no eslint-disable comments remaining in this section.
Manual: in broadcast wizard Step 1, click "Real Estate" chip.
Diwali Offer, New Project Launch, Price Drop Alert templates should appear.
Click "All Templates" — both RE templates and Meta-approved templates appear.

---

## Post-Fix Checklist

Run in order after all six fixes are applied:

npm run typecheck
npm run lint
npm run format:check
npm run test

Verify migration order:
ls supabase/migrations/ | sort | grep -E "^1[0-9]{2}_"

Expected (no duplicates, no gaps 115-121):
115_india_localization.sql
116_agent_targets.sql
117_re_broadcast_templates.sql
118_re_qualifier_flow.sql
119_billing.sql
120_portal_connections.sql
121_tasks.sql

## Commit Message

fix: resolve P0-P3 audit issues

- rename 115_agent_targets → 116 (cascade renumber 116→121) to fix
  duplicate migration prefix conflict with 115_india_localization
- forward leadSegment in broadcasts/new/page.tsx handleSend so
  lead_segment audience type actually filters recipients
- fix current_period_end read in billing webhook (use items.data[0]
  instead of removed top-level field, Stripe API 2026-08-26)
- expand middleware protectedPaths to cover all dashboard routes
  so past_due accounts cannot access /integrations, /flows etc.
- move createClient() inside useEffect in billing-tab to prevent
  infinite re-render from supabase reference in deps array
- replace (t as any).tags with typed intersection cast in
  step1-choose-template
