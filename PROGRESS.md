# Progress

Checked off by the agent as each `IMPLEMENTATION_PLAN.md` section merges. One line per section, PR link added on completion.

**Revised execution order (updated 2026-09-27, includes new pending tasks):**

```
D6 → (C6 + J3) → S → R → (J4 + J5 + J6) → T → U → L → O → P → Q → V → N
```

| Step | Tasks            | Why in this position                                                                                                                                                    |
| ---- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **D6**           | Adds `lead_details.source` — unblocks source badges (C2/C4), routing rules (S3), email parser (M). Must be first.                                                       |
| 2    | **C6 + J3**      | Pure code changes — no migrations. C6 adds pipeline deal-move guard; J3 adds broadcast admin gate. No dependency on each other, can be one or two PRs.                  |
| 3    | **S**            | Lead distribution: fixes round-robin, adds agent availability (112), routing rules (113), stale-lead cron (114). Needs D6 for source-based routing.                     |
| 4    | **R**            | India localization: INR formatting, BHK/RERA fields (110), Hinglish templates (111). Needs D6 (`lead_details` to extend). Must run before O/P/Q so they inherit fields. |
| 5    | **J4 + J5 + J6** | Broadcast segment targeting (needs R2 BHK columns); RE templates (needs R RERA variables); Qualifier Flow (needs S1 round-robin fix + R's `parse-budget.ts`).           |
| 6    | **T**            | Manager Command Center: uses S's availability + stale counts + routing; adds `agent_targets` (115).                                                                     |
| 7    | **U**            | Team Onboarding: CSV import uses R2's BHK fields + budget parser; role-aware nav uses S's availability.                                                                 |
| 8    | **L**            | Billing: seat limits inform team setup (U); complex Stripe integration best isolated after core team features land.                                                     |
| 9    | **O**            | Integrations page: picks up NoBroker tile from R8.                                                                                                                      |
| 10   | **P**            | Tasks & follow-ups: S4 stale-lead cron has a `TODO(SectionP)` stub waiting for this.                                                                                    |
| 11   | **Q**            | Cost Sheet: picks up RERA/BHK/builder template placeholders from R5.                                                                                                    |
| 12   | **V**            | Reporting & exports: uses T's team dashboard data + L's subscription filter.                                                                                            |
| 13   | **N**            | Final QA gate — re-run Lighthouse + full test suite.                                                                                                                    |

- [x] Section A — Repo Reconnaissance & Environment (Completed via direct push df15010 / 751a4e4)
- [x] Section B — Design Tokens & Mobile Shell Foundation
- [x] Section C — Core Screens: Mobile-Responsive Pass (C1–C6 done)
- [x] Section D — Real Estate Data Model Extensions (D1–D6 done)
- [x] Section E — Site Visits: UI + No-Show Automation
- [x] Section F — Response SLA & Lead Ownership Visibility
- [x] Section G — Team / Manager Dashboard (basic version; T supersedes)
- [x] Section H — Properties & Lead Matching
- [x] Section I — Onboarding Wizard & Real Estate Template (individual; U adds team setup)
- [x] Section J — Automations, Flows & Broadcasts (J1–J6 done)
- [x] Section K — PWA & Native-Feel Polish
- [ ] Section L — Billing & Plan Gating
- [x] Section M — Portal Lead Capture (Email Parser)
- [x] Section N — QA, Performance & Launch Readiness (re-run after every 2 new sections)
- [ ] Section O — Integrations Page UI (run after R so NoBroker tile is ready)
- [ ] Section P — Tasks & Follow-ups
- [ ] Section Q — Cost Sheet (run after R so RERA fields available in template)
- [x] Section R — India Localization & Compliance ← **run before O/P/Q**
- [x] Section S — Lead Distribution & Team Workflows
- [x] Section T — Manager Command Center (upgrades Section G)
- [x] Section U — Business Team Onboarding (supplements Section I)
- [ ] Section V — Reporting & Exports
- [x] Section D6 — Lead source column (105_lead_source.sql)
