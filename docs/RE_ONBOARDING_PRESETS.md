# Real Estate Onboarding Presets — Tracking Document

> **Purpose:** Single source of truth for every default/preset configuration automatically
> seeded into a new real estate account on signup. Update this file whenever a new
> preset is added, modified, or removed via a migration.
>
> **Convention:** Each section maps to a migration file. Presets are grouped by the
> entity they populate. The **Status** column reflects whether the preset is live in
> the current `handle_new_user` trigger.

---

## How Presets Work

Every new account is bootstrapped by the `handle_new_user` Postgres trigger
(`auth.users → INSERT`). Migrations progressively extended this trigger function.
As of migration `126`, the trigger calls a dedicated helper function
`seed_re_presets_for_account(account_id, user_id)` which can also be used in
backfill `DO $$ ... $$` blocks to apply new presets to existing accounts.

```
New user signup
    └─▶ handle_new_user() trigger
            ├─ accounts + profiles rows
            ├─ Real Estate pipeline + stages   (100)
            ├─ Site-visit automations          (115)
            ├─ Qualification flow              (118/123)
            └─ seed_re_presets_for_account()   (126)
                    ├─ Tags
                    ├─ Custom Fields
                    └─ Quick Replies
```

---

## Preset Registry

### A. Pipeline & Stages

**Migration:** `100_real_estate_schema.sql` | **Status:** ✅ Live

| Stage       | Position | Colour              |
| ----------- | -------- | ------------------- |
| New         | 0        | `#3b82f6` (blue)    |
| Contacted   | 1        | `#8b5cf6` (violet)  |
| Site Visit  | 2        | `#ec4899` (pink)    |
| Negotiation | 3        | `#f59e0b` (amber)   |
| Closed      | 4        | `#10b981` (emerald) |

**Reasoning:** Mirrors the screenshot from Zakell.com demo and the canonical Indian
real estate sales motion (lead → contact → visit → negotiate → book).

---

### B. Automations (Site Visit)

**Migration:** `115_india_localization.sql` (extended in `118`, `123`) | **Status:** ✅ Live

| Automation                                   | Trigger Type         | Default State | Purpose                                        |
| -------------------------------------------- | -------------------- | ------------- | ---------------------------------------------- |
| T-24h Visit Confirmation                     | `visit_reminder_24h` | Active        | Confirms visit the day before                  |
| T-2h Visit Reminder                          | `visit_reminder_2h`  | Active        | Last-minute reminder + pickup info             |
| No-show Recovery                             | `visit_no_show`      | Active        | Re-engages missed-visit leads                  |
| No WhatsApp reply in 30 min → notify manager | `sla_breach`         | **Inactive**  | Escalation — must be configured by owner       |
| Lead in New stage for 48h → escalate         | `stale_lead`         | **Inactive**  | Stale-lead alert — must be configured by owner |

> SLA and stale-lead automations are seeded as **inactive** because they require
> an admin-configured target agent/number before they make sense.

---

### C. Qualification Flow (Inbox Bot)

**Migration:** `118_re_qualifier_flow.sql` (fixed in `123`) | **Status:** ✅ Live (seeded as `draft`)

**Flow name:** _Real Estate Qualifier (Auto)_  
**Trigger:** `new_contact_created`  
**Default state:** `draft` — owner must activate it after reviewing.

| Node             | Type                 | Purpose                                        |
| ---------------- | -------------------- | ---------------------------------------------- |
| start            | start                | Entry point                                    |
| welcome          | collect_input        | Asks for budget (free-text number)             |
| capture_budget   | update_contact_field | Writes `lead_details.budget_max`               |
| ask_bhk          | send_buttons         | 1 BHK / 2 BHK / 3+ BHK                         |
| capture_bhk      | update_contact_field | Writes `lead_details.configuration_preference` |
| ask_location     | collect_input        | Asks for preferred location                    |
| capture_location | update_contact_field | Writes `lead_details.location_preference`      |
| routing          | assign_conversation  | Round-robin assignment to team                 |
| end              | end                  | Terminal node                                  |

---

### D. Tags

**Migration:** `126_re_onboarding_presets.sql` | **Status:** ✅ Live

Tags are `user_id`-scoped (seeded against the account owner's `user_id`).

#### Priority Signal Tags

| Tag     | Colour    | Purpose                                |
| ------- | --------- | -------------------------------------- |
| 🔥 Hot  | `#ef4444` | High-intent, needs immediate follow-up |
| 🟡 Warm | `#f59e0b` | Engaged but not urgent                 |
| 🔵 Cold | `#3b82f6` | Early-stage / low intent               |

#### Lead Source Tags

| Tag          | Colour    | Maps to Portal           |
| ------------ | --------- | ------------------------ |
| 99acres      | `#16a34a` | 99acres.com portal       |
| MagicBricks  | `#dc2626` | MagicBricks portal       |
| Housing.com  | `#7c3aed` | Housing.com portal       |
| NoBroker     | `#0284c7` | NoBroker.com portal      |
| Walk-in      | `#0d9488` | Physical office walk-in  |
| Referral     | `#d97706` | Word-of-mouth / referral |
| Meta Ads     | `#2563eb` | Facebook/Instagram Ads   |
| Google Ads   | `#16a34a` | Google Ads / Search      |
| Manual Entry | `#6b7280` | Manually imported        |

#### Intent/Status Tags

| Tag             | Colour    | Purpose                           |
| --------------- | --------- | --------------------------------- |
| Site Visit Done | `#10b981` | Completed at least one site visit |
| Docs Requested  | `#8b5cf6` | Booking docs requested            |
| Loan Inquiry    | `#f97316` | Exploring home loan options       |
| Not Responding  | `#991b1b` | Multiple follow-ups, no reply     |
| Not Interested  | `#374151` | Closed as lost                    |

> The source tags are intentionally consistent with the `portal_connections` JSONB
> column (migration 120) and the `lead_details.source` column (migration 105).
> Agents should apply one source tag at the time of lead import for easy filtering.

---

### E. Contact Custom Fields

**Migration:** `126_re_onboarding_presets.sql` | **Status:** ✅ Live

Custom fields are `user_id`-scoped, displayed in the Contact Detail panel.

| Field Name           | Type   | Options / Notes                                                                                           |
| -------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| Lead Source          | select | 99acres, MagicBricks, Housing.com, NoBroker, Walk-in, Referral, Meta Ads, Google Ads, Manual Entry, Other |
| Budget Range         | select | Under ₹25L → ₹5Cr+ (human-readable labels; numeric data lives in `lead_details`)                          |
| Property Interest    | select | Apartment, Villa, Plot, Commercial, Row House, Penthouse                                                  |
| Possession Timeline  | select | Immediate → 2+ years                                                                                      |
| Loan Pre-approval    | select | Not Applied, Applied, Pre-approved, Sanctioned, Not Required                                              |
| Last Site Visit Date | text   | Free-text date string (e.g. "07 Oct 2026")                                                                |
| Follow-up Priority   | select | High, Medium, Low, On Hold                                                                                |
| Alternate Contact    | text   | Secondary phone or email                                                                                  |

> These fields complement `lead_details` (structured qualification data) with
> CRM workflow state. `lead_details.budget_min/max` holds the precise numeric
> values; "Budget Range" is a human-readable label for quick scanning.

---

### F. Quick Replies (Inbox Canned Responses)

**Migration:** `126_re_onboarding_presets.sql` | **Status:** ✅ Live

Quick replies are `account_id`-scoped and visible to all team members.

| Title                        | When to Use                                  |
| ---------------------------- | -------------------------------------------- |
| 👋 Welcome – intro           | First response to a new inbound lead         |
| 📅 Schedule Site Visit       | Proposing a site visit to an interested lead |
| ✅ Site Visit Confirmed      | Confirming a booked site visit               |
| 🔁 Post-Visit Follow-up      | Following up after a completed visit         |
| 💰 Negotiate / Best Price    | Handling budget negotiation                  |
| 📋 Document Checklist        | Sending booking document requirements        |
| 🏦 Home Loan Assistance      | Referring to loan advisor                    |
| 💤 Keep in Touch (Not Ready) | Nurturing a not-yet-ready lead               |
| 🔄 Reschedule Site Visit     | Re-engaging a no-show lead                   |
| ⚖️ RERA & Legal Info         | Answering legal/RERA queries                 |

---

### G. Broadcast Templates (Global Read-only Library)

**Migration:** `117_re_broadcast_templates.sql` | **Status:** ✅ Live

Stored in `broadcast_templates` (global, no `account_id`, readable by all accounts).

| Template Name         | Category  | Language |
| --------------------- | --------- | -------- |
| Diwali Offer 🪔       | Marketing | en_US    |
| New Project Launch 🏠 | Marketing | en_US    |
| Price Drop Alert 📉   | Marketing | en_US    |

> These are **library templates**, not WhatsApp-approved Meta templates.
> Agents select these as a starting point when creating a broadcast; they must
> still submit them through the WhatsApp template approval workflow.

---

## Integrations Reference (Not Yet Auto-configured)

Inspired by the Zakell.com Integrations screenshot, the following portals are
**identified targets** for `portal_connections` (already in `accounts.portal_connections JSONB`
from migration 120). They must be connected manually by the account owner.

| Portal                        | Status          | Connection Method                                         |
| ----------------------------- | --------------- | --------------------------------------------------------- |
| 99acres                       | 🔧 Manual       | CC lead notification email to `leads.{account}@wacrm.app` |
| MagicBricks                   | 🔧 Manual       | CC lead notification email                                |
| Housing.com                   | 🔧 Manual       | CC lead notification email                                |
| NoBroker                      | 🔧 Manual       | CC lead notification email                                |
| Gmail                         | 🔧 Manual       | OAuth (planned)                                           |
| WhatsApp Business             | ✅ Core Feature | Meta WABA connection in Settings                          |
| Meta Ads (Facebook/Instagram) | 🚧 Planned      | Meta Lead Ads webhook                                     |
| Google Ads                    | 🚧 Planned      | Google Lead Form webhook                                  |
| Instagram                     | 🚧 Planned      | Meta Graph API                                            |

> Do not attempt to auto-connect portals in the `handle_new_user` trigger —
> these require the user's own portal credentials. The source tags (Section D)
> are the current lightweight substitute: agents manually tag leads by source.

---

## Lead Routing Rules (Not Yet Seeded)

**Migration:** `113_lead_routing_rules.sql` | **Status:** 🚧 Planned Preset

The `lead_routing_rules` table exists but no default rules are seeded at signup.

**Proposed default rules for a future migration (`127`):**

| Priority | Condition                       | Action                  | Rationale                            |
| -------- | ------------------------------- | ----------------------- | ------------------------------------ |
| 10       | `source = 'Walk-in'`            | `assign_to_role: admin` | Walk-ins need senior agent attention |
| 20       | `budget_gte = 10000000` (₹1Cr+) | `assign_to_role: admin` | High-value leads → senior agent      |
| 30       | `configuration = '3bhk_plus'`   | `assign_to_role: agent` | Standard round-robin                 |

> Deferred to a future migration so the rule engine can be validated first.

---

## Change Log

| Migration                         | Date       | What was added                                                                                     |
| --------------------------------- | ---------- | -------------------------------------------------------------------------------------------------- |
| `100_real_estate_schema.sql`      | —          | Initial RE pipeline + stages seeded at signup                                                      |
| `103_seed_qualification_flow.sql` | —          | Default qualification flow added to signup trigger                                                 |
| `105_lead_source.sql`             | —          | `lead_details.source` column added                                                                 |
| `115_india_localization.sql`      | —          | Site-visit automations, INR currency, SLA escalations added to signup trigger                      |
| `117_re_broadcast_templates.sql`  | —          | Global broadcast template library created                                                          |
| `118_re_qualifier_flow.sql`       | —          | Qualifier flow improved (BHK + location nodes) + backfilled to existing accounts                   |
| `123_fix_handle_new_user.sql`     | —          | Trigger restored after Supabase Studio overwrite                                                   |
| `126_re_onboarding_presets.sql`   | 2026-10-07 | Tags (17), Custom Fields (8), Quick Replies (10) seeded at signup + backfill for existing accounts |

---

## Adding New Presets — Checklist

When adding a new preset to the onboarding flow:

- [ ] Create a new migration file (`127_description.sql`) — never edit existing files
- [ ] Add the preset to `seed_re_presets_for_account()` **or** update `handle_new_user()` if it needs a new variable
- [ ] Include a `DO $$ ... $$` backfill block for existing accounts with a guard to prevent double-seeding
- [ ] Update this document's registry and change log
- [ ] Update `docs/agent/SCHEMA_REFERENCE.md` if any new table/column was created
- [ ] Run `npm run typecheck && npm run lint && npm run format:check && npm run test`
- [ ] Apply locally with `supabase db reset --local --no-seed` and verify in the UI
