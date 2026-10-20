# WaCRM Multi-Agent WhatsApp Workflow Testing Plan

> **Target:** Multi-Agent Real Estate WhatsApp Workflow in WaCRM  
> **Architecture:** One Official WhatsApp Business Number (Meta Cloud API) shared across multiple agents (`owner`, `admin`, `agent`, `viewer`).  
> **Environment:** Local Next.js 16 (`http://localhost:3000`), Supabase Remote DB (`eielslitcyiknuupzwcf`), Ngrok tunnel (`https://rebel-tipping-prenatal.ngrok-free.dev`).  
> **Verification Tools:** Browser UI testing, Terminal/Curl test requests, Supabase MCP / Node Client for live database state inspection.

---

## 1. Test Environment & Credential Baseline

### 1.1 Fresh Multi-Agent Account: **Apex Horizon Realty**

- **Account ID (`accounts.id`):** `09e60b2d-7c0f-4242-aa74-c4becda130da`
- **Default Currency:** `INR` (₹)
- **All Logins Password:** `Test@1234`

| Role        | Member Name    | Login Email            | User ID (`auth.users.id`)              | Profile ID (`profiles.id`)             | Availability       | Operational Purpose                              |
| :---------- | :------------- | :--------------------- | :------------------------------------- | :------------------------------------- | :----------------- | :----------------------------------------------- |
| **Owner**   | Arjun Malhotra | `owner@apexrealty.in`  | `8acedd39-3e67-4c1c-8a69-4d29fd4d4b4a` | `fc50e090-697b-4240-93d6-be4d3e8f5def` | `true`             | Full tenant owner, connects WhatsApp, billing    |
| **Admin**   | Neha Sharma    | `admin@apexrealty.in`  | `b60f77d9-b4b6-4534-a80b-81f0b9fe0894` | `86018075-24f3-46a4-b4ec-77e6d660f4d9` | `true`             | Sales manager, routing rules, bulk reassignments |
| **Agent 1** | Vikram Singh   | `agent1@apexrealty.in` | `d202706c-cd48-4647-afc8-ea13c680586d` | `549c9c94-e01a-4a78-bdc2-c5ef751b3a54` | `true` (Active)    | Primary sales agent (round-robin target)         |
| **Agent 2** | Ananya Roy     | `agent2@apexrealty.in` | `ca26e9b1-f978-4621-8203-7ace9dbeb2af` | `08f26eb7-8adf-437e-9361-886ef1d0288f` | `true` (Active)    | Secondary sales agent (round-robin target)       |
| **Agent 3** | Karan Verma    | `agent3@apexrealty.in` | `a5de3658-0818-466e-92dd-561a73321769` | `5ffb0727-8c63-4d5a-b657-0163f0f4a1e7` | `false` (On Leave) | Agent on leave (tests availability skipping)     |
| **Viewer**  | Pooja Iyer     | `viewer@apexrealty.in` | `df9a8428-9528-4f54-8d32-f9e22821c5a1` | `33197f15-a713-4826-801b-0c0ac16e99fb` | `false`            | Read-only trainee/auditor (RBAC gating)          |

---

### 1.2 Official WhatsApp Business Channel (Meta Cloud API)

Credentials populated from `whatsapp_credentials.md` and encrypted in `whatsapp_config`:

| Parameter                | Value                                                                | Notes                                      |
| :----------------------- | :------------------------------------------------------------------- | :----------------------------------------- |
| **Phone Number ID**      | `939656362572111`                                                    | Official WhatsApp Business Phone Number ID |
| **WABA ID**              | `2111247669610431`                                                   | WhatsApp Business Account ID               |
| **Test Recipient Phone** | `+1 (555) 171-8060`                                                  | Meta developer test recipient number       |
| **Webhook Verify Token** | `wacrm`                                                              | Stored encrypted in `whatsapp_config`      |
| **Public Webhook URL**   | `https://rebel-tipping-prenatal.ngrok-free.dev/api/whatsapp/webhook` | Verified HTTP 200 via ngrok tunnel         |
| **Local Webhook URL**    | `http://localhost:3000/api/whatsapp/webhook`                         | Verified HTTP 200 locally                  |

---

### 1.3 Seeded Real Estate Inventory & Pipeline Baseline

- **Pipeline:** `Real Estate` (5 stages: `New`, `Contacted`, `Site Visit`, `Negotiation`, `Closed`)
- **Properties Seeded:**
  1. `Apex Grandeur — 3BHK Lake View` (Powai, ₹1.65 Cr, 3BHK, 1500 sqft, Ready to Move, RERA: `P51800028911`)
  2. `Apex Grandeur — 2BHK City View` (Powai, ₹1.10 Cr, 2BHK, 1050 sqft, Ready to Move, RERA: `P51800028911`)
  3. `Horizon Bay Towers — 4BHK Seafront` (Worli, ₹4.50 Cr, 4BHK, 2900 sqft, Under Construction, RERA: `P51900034120`)
  4. `Emerald Luxury Villa — 4BHK` (Thane West, ₹2.25 Cr, Villa, 3400 sqft, Ready to Move, RERA: `P51700019876`)
- **Lead Routing Rules:**
  - Priority 1: Budget >= ₹2.00 Cr (`20000000`) → Role `admin`
  - Priority 2: Configuration is `3BHK` → Role `agent`
- **Initial Contacts & Leads Seeded:**
  - Lead 1: `Rohan Mehra` (`+919876543201`) → Assigned to `Vikram Singh` (`agent1`)
  - Lead 2: `Sunita Deshmukh` (`+919876543202`) → Assigned to `Ananya Roy` (`agent2`)
  - Lead 3: `Kunal Shah` (`+919876543203`) → **Unassigned Pool** (`assigned_agent_id = null`)
  - Lead 4: `WhatsApp Meta Tester` (`+1 (555) 171-8060`) → Test recipient contact

---

## 2. Phase-Wise Test Matrix

### Phase 1: Meta WhatsApp Channel Configuration & Health Check

Verify that the business WhatsApp number is connected, credentials are encrypted, and webhooks are verified.

- **TC-MAW-01: WhatsApp Configuration in Settings (`/settings?tab=whatsapp`)**
  - **Actor:** `owner` (`owner@apexrealty.in` / `Test@1234`)
  - **Steps:**
    1. Navigate to `http://localhost:3000/settings` and select the **WhatsApp** tab.
    2. Verify input fields exist: Phone Number ID (`939656362572111`), WABA ID (`2111247669610431`), Permanent Access Token (masked `••••••••`), Webhook Verify Token.
    3. Ensure connection status shows `connected` with a green indicator.
    4. Click "Test Connection" button.
  - **Expected:** Success toast "Connection verified with Meta API", green status indicator.
  - **DB Check (Supabase MCP):**
    ```sql
    SELECT id, account_id, phone_number_id, waba_id, status, connected_at, mirror_inbound_media
    FROM whatsapp_config WHERE account_id = '09e60b2d-7c0f-4242-aa74-c4becda130da';
    ```

- **TC-MAW-02: Webhook Verification Challenge (GET `/api/whatsapp/webhook`)**
  - **Actor:** Automated / Meta Webhook
  - **Steps:**
    1. Send a GET request simulating Meta's verification handshake:
       ```bash
       curl -s -i "http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wacrm&hub.challenge=test_challenge_9999"
       ```
    2. Test through public ngrok tunnel:
       ```bash
       curl -s -i "https://rebel-tipping-prenatal.ngrok-free.dev/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wacrm&hub.challenge=meta_challenge_live"
       ```
  - **Expected:** HTTP 200 with response body exactly matching the challenge text.
  - **Negative Test:** Send `hub.verify_token=wrong_token` → expect HTTP 403 Forbidden (`Verification token mismatch`).

- **TC-MAW-03: Inbound Media Mirror Toggle & Storage**
  - **Actor:** `owner`
  - **Steps:**
    1. In `/settings?tab=whatsapp`, locate the "Mirror Inbound Media to CRM Storage" switch.
    2. Toggle switch ON/OFF.
  - **Expected:** Toast confirmation, DB updates column `mirror_inbound_media` in `whatsapp_config` without requiring access token re-entry.

---

### Phase 2: Multi-Role Team Onboarding & RBAC Boundary Testing

Verify role permissions, invitation flows, and access constraints across roles.

- **TC-MAW-04: Team Invitation Flow (`/settings?tab=team` & `/team`)**
  - **Actor:** `owner` (`owner@apexrealty.in`) or `admin` (`admin@apexrealty.in`)
  - **Steps:**
    1. Open Settings → Team Members (or Invite dialog).
    2. Invite a new agent: `newagent@apexrealty.in` with role `agent`.
    3. Verify invitation record in `account_invitations` table.
  - **Expected:** Invite link generated, member shown as "Pending Invite".
  - **DB Check:**
    ```sql
    SELECT * FROM account_invitations WHERE account_id = '09e60b2d-7c0f-4242-aa74-c4becda130da';
    ```

- **TC-MAW-05: RBAC Route & Action Gating**
  - **Actors:** `agent1` (`agent1@apexrealty.in`) and `viewer` (`viewer@apexrealty.in`)
  - **Steps:**
    1. Log in as `agent1`. Navigate to `/team`. Expect redirect to `/dashboard` (admin-only).
    2. Try to access `/settings?tab=whatsapp`. Expect read-only view or restricted settings warning.
    3. Log in as `viewer`. Navigate to `/inbox`.
    4. Open any chat. Verify composer inputs are disabled / read-only with a tooltip "You have view-only access".
  - **Expected:** Strict role enforcement per `src/lib/auth/roles.ts`.

---

### Phase 3: Inbound Lead Arrival, Lead Routing & Assignment Audit

Verify automated routing, agent availability skipping, and audit trail logging.

- **TC-MAW-06: Inbound WhatsApp Message Handshake & Contact Auto-Creation**
  - **Actor:** External lead sending WhatsApp message to the business number
  - **Steps:**
    1. Post a simulated Meta inbound webhook payload to `/api/whatsapp/webhook` with phone `+919876500099` and message `"Hello, I am looking for a 3BHK in Powai under 1.8 Cr"`.
    2. Verify HTTP 200 response.
  - **Expected:**
    - A new contact row created in `contacts` table with phone `+919876500099`.
    - A new conversation created in `conversations` with `status = 'open'`.
    - Inbound message inserted in `messages` with `sender_type = 'customer'`.
  - **DB Check (Supabase MCP):**
    ```sql
    SELECT c.id, c.name, c.phone, conv.id as conv_id, conv.assigned_agent_id, conv.status
    FROM contacts c
    JOIN conversations conv ON conv.contact_id = c.id
    WHERE c.phone = '+919876500099';
    ```

- **TC-MAW-07: Round-Robin Auto-Routing & Workload Balancing**
  - **Pre-condition:** `Vikram Singh` (`agent1`) has 1 open conversation; `Ananya Roy` (`agent2`) has 0 open conversations. Both are `is_available = true`.
  - **Steps:**
    1. Trigger new lead arrival via webhook or rule trigger.
  - **Expected:** The lead is auto-assigned to `Ananya Roy` (lowest open conversation workload).
  - **Verification:** Check `conversations.assigned_agent_id` equals Ananya's user ID (`ca26e9b1-f978-4621-8203-7ace9dbeb2af`).

- **TC-MAW-08: Availability Awareness: Skipping Agents "On Leave"**
  - **Pre-condition:** `Karan Verma` (`agent3`) is marked on-leave / unavailable (`is_available = false` in `profiles`).
  - **Steps:**
    1. Trigger routing for multiple incoming leads.
  - **Expected:** Routing skips Karan Verma completely and distributes strictly between Vikram Singh and Ananya Roy.
  - **DB Check:**
    ```sql
    SELECT user_id, full_name, is_available FROM profiles WHERE account_id = '09e60b2d-7c0f-4242-aa74-c4becda130da';
    ```

- **TC-MAW-09: Unassigned Pool & Admin Alert When All Agents Unavailable**
  - **Pre-condition:** Set all agents (`Vikram`, `Ananya`, `Karan`) to `is_available = false`.
  - **Steps:**
    1. Trigger an incoming lead webhook.
  - **Expected:**
    - Lead `conversations.assigned_agent_id` remains `NULL`.
    - Lead appears in the **Unassigned Pool** on the Manager Dashboard (`/team`).
    - Admin notification is inserted into `notifications` table ("All agents are unavailable. A new lead needs assignment.").
  - **UI Check:** Open `/team` as admin (`admin@apexrealty.in`), verify Unassigned Pool banner displays the new lead with an "Assign" button.

- **TC-MAW-10: Assignment Audit Trail (`assignment_history`)**
  - **Actor:** `admin` or `agent` claiming or reassigning a lead
  - **Steps:**
    1. Claim or reassign lead `Kunal Shah` from Unassigned Pool to `Vikram Singh`.
    2. Alternatively, reassign from `Vikram Singh` to `Ananya Roy` via `/contacts` bulk reassign.
  - **Expected:** An immutable row inserted into `assignment_history` documenting `from_agent_id`, `to_agent_id`, `actor_id`, and `reason`.
  - **DB Check (Supabase MCP):**
    ```sql
    SELECT * FROM assignment_history WHERE account_id = '09e60b2d-7c0f-4242-aa74-c4becda130da' ORDER BY created_at DESC LIMIT 5;
    ```

---

### Phase 4: Shared Inbox (`/inbox`) & Real-Time Multi-Agent Collaboration

Verify agent filtered views, live streaming updates, and desktop alerts.

- **TC-MAW-11: Inbox Filtered Views Audit ("Mine", "Unassigned", "All")**
  - **Actor:** Agent `Vikram Singh` logged into `/inbox`
  - **UI Audit & Functionality:**
    1. Check if the conversation list provides distinct tabs or dropdown options:
       - **Mine:** Filters conversations where `assigned_agent_id === currentUser.id`.
       - **Unassigned:** Filters conversations where `assigned_agent_id === null`.
       - **All / Team View:** Shows all account conversations (accessible to admin/owner).
    2. If any view is missing or hidden under dropdowns, record the UX gap.
  - **Expected:** Agent can isolate their assigned workload in 1 click to stay focused.

- **TC-MAW-12: Real-Time Inbound Message Sync via Supabase Realtime**
  - **Setup:** Open `/inbox` in Browser Window A logged in as Agent `Vikram Singh`.
  - **Steps:**
    1. In Terminal/Curl, simulate an inbound message from customer `+919876543201`: `"Are you available for a site visit tomorrow at 3 PM?"`.
    2. Observe Window A without refreshing the browser.
  - **Expected:**
    - Conversation jumps to the top of the conversation list.
    - Unread count badge increments.
    - Message thread updates immediately with the incoming text bubble.
    - Browser/Desktop notification sound/alert triggers.

- **TC-MAW-13: Agent-to-Agent Live Attribution & Message Dispatch**
  - **Actor:** Agent `Vikram Singh`
  - **Steps:**
    1. Type reply: `"Yes, I can arrange a site visit for Apex Grandeur at 3 PM."` and click Send.
  - **Expected:**
    - Outbound message sent via `/api/whatsapp/send`.
    - Message bubble renders on the right with a single checkmark (sent).
    - Status updates to double checkmarks (delivered/read) when status webhooks arrive.
    - Internal metadata tracks that `Vikram Singh` authored the message.

---

### Phase 5: 24-Hour Meta Service Window & Template Enforcement

Verify Meta anti-spam compliance rules inside WaCRM.

- **TC-MAW-14: Active 24-Hour Window Free-Form Messaging & Media**
  - **Pre-condition:** Customer messaged 1 hour ago (`< 24h`).
  - **Steps:**
    1. Verify session indicator shows green: `"23h remaining"`.
    2. Send free-form text message.
    3. Attach and send a PDF brochure or JPG floor plan (<= 16MB).
    4. Send a Quick Reply from the quick reply picker.
  - **Expected:** All outbound messages dispatch successfully without requiring templates.

- **TC-MAW-15: Expired 24-Hour Window & Template Fallback**
  - **Pre-condition:** Customer's last inbound message was 26 hours ago (or simulate by updating `messages.created_at` in DB).
  - **Steps:**
    1. Open conversation in `/inbox`.
    2. Observe session banner: red badge `"Session Expired"`.
    3. Verify message composer input is disabled with placeholder `"24h window closed. Send a template to re-engage."`.
    4. Click the "Templates" button.
    5. Select an approved template (e.g., `site_visit_followup`), fill parameter `{{name}} = "Rohan"`, and send.
  - **Expected:**
    - Free-form text blocked.
    - Template dispatches successfully to Meta.
    - Once customer replies to the template, the 24-hour window re-opens immediately.
  - **DB Check:**
    ```sql
    SELECT id, message_type, template_name, status, created_at
    FROM messages WHERE conversation_id = '...' ORDER BY created_at DESC LIMIT 3;
    ```

---

### Phase 6: In-Chat Real Estate Actions & Component Interconnections

Verify right-hand panel workflows without navigating away from the chat.

- **TC-MAW-16: Lead Qualification Panel in Chat (`ContactSidebar`)**
  - **Actor:** Agent `Vikram Singh` in `/inbox`
  - **Steps:**
    1. View the right-hand panel for active contact `Rohan Mehra`.
    2. Audit whether the agent can view and edit:
       - Budget Min / Max (₹ INR)
       - BHK Configuration preference (`2BHK`, `3BHK`, etc.)
       - Location preference (e.g., `"Powai, Mumbai"`)
       - Possession status preference (`Ready to Move` vs `Under Construction`)
    3. Update budget to `₹1.8 Cr` and click Save.
  - **Expected:** Data persisted in `lead_details` table, UI updates immediately.

- **TC-MAW-17: One-Click Send Cost Sheet via WhatsApp**
  - **Actor:** Agent in `/inbox`
  - **Steps:**
    1. Check for "Send Cost Sheet" action button in the chat view or sidebar.
    2. Trigger `CostSheetModal` for property `"Apex Grandeur — 3BHK"`.
    3. Confirm breakdown: Base Price, Floor Rise, Car Parking, GST (5%), Stamp Duty & Registration.
    4. Click "Send via WhatsApp".
  - **Expected:** Formatted Cost Sheet message / PDF dispatched to customer's WhatsApp chat.

- **TC-MAW-18: Schedule Site Visit from Chat & Sync to Calendar**
  - **Actor:** Agent in `/inbox`
  - **Steps:**
    1. Click "Schedule Visit" button in `/inbox`.
    2. `ScheduleVisitSheet` opens with `contact_id` pre-filled.
    3. Select property `"Apex Grandeur"`, date/time (tomorrow 3:00 PM), pickup required = `true`, pickup location `"Powai Lake Gate"`.
    4. Save the visit.
  - **Expected:**
    - Row inserted in `site_visits` table with `status = 'pending' | 'confirmed'`.
    - Automated confirmation note logged.
    - Site visit appears on `/site-visits` calendar and dashboard KPI strip.
  - **DB Check (Supabase MCP):**
    ```sql
    SELECT id, contact_id, property_id, scheduled_at, pickup_required, pickup_location, status
    FROM site_visits WHERE account_id = '09e60b2d-7c0f-4242-aa74-c4becda130da' ORDER BY created_at DESC LIMIT 1;
    ```

- **TC-MAW-19: Internal Notes & Tags (Invisible to Customer)**
  - **Actor:** Agent in `/inbox`
  - **Steps:**
    1. In the sidebar, add tag `hot-lead` and `investor`.
    2. Write an internal note: `"Client has approved bank loan from HDFC. Ready for token payment after visit."`.
  - **Expected:**
    - Note saved to `contact_notes`.
    - Tags saved to `contact_tags`.
    - Customer never receives these notes on WhatsApp.

---

### Phase 7: Manager & Business Owner Command Center (`/team` & `/contacts`)

Verify SLA response tracking, team performance metrics, and 1-click bulk reassignments.

- **TC-MAW-20: First-Response SLA Badging & Alerts**
  - **Steps:**
    1. Ingest a new inbound lead message.
    2. Observe SLA badge in `/contacts` and `/inbox`:
       - `< 15 min`: Green badge (`<15m`)
       - `15m - 60m`: Amber warning badge
       - `> 60m`: Red breach badge (`Breached SLA`)
    3. As soon as the assigned agent sends an outbound reply, SLA timer stops and `first_response_time` is recorded.
  - **Expected:** Unanswered inquiries visually alert managers.

- **TC-MAW-21: Team Dashboard Metrics Audit (`/team`)**
  - **Actor:** `admin` (`admin@apexrealty.in`) or `owner` (`owner@apexrealty.in`)
  - **Verify KPI Cards & Table:**
    - Total Agents, Available vs On-Leave counts.
    - Open Leads per agent with capacity progress bar.
    - Visits Target Attainment (% of monthly target achieved).
    - Average Response Time (minutes) per agent.
    - Completed vs No-Show Visit conversion rate.
  - **Actions:** Click "Set Target" to update agent monthly visits quota.

- **TC-MAW-22: 1-Click Bulk Reassignment (`/contacts`)**
  - **Scenario:** Agent `Vikram Singh` goes on sudden leave; open conversations must be transferred to `Ananya Roy`.
  - **Steps:**
    1. Open `/contacts`. Filter by Assignee: `Vikram Singh`.
    2. Select multiple contacts (or "Select All").
    3. Click "Bulk Actions" → "Reassign Leads".
    4. Choose target agent: `Ananya Roy`.
    5. Confirm reassignment.
  - **Expected:**
    - Batch update runs via `POST /api/contacts/bulk`.
    - All conversations update `assigned_agent_id = Ananya's user ID`.
    - Immutable audit entries logged in `assignment_history` for each contact.
    - Ananya's `/inbox` immediately displays the transferred conversations.

---

### Phase 8: Edge Cases, Security & Isolation Verification

Verify resilience under concurrent actions, network dropouts, and multi-tenant isolation.

- **TC-MAW-23: Multi-Tenant RLS Leakage Test**
  - **Actor:** User from Skyline Realty (`46a92878-11b4-44ff-a137-77c59a7c6b8d`)
  - **Steps:** Attempt to query Apex Horizon Realty's conversations or messages using Supabase client.
  - **Expected:** Supabase Postgres RLS policy `is_account_member(account_id)` returns 0 rows. Zero data leakage across tenants.

- **TC-MAW-24: Idempotent Webhook Replay & Duplicate Prevention**
  - **Steps:** Send the exact same Meta webhook payload with the same `message.id` twice within 10 seconds.
  - **Expected:** First call inserts the message; second call detects duplicate `message.id` and gracefully responds HTTP 200 without creating duplicate bubbles or double-bumping unread counts.

- **TC-MAW-25: Re-opening Closed Conversations on Inbound Reply**
  - **Pre-condition:** Conversation marked as `closed`.
  - **Steps:** Customer sends a new WhatsApp message.
  - **Expected:** Conversation status automatically transitions from `closed` to `open` (issue #409 fix).

---

### Phase 9: Deals & Real Estate Pipelines Workflow (`/pipelines`)

Verify Kanban stage movement, anti-poaching deal move permissions, Won/Lost lifecycle, structured lost reasons, brokerage commission calculation, and cross-module quick actions.

- **TC-MAW-26: Deals Pipeline Loading & Situational Awareness KPI Strip (`/pipelines`)**
  - **Actor:** `admin` (`admin@apexrealty.in`) or `agent1` (`agent1@apexrealty.in`)
  - **Steps:**
    1. Navigate to `http://localhost:3000/pipelines`.
    2. Verify Situational Awareness KPI Strip at top:
       - **Active Deals:** total open deals count.
       - **Pipeline Value:** total INR volume in ₹ L / ₹ Cr (e.g., `₹6.70 Cr`).
       - **Average Deal Size:** average deal value in ₹ INR.
       - **Stage-Weighted Win Forecast:** probability-weighted value across pipeline stages.
       - **Monthly Closures & Win Conversion Rate (%):** won deals count and percentage.
    3. Click on the "Won" or "Lost" metric cards: verify 1-click filter switches the board/table view to won or lost deals.
  - **Expected:** All KPI numbers match live DB aggregates; 1-click metric filtering updates the view immediately.

- **TC-MAW-27: Kanban Board Drag-and-Drop & Stage Progression**
  - **Actor:** `agent1` (`Vikram Singh`)
  - **Steps:**
    1. Find deal `Rohan Mehra` (assigned to Vikram) in `New` stage column.
    2. Drag the card to `Contacted` stage column.
    3. Check `deals.stage_id` and `deals.last_activity_at` in DB.
  - **Expected:** Card moves smoothly with optimistic update; DB records new `stage_id` and updates `last_activity_at` to current timestamp.

- **TC-MAW-28: Multi-Agent Deal Move Permissions & Anti-Poaching Guard**
  - **Actor:** `agent2` (`Ananya Roy` - `ca26e9b1-f978-4621-8203-7ace9dbeb2af`)
  - **Steps:**
    1. Log in as `agent2`. Navigate to `/pipelines`.
    2. Attempt to drag deal `Rohan Mehra` (assigned to `Vikram Singh`) to another stage.
    3. Alternatively, click the "Move Stage" button on Vikram's deal card and select a stage.
  - **Expected:**
    - API returns HTTP 403 with `{ error: 'DEAL_NOT_YOURS', message: 'You can only move your own deals. Ask your admin to reassign it first.' }`.
    - The card snaps back to its original stage column.
    - Toast error: `"This lead belongs to Vikram Singh. Contact your admin to move it."`.
  - **Negative Test (Direct API Deal Reassignment):**
    - Agent sends `PATCH /api/deals/[id]` with `{ assigned_to: "other_agent_profile_id" }`.
    - Server verifies `!canManageMembers(ctx.role)` and blocks with HTTP 403 `CANNOT_REASSIGN_DEAL`.
  - **Admin Test:**
    - Log in as `admin` (`Neha Sharma`). Move or reassign any deal.
    - Expect success (admins and owners bypass deal ownership restriction).

- **TC-MAW-29: Deal Won / Lost Lifecycle, Lost Reason Modal & Frozen Timestamps**
  - **Actor:** Agent or Admin
  - **Mark as Won:**
    1. Open deal form for `Rohan Mehra`. Click "Mark as Won".
    2. Deal status transitions to `won`, `closed_at` is frozen to current timestamp.
    3. A 6-second undo toast appears ("Deal marked as won").
  - **Mark as Lost:**
    1. On deal `Kunal Shah`, click "Mark as Lost".
    2. `LostReasonModal` opens requiring selection of a structured reason from `lost_reasons` table (e.g., "Price too high", "Bought from competitor", "Budget mismatch").
    3. Enter optional internal note and select optional re-engagement date (`re_engage_on`).
    4. Confirm loss.
  - **Expected:**
    - Deal status updates to `lost`.
    - Server automatically captures `lost_from_stage_id` from the deal's current stage.
    - `closed_at` is frozen, `lost_reason_id` and `lost_note` are persisted.
  - **Reopen Deal:**
    1. Open the lost deal and click "Reopen Deal".
    2. Verify `status` returns to `open`, `closed_at`, `lost_reason_id`, and `lost_note` are cleared, and `reopened_count` increments by 1.

- **TC-MAW-30: High-Density Table View & Cross-Module Quick Actions**
  - **Actor:** Agent or Manager in `/pipelines`
  - **Steps:**
    1. Toggle view mode switcher from **Kanban** to **Table**.
    2. Audit columns: Deal Title, Contact / Buyer, Stage, Value & Brokerage (`≈ ₹X @ Y%`), Expected Close (with red overdue indicator if past date), Assignee, Actions.
    3. Click WhatsApp action button: deep-links directly into `/inbox?contactId=<contact_id>`.
    4. Click Call action button: opens `tel:<phone>`.
    5. Click "Schedule Visit" icon: opens `ScheduleVisitSheet` prefilled with the deal's contact.
  - **Expected:** Table renders high-density layout with no horizontal overflow; quick actions interconnect cleanly without manual copy-pasting.

---

### Phase 10: Property Inventory & WhatsApp Brochure Sharing (`/properties`)

Verify listings repository, Indian real estate specs, RERA compliance badges, role gating (Migration 130), 1-click WhatsApp brochure sharing, and the interactive EMI calculator.

- **TC-MAW-31: Inventory Management & RERA Compliance Badging**
  - **Actor:** Any authenticated role
  - **Steps:**
    1. Navigate to `http://localhost:3000/properties`.
    2. Verify inventory KPI stat cards: Total Units, Ready to Move, Under Construction, Portfolio Value (in ₹ Cr).
    3. Verify RERA compliance badges on property cards/table:
       - Properties with valid RERA ID (e.g. `P51800028911`) display green badge: `RERA: P51800028911`.
       - Properties without RERA ID display amber warning badge: `RERA ID missing — required under RERA Act 2016`.
    4. Check Indian real estate attributes: BHK Configuration (1BHK-4BHK, Villa, etc.), Carpet Area in sq ft, Facing Direction (e.g. `East Facing`), Possession Status (`Ready to Move` vs `Under Construction` with year).
  - **Expected:** High visual density, complete Indian real estate specs, and RERA Act 2016 legal compliance indicators.

- **TC-MAW-32: Role-Based Inventory Access Control (Migration 130)**
  - **Actor 1:** `agent1` (`Vikram Singh` - role `agent`)
    - Navigate to `/properties`.
    - Verify "+ Add Property" button is hidden.
    - Verify property cards/rows do not show Edit or Delete options.
    - Confirm agent has read-only inventory access to view specs and share brochures.
  - **Actor 2:** `admin` (`Neha Sharma` - role `admin`) or `owner` (`Arjun Malhotra`)
    - Verify "+ Add Property" button is visible and active.
    - Click "+ Add Property": `PropertyFormModal` opens with 4-step real estate form (Basic Info, Configuration & Specs, Compliance & Possession, Amenities & Tags).
    - Save a new unit: `"Horizon Bay — 3BHK Penthouse"` at `₹3.20 Cr`.
    - Verify property row is inserted into `properties` table and immediately updates the KPI strip.

- **TC-MAW-33: 1-Click WhatsApp Brochure Sharing & Chat Deep Link**
  - **Actor:** `agent1` or `agent2` in `/properties`
  - **Steps:**
    1. Click "Share on WhatsApp" on `"Apex Grandeur — 3BHK Lake View"`.
    2. `PropertyShareModal` opens displaying a formatted brochure message preview:
       - Emoji-accented title and builder/project name.
       - Price formatted in ₹ INR (`₹1.65 Cr`).
       - Specs breakdown (`3BHK • 1500 sq ft • East Facing`).
       - RERA Registration number (`P51800028911`).
       - Call-to-action prompt for scheduling a site visit.
    3. Click "Copy" button: copies formatted brochure to clipboard with green checkmark feedback.
    4. In the "Quick Send to Contact / Lead" list, search for `Rohan Mehra`:
       - Click **"Chat in CRM"**: deep-links directly to `/inbox?contactId=<rohan_id>` with conversation opened.
       - Click **"Send"**: opens `https://wa.me/919876543201?text=...` in WhatsApp Web / App.
  - **Expected:** Formatted brochure generated dynamically; dual dispatch options (Chat in CRM vs WhatsApp Web) function seamlessly.

- **TC-MAW-34: Interactive Property EMI Calculator**
  - **Actor:** Agent or Buyer Representative
  - **Steps:**
    1. Click on property `"Apex Grandeur — 3BHK Lake View"` to open `/properties/[id]`.
    2. Scroll to the `EmiCalculator` section.
    3. Verify initial values:
       - Loan Amount pre-filled at 80% of property price (`₹1.65 Cr * 0.8 = ₹1.32 Cr`).
       - Tenure default: 20 years.
       - Interest rate default: 8.5% per annum.
    4. Verify calculated monthly EMI in ₹ INR and total interest payable.
    5. Adjust interest rate to 9.0% or tenure to 25 years: verify EMI recalculates instantly in real time.
  - **Expected:** Mathematical calculation matches standard reducing balance formula `P × r × (1+r)^n / ((1+r)^n - 1)`.

- **TC-MAW-35: Cross-Module Site Visit Scheduling from Inventory**
  - **Steps:**
    1. On property `"Horizon Bay Towers — 4BHK"`, click "Schedule Visit".
    2. `ScheduleVisitSheet` opens with `defaultPropertyId` pre-selected and locked to `"Horizon Bay Towers — 4BHK"`.
    3. Select contact `Rohan Mehra`, pick datetime, and click "Confirm Visit".
  - **Expected:** Visit created with property and contact linked without having to manually select the property.

---

### Phase 11: Site Visits Management & Logistics Workflow (`/site-visits`)

Verify visit scheduling, pickup logistics, agent assignments, automated task synchronization, and calendar day groupings.

- **TC-MAW-36: Field Visit Scheduling & Agent Task Synchronization**
  - **Actor:** Agent `Vikram Singh` or Manager `Neha Sharma`
  - **Steps:**
    1. Navigate to `http://localhost:3000/site-visits`. Click "+ Schedule Visit".
    2. Select lead `Rohan Mehra` and property `Apex Grandeur — 3BHK`.
    3. Select Datetime preset (e.g. "Tomorrow 11 AM").
    4. Enable "Pickup Needed?" toggle. Enter pickup location: `"Powai Lake Main Gate, near Hiranandani"`.
    5. Select assigned agent: `Vikram Singh`.
    6. Save visit.
  - **Expected:**
    - Row inserted into `site_visits` table with `pickup_required = true`, `pickup_location`, and `status = 'pending' | 'confirmed'`.
    - A linked task is automatically inserted into `tasks` table with `due_at = scheduled_at` and `assigned_to = Vikram's user_id`.
  - **DB Check (Supabase MCP):**
    ```sql
    SELECT sv.id, sv.contact_id, sv.property_id, sv.scheduled_at, sv.pickup_required, sv.pickup_location, sv.status,
           t.id as task_id, t.title as task_title, t.assigned_to as task_assignee, t.due_at
    FROM site_visits sv
    LEFT JOIN tasks t ON t.site_visit_id = sv.id
    WHERE sv.account_id = '09e60b2d-7c0f-4242-aa74-c4becda130da'
    ORDER BY sv.created_at DESC LIMIT 1;
    ```

- **TC-MAW-37: Day-Grouped Timeline & High-Density Table Views**
  - **Steps:**
    1. In `/site-visits`, observe the timeline view:
       - **Today:** visits scheduled for the current date with high-contrast attention badges.
       - **Upcoming:** visits scheduled for tomorrow or future dates with relative countdown labels ("in 14h", "in 2 days").
       - **Past:** previous visits showing historical show/completion rates.
    2. Toggle view mode to High-Density desktop table.
    3. Verify columns: Datetime, Contact / Buyer, Property & Specs, Pickup Logistics (Car icon + location), Assigned Agent, Status Badge, Quick Actions.
  - **Expected:** Clear temporal segmentation with zero horizontal overflow.

- **TC-MAW-38: Site Visit Status Transitions & Lifecycle**
  - **Steps:**
    1. Click on visit status dropdown: transition from `pending` -> `confirmed`.
    2. After the visit takes place, transition status to `completed`.
    3. Check `site_visits.status = 'completed'`.
    4. Check linked task in `tasks`: verify `done = true` and `done_at` timestamp recorded.
    5. Negative / Recovery Test: Transition another visit to `no_show`.
       - Verify visit marked as `no_show`.
       - Team Dashboard conversion rate reflects the no-show count.
  - **Expected:** Bidirectional sync between visit status, task completion, and manager analytics.

- **TC-MAW-39: Automated Site Visit Reminders & Hinglish Template Selection**
  - **Scenario:** T-24h reminder, T-2h reminder with pickup instructions, and No-show recovery.
  - **Audit:**
    1. When `account.preferred_language === 'hi-en'`, verify `lib/automations/engine.ts` selects Hinglish `[HI]` automation templates:
       - T-24h: `"Namaste {{contact_name}} ji! 🙏 Kal {{visit_time}} baje aapka site visit confirm hai..."`
       - T-2h: `"{{contact_name}} ji, 2 ghante baad aapka site visit hai! Hamara agent aapko {{pickup_location}} se pick karenge..."`
       - No-show: `"{{contact_name}} ji, lagta hai aaj site visit chhoot gayi. Koi baat nahi! Kab convenient rahega..."`
    2. When `pickup_required = true`, pickup location is interpolated into the message body.
  - **Expected:** Automated site-visit communication respects team language preference and includes logistics data.

---

### Phase 12: Visual Qualifier Flows, Automations & RE Broadcast Campaigns (`/flows`, `/automations`, `/broadcasts`)

Verify conversational bot qualification, trigger-action automations, and targeted broadcast campaigns.

- **TC-MAW-40: Visual Conversation Flow Builder (`/flows`)**
  - **Actor:** `admin` or `owner`
  - **Steps:**
    1. Navigate to `http://localhost:3000/flows`.
    2. Verify pre-seeded flow: `"Real Estate Qualifier (Auto)"`.
    3. Click on the flow to open the Flow Editor (`/flows/[id]`).
    4. Audit visual canvas (`@xyflow/react`):
       - Start Trigger node (`new_contact_created`).
       - Welcome & Budget capture node (`parseBudget` handling L/Cr).
       - BHK Configuration preference button node (`1BHK`, `2BHK`, `3BHK`, `4BHK+`).
       - Location preference capture node.
       - Auto-assignment node (`assign_conversation` mode: `round_robin`).
    5. Test dragging, editing node copy, and saving.
  - **Expected:** Clean node canvas renders on desktop (`md`+); nodes interconnect with directed edges.

- **TC-MAW-41: Real Estate Inbound Lead Qualifier Execution**
  - **Scenario:** Customer sends inbound WhatsApp inquiry to the business number.
  - **Execution Path:**
    1. Inbound webhook receives message from new lead `+919876500111`.
    2. Qualifier bot sends welcome message: `"Namaste! What is your budget?"`.
    3. Customer replies: `"1.5 Cr"`.
       - Bot runs `parseBudget("1.5 Cr")` -> writes `15000000` to `lead_details.budget_max`.
    4. Bot sends BHK prompt. Customer clicks / replies `"3BHK"`.
       - Bot writes `['3BHK']` to `lead_details.configuration_preference`.
    5. Bot asks for location. Customer replies: `"Powai"`.
       - Bot writes `"Powai"` to `lead_details.location_preference`.
    6. Qualifier triggers `assign_conversation` with `mode: 'round_robin'`.
       - System evaluates available agents, selects least-loaded agent, and logs `assignment_history` with reason `auto_round_robin`.
  - **Expected:** End-to-end automated qualification replaces manual telecalling.

- **TC-MAW-42: Real Estate Broadcast Audience Segmentation (`/broadcasts`)**
  - **Actor:** `admin` (`Neha Sharma`)
  - **Steps:**
    1. Navigate to `/broadcasts/new`.
    2. **Step 1 (Choose Template):** Select pre-seeded RE broadcast template:
       - `Diwali Offer 🪔`
       - `New Project Launch 🏠`
       - `Price Drop Alert 📉`
    3. **Step 2 (Select Audience):** Choose Audience Type: **Lead Details Segment** (`lead_segment`).
    4. Configure multi-condition filter:
       - Condition 1: `configuration_preference contains 3BHK`
       - Condition 2: `location_preference contains Powai`
       - Condition 3: `budget_min >= 10000000`
    5. Verify recipient preview calculates exact matching leads from `lead_details` without duplicates.
    6. **Step 3 (Review & Send):** Schedule or dispatch broadcast.
  - **Expected:** Highly targeted broadcast campaign sent only to qualified property buyers.

- **TC-MAW-43: Broadcast Role Gating**
  - **Actor:** `agent1` (`Vikram Singh`)
  - **Steps:**
    1. Log in as `agent1`. Navigate to `/broadcasts`.
    2. Check "New Broadcast" action button: expect disabled or hidden via `canCreateBroadcast`.
    3. Attempt direct API request: `POST /api/broadcasts` with payload.
  - **Expected:** API returns HTTP 403 Forbidden (`requireRole('admin')`); agents can view campaign statistics but cannot blast messages to the entire contact database.

---

### Phase 13: Portal Integrations, Bulk Lead Import & Data Export (`/integrations`, `/contacts/import`, `/api/contacts/export`)

Verify portal lead ingestion, universal capture email, CSV/Excel import, and CSV data exports.

- **TC-MAW-44: Universal Capture Email & Portal Integrations Surface (`/integrations`)**
  - **Actor:** `owner` or `admin`
  - **Steps:**
    1. Navigate to `http://localhost:3000/integrations`.
    2. Verify Universal Capture Email card:
       - Displays `leads+09e60b2d@...` with a 1-click "Copy" button.
       - Subtitle explains forwarding instructions for Indian portals.
    3. Audit Portal Tiles Grid:
       - **99acres:** Connect status, setup modal, copy capture email step.
       - **MagicBricks:** Connect status and instructions.
       - **Housing.com:** Connect status and instructions.
       - **Gmail:** Connect status.
       - **NoBroker:** Connect status and instructions.
       - **WhatsApp Business:** Reflects live Meta Cloud API connection (`connected` with green badge).
       - **JustDial / Instagram:** Labeled "Coming Soon" with disabled action.
    4. Click "+ Connect" on 99acres -> setup sheet opens with numbered steps. Click "Mark as Connected" -> tile badge turns green "✓ Connected".
    5. **Agent Role Gate:** Log in as `agent1` and navigate to `/integrations` -> expect "Access Denied — Contact your admin to manage integrations".
  - **Expected:** Clean integration management with proper role isolation.

- **TC-MAW-45: Inbound Portal Lead Parsing & Tagging Webhook**
  - **Actor:** Automated / Inbound Email Webhook
  - **Steps:**
    1. Send simulated portal webhook request to `/api/webhooks/inbound-email?token=<api_key>` with 99acres lead notification email in form body:
       `subject: "New Inquiry for Apex Grandeur on 99acres"`
       `text: "Lead Name: Deepak Verma\nMobile: 9876500444\nEmail: deepak@example.com\nLooking for 3BHK"`
    2. Verify HTTP 200 response.
  - **Expected:**
    - Contact created with normalized phone `+919876500444`.
    - `lead_details.source` set to `'99acres'`.
    - Tag `'99acres'` attached to the contact.
    - `accounts.portal_connections['99acres'].test_lead_received = true`.
    - Integrations tile displays green sub-label `"✓ Test lead received"`.

- **TC-MAW-46: Bulk CSV / Excel Lead Import with Indian Phone & Budget Parsing (`/contacts/import`)**
  - **Actor:** `admin` in `/contacts/import`
  - **Steps:**
    1. Click "Import Contacts" in `/contacts` header to open `/contacts/import`.
    2. Upload test CSV with headers:
       `Customer Name, Phone, Source, Budget, BHK Type, Location, Notes`
       Values:
       - Row 1: `Vikrant Roy, 9876500555, 99acres, 1.8 Cr, 3BHK, Powai, Ready to purchase`
       - Row 2: `Meera Joshi, 09876500666, MagicBricks, 85 Lakh, 2BHK, Thane, Pre-approved loan`
       - Row 3: Duplicate of Row 1 (`9876500555`)
    3. Step 2 (Column Mapping):
       - Smart auto-mapper matches `Customer Name -> Name`, `Phone -> Mobile`, `Budget -> Budget Min`, `BHK Type -> BHK Config`.
    4. Click "Import Contacts":
       - Phone parsing normalizes `9876500555` to `+919876500555` and strips leading `0` from `09876500666` -> `+919876500666`.
       - Budget strings parsed: `"1.8 Cr"` -> `18000000`, `"85 Lakh"` -> `8500000`.
       - `configuration_preference` array populated with `['3BHK']` and `['2BHK']`.
       - Duplicate phone in Row 3 skipped via `onConflict: 'account_id,phone_normalized'`.
    5. Verify import summary: `Created: 2, Skipped: 1, Errors: 0`.
  - **Expected:** Flawless bulk onboarding of Indian portal leads with correct data types.

- **TC-MAW-47: Real Estate CRM Data Export (`/api/contacts/export`)**
  - **Actor:** `admin` or `owner` in `/contacts`
  - **Steps:**
    1. Click "Export CSV" in `/contacts` page header.
    2. Download triggered via `GET /api/contacts/export`.
    3. Inspect downloaded CSV contents:
       - Header: `Lead Name, Mobile, Source, Stage, Assigned Agent, Budget (INR), Location, BHK Config, RERA Property, Visits Completed, Last Activity, Created At`
       - Verify Budget formatted as `₹1.8Cr` or `₹85L`.
       - Verify BHK Config shows `3BHK`.
       - Verify Assigned Agent resolves full name from `profilesMap`.
  - **Expected:** Complete real estate export suitable for reporting and external analysis.

- **TC-MAW-48: Print-Optimized Team Performance Report (`/team?print=true`)**
  - **Actor:** Business Owner or Manager
  - **Steps:**
    1. Navigate to `/team`.
    2. Click the "Print Report" button (printer icon) in the header.
    3. Browser opens `/team?print=true` and triggers the browser print dialog.
    4. Audit print view layout:
       - Sidebar, header, action buttons, and filters are hidden (`@media print` rules).
       - KPI summary cards and agent performance cards render in a compact 2-column A4-friendly grid.
       - Page breaks avoid splitting cards (`break-inside: avoid`).
  - **Expected:** Executive-ready physical or PDF report generated in 1 click.

---

### Phase 14: Settings RBAC, Cost Sheet Config & AI Co-Pilot Assistant (`/settings`, `/agents`, `/notifications`)

Verify settings role gates, billing subscription details, Indian real estate cost sheet configuration, AI playground, and real-time notification dispatch.

- **TC-MAW-49: Settings Role Isolation & RBAC Gate**
  - **Actor 1:** `agent1` (`Vikram Singh` - role `agent`)
    - Navigates to `/settings?tab=members`, `/settings?tab=whatsapp`, `/settings?tab=deals`, or `/settings?tab=billing`.
    - UI blocks unauthorized tabs and displays localized `accessRestrictedTitle` ("Access Restricted") and `accessRestrictedDesc` ("Contact your admin to manage account settings.") with a button `goToProfile` ("Go to Profile Settings").
    - Confirms `agent` can only view/edit `profile`, `appearance`, and `security`.
  - **Actor 2:** `admin` (`Neha Sharma` - role `admin`)
    - Full access to `whatsapp` (Meta credentials, WABA ID, phone ID), `templates`, `quick-replies`, `fields` (tags & custom fields), `deals` (default currency, stages), `members` (invite, revoke, role update), `api` (API keys, outbound webhooks), and `routing` (lead auto-assignment).
  - **Actor 3:** `owner` (`Arjun Malhotra` - role `owner`)
    - Exclusive access to `/settings?tab=billing` with plan tier, renewal date, and seat usage progress indicator. Non-owners attempting direct navigation see `accessRestrictedTitle` ("Access Restricted").

- **TC-MAW-50: Indian Real Estate Cost Sheet Configuration (`/settings?tab=cost-sheet`)**
  - **Actor:** `admin` or `owner`
  - **Steps:**
    1. Open `/settings?tab=cost-sheet`.
    2. Configure account-wide default rates:
       - Base Rate: `₹8,500 / sq ft`
       - Floor Rise: `₹50 / sq ft / floor` starting from Floor 5
       - Covered Car Parking: `₹4,00,000`
       - Statutory GST: `5%` (residential standard)
       - Stamp Duty: `6%` (Maharashtra standard)
       - Registration Fee: `₹30,000` flat
    3. Save settings.
    4. In `/inbox`, open `CostSheetModal` for a lead: verify calculations dynamically compute from the configured rates.
  - **Expected:** Complete transparency in buyer cost estimates aligned with local Indian developer practices.

- **TC-MAW-51: AI Co-Pilot Real Estate Assistant & Knowledge Base (`/agents`)**
  - **Actor:** `admin` or `agent`
  - **Steps:**
    1. Navigate to `http://localhost:3000/agents`.
    2. In the AI Playground tab, input customer query:
       `"Can you recommend a 3BHK flat in Powai with possession in 2026 under ₹2 Cr?"`
    3. AI Agent processes system prompt and property knowledge:
       - Matches `"Apex Grandeur — 3BHK Lake View"` (`₹1.65 Cr`, Powai, Ready to Move).
       - Suggests site visit and generates polite WhatsApp copy with pricing and specs.
    4. Test auto-drafting in `/inbox`: click "Generate AI Reply" inside message composer:
       - Pre-fills suggested response into composer for agent review before sending.
  - **Expected:** AI assists sales agents with real-time property recommendations and draft messages.

- **TC-MAW-52: Real-Time Notification Center & Instant Assignment Alerts (`/notifications`)**
  - **Actor:** `agent1` (`Vikram Singh`)
  - **Steps:**
    1. Manager reassigns conversation `Rohan Mehra` to `Vikram Singh`.
    2. Supabase Realtime channel delivers notification event to Vikram's active session.
    3. Header bell icon displays red unread badge counter `(1)`.
    4. Vikram clicks bell or navigates to `/notifications`:
       - Notification item rendered with `UserPlus` icon: `"New lead assigned: Rohan Mehra"` with relative timestamp (`just now`).
       - Clicking item navigates directly to `/inbox?c=<conversation_id>`.
    5. Click "Mark all as read" button:
       - Database updates `read: true` for all notifications.
       - Header badge clears immediately without full-page reload.
  - **Expected:** Instant push alerts guarantee immediate agent response within SLA windows.

---

### Phase 15: Public REST API v1 & Multi-Tenant RLS Security Verification (`/api/v1`)

Verify external developer APIs, scoped API key authentication, per-key rate limiting, two-tenant RLS isolation, and outbound webhook delivery.

- **TC-MAW-53: Public API Key Authentication & Granular Scopes (`/api/v1`)**
  - **Actor:** Developer / Integration Script
  - **Steps:**
    1. Admin generates API key with scopes `contacts:read`, `contacts:write`.
    2. `GET /api/v1/me` -> returns HTTP 200 with `{ data: { account_id: '09e60b2d...', name: 'Apex Horizon Realty' } }`.
    3. `GET /api/v1/contacts` -> returns HTTP 200 with contacts array.
    4. **Negative Test (Scope Boundary):**
       - Developer calls `POST /api/v1/broadcasts` using the same key.
       - Server returns HTTP 403 Forbidden with `{ error: { code: 'forbidden', message: 'This API key is missing the \'broadcasts:send\' scope' } }`.
    5. **Negative Test (Invalid / Revoked Key):**
       - Revoke key in dashboard or send malformed token -> returns HTTP 401 Unauthorized `{ error: { code: 'unauthorized', message: 'Invalid or revoked API key' } }`.
  - **Expected:** Strict scope enforcement prevents unauthorized API actions.

- **TC-MAW-54: Multi-Tenant RLS Database Isolation Negative Tests**
  - **Setup:** Two distinct tenants:
    - Tenant A: `Apex Horizon Realty` (`09e60b2d-...`)
    - Tenant B: `Secondary Realty Ltd` (`bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`)
  - **Negative Verification:**
    1. Authenticate as Tenant B agent.
    2. Attempt to query `properties`, `deals`, `site_visits`, `contacts`, `assignment_history`, or `whatsapp_config` matching Tenant A's `account_id`:
       ```sql
       SELECT count(*) FROM properties WHERE account_id = '09e60b2d-7c0f-4242-aa74-c4becda130da';
       ```
    3. RLS policy `is_account_member(account_id)` intercepts the query and returns `0` records.
    4. Direct `GET /api/contacts?id=<tenant_a_contact_id>` returns HTTP 404 / empty list.
  - **Expected:** ZERO cross-tenant data leakage across all database tables and API endpoints.

- **TC-MAW-55: Outbound Event Webhook Dispatch**
  - **Actor:** Outbound Webhook Worker
  - **Steps:**
    1. In `/settings?tab=api`, register outbound webhook URL: `https://webhook.site/...` subscribing to events `contact.created` and `message.received`.
    2. Trigger new inbound WhatsApp message.
    3. Verify dispatch payload delivered to webhook URL:
       - Header `X-WaCRM-Signature: sha256=...` signed with the account webhook secret.
       - Body contains `{ event: 'message.received', timestamp: '...', data: { ... } }`.
  - **Expected:** Third-party CRMs and Zapier/Make integrations can ingest live CRM events securely.

---

## 3. UI/UX Feature Gaps & Audit Checklist (Phases 1 – 15)

During codebase and workflow inspection, the following gaps and data wiring issues were audited, resolved, and verified:

| #   | Component / File                                                   | Expected Feature                                     | Gap Identified                                                                                                                      | Resolution & Verification                                                                                                                                                           |
| :-- | :----------------------------------------------------------------- | :--------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/components/inbox/conversation-list.tsx`                       | Quick tabs for **Mine**, **Unassigned**, and **All** | Only filtered by conversation status; agents could not isolate their leads                                                          | **Fixed & Verified:** Added segmented tabs ("Mine", "Unassigned", "All") with assigned agent filtering (Commit `a7d0ac7`).                                                          |
| 2   | `src/components/inbox/contact-sidebar.tsx`                         | Inline Real Estate qualification form                | Only displayed basic info, tags, and notes                                                                                          | **Fixed & Verified:** Built comprehensive Real Estate qualification panel (Budget ₹ INR, BHK multiselect, Location, Possession) (Commit `42ad49d`).                                 |
| 3   | `src/components/inbox/contact-sidebar.tsx`                         | "Schedule Visit" & "Send Cost Sheet" buttons         | Missing in inbox sidebar                                                                                                            | **Fixed & Verified:** Added 1-click "Schedule Visit" (opens `ScheduleVisitSheet`) and "Send Cost Sheet" actions directly in sidebar (Commit `42ad49d`).                             |
| 4   | `src/components/inbox/message-thread.tsx`                          | Assignment changes logged to audit trail             | Assigned agent update did not enrich audit log                                                                                      | **Fixed & Verified:** Added audit logging to `assignment_history` with reason `'manual_reassign'` or `'claim'` (Commit `06e472e`).                                                  |
| 5   | `src/lib/automations/engine.ts`                                    | Automated round-robin assignment audit logging       | Updated conversation directly without reason                                                                                        | **Fixed & Verified:** Enriched audit entry with reason `'auto_round_robin'` in `assignment_history` (Commit `6327c05`).                                                             |
| 6   | `src/app/api/deals/[id]/route.ts`                                  | RBAC protection on deal reassignment                 | Agents could submit `assigned_to: other_agent` directly via API, bypassing disabled UI select                                       | **Fixed & Verified:** Added server-side role check `canManageMembers(ctx.role)` returning 403 `CANNOT_REASSIGN_DEAL`. Verified via vitest test suite.                               |
| 7   | `src/components/pipelines/deal-table.tsx`                          | Strict 4-locale i18n parity                          | Hardcoded English `title="Edit Deal"` in JSX                                                                                        | **Fixed & Verified:** Replaced with `title={tForm('editDeal')}` using `Pipelines.form` namespace. Strict parity verified via `messages.test.ts`.                                    |
| 8   | `src/app/api/contacts/import/route.ts`                             | Bulk import BHK configuration preference             | Stored `bhk_config` in `property_type` only; left `configuration_preference` null                                                   | **Fixed & Verified:** Wired `configuration_preference: row.bhk_config ? [row.bhk_config] : null`, enabling BHK filter chips and broadcast segments. Verified via vitest test suite. |
| 9   | `src/components/properties/property-share-modal.tsx`               | In-app CRM Chat deep link                            | Only opened external `wa.me` links, bypassing CRM shared inbox                                                                      | **Fixed & Verified:** Added direct "Chat in CRM" action button linking to `/inbox?contactId=...` with translations in `en`, `es`, `ko`, `pt`.                                       |
| 10  | `src/app/(dashboard)/team/team-client.tsx`                         | Print-optimized layout (`?print=true`)               | Default team dashboard rendered full interactive UI on print                                                                        | **Fixed & Verified:** Added `@media print` stylesheet, auto-print timeout on `?print=true`, and "Print Report" header button.                                                       |
| 11  | `src/components/inbox/contact-sidebar.tsx` & `template-picker.tsx` | Clean lint standards                                 | Unused eslint-disable comment and unused `err` variable                                                                             | **Fixed & Verified:** Cleaned up unused directives and variables; `npm run lint` passes with 0 errors and 0 warnings.                                                               |
| 12  | `src/app/(dashboard)/settings/page.tsx`                            | Strict 4-locale i18n parity                          | Hardcoded English strings `"Access Restricted"`, `"Contact your admin to manage account settings."`, and `"Go to Profile Settings"` | **Fixed & Verified:** Replaced with `t('accessRestrictedTitle')`, `t('accessRestrictedDesc')`, and `t('goToProfile')` across `en`, `es`, `ko`, `pt` with 100% parity verified.      |
| 13  | `src/components/settings/billing-tab.tsx`                          | Strict 4-locale i18n parity                          | Hardcoded English strings in Billing tab heading, card title, buttons, seat usage, and access restriction                           | **Fixed & Verified:** Extracted to `Settings.billingTab` across all 4 locales (`en`, `es`, `ko`, `pt`) with ICU formatting. 10/10 parity tests passing.                             |

---

## 4. Supabase MCP Database Verification Cheat Sheet

Run these queries through Supabase MCP during test execution:

```sql
-- 1. Check WhatsApp Config status for Apex Horizon Realty
SELECT id, account_id, phone_number_id, waba_id, status, connected_at
FROM whatsapp_config WHERE account_id = '09e60b2d-7c0f-4242-aa74-c4becda130da';

-- 2. Verify Agent Availability and Workload
SELECT p.id, p.user_id, p.full_name, p.account_role, p.is_available,
       (SELECT count(*) FROM conversations c WHERE c.assigned_agent_id = p.user_id AND c.status = 'open') as open_conversations
FROM profiles p
WHERE p.account_id = '09e60b2d-7c0f-4242-aa74-c4becda130da'
ORDER BY open_conversations ASC;

-- 3. Check Conversation and Assigned Agent
SELECT c.id as conv_id, c.contact_id, ct.name as contact_name, ct.phone,
       c.assigned_agent_id, p.full_name as agent_name, c.status, c.unread_count, c.last_message_at
FROM conversations c
LEFT JOIN contacts ct ON ct.id = c.contact_id
LEFT JOIN profiles p ON p.user_id = c.assigned_agent_id
WHERE c.account_id = '09e60b2d-7c0f-4242-aa74-c4becda130da'
ORDER BY c.last_message_at DESC LIMIT 10;

-- 4. Check Assignment Audit Trail
SELECT ah.id, ah.contact_id, ct.name as contact_name,
       p_from.full_name as from_agent,
       p_to.full_name as to_agent,
       p_actor.full_name as actor,
       ah.reason, ah.created_at
FROM assignment_history ah
LEFT JOIN contacts ct ON ct.id = ah.contact_id
LEFT JOIN profiles p_from ON p_from.user_id = ah.from_agent_id
LEFT JOIN profiles p_to ON p_to.user_id = ah.to_agent_id
LEFT JOIN profiles p_actor ON p_actor.user_id = ah.actor_id
WHERE ah.account_id = '09e60b2d-7c0f-4242-aa74-c4becda130da'
ORDER BY ah.created_at DESC LIMIT 10;

-- 5. Check Site Visits Scheduled & Tasks
SELECT sv.id, sv.scheduled_at, sv.status, sv.pickup_required, sv.pickup_location,
       c.name as contact_name, p.title as property_title,
       t.id as task_id, t.done as task_done, t.assigned_to as task_assignee
FROM site_visits sv
LEFT JOIN contacts c ON c.id = sv.contact_id
LEFT JOIN properties p ON p.id = sv.property_id
LEFT JOIN tasks t ON t.site_visit_id = sv.id
WHERE sv.account_id = '09e60b2d-7c0f-4242-aa74-c4becda130da'
ORDER BY sv.scheduled_at DESC LIMIT 5;

-- 6. Check Deals & Assignees across Pipeline Stages
SELECT d.id, d.title, d.value, d.status, d.closed_at, d.reopened_count,
       ps.name as stage_name, p.full_name as assignee_name,
       lr.reason as lost_reason, d.lost_note
FROM deals d
LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
LEFT JOIN profiles p ON p.id = d.assigned_to
LEFT JOIN lost_reasons lr ON lr.id = d.lost_reason_id
WHERE d.account_id = '09e60b2d-7c0f-4242-aa74-c4becda130da'
ORDER BY d.created_at DESC LIMIT 10;

-- 7. Check Properties Inventory & RERA Compliance
SELECT id, title, price, configuration, carpet_area, facing, rera_id, possession_status
FROM properties
WHERE account_id = '09e60b2d-7c0f-4242-aa74-c4becda130da'
ORDER BY price DESC;

-- 8. Check Lead Details & Configuration Preferences
SELECT ld.id, c.name, c.phone, ld.source, ld.budget_min, ld.budget_max,
       ld.configuration_preference, ld.location_preference
FROM lead_details ld
JOIN contacts c ON c.id = ld.contact_id
WHERE ld.account_id = '09e60b2d-7c0f-4242-aa74-c4becda130da'
ORDER BY ld.created_at DESC LIMIT 10;

-- 9. Check Conversation Flows & Qualifier Bot
SELECT id, name, trigger_type, status, execution_count, last_executed_at
FROM flows
WHERE account_id = '09e60b2d-7c0f-4242-aa74-c4becda130da';

-- 10. Check Portal Connections & Universal Capture Email
SELECT id, name, portal_connections, default_currency
FROM accounts
WHERE id = '09e60b2d-7c0f-4242-aa74-c4becda130da';

-- 11. Check API Keys and Outbound Webhook Subscriptions
SELECT id, name, scopes, key_prefix, last_used_at, revoked_at
FROM api_keys
WHERE account_id = '09e60b2d-7c0f-4242-aa74-c4becda130da'
ORDER BY created_at DESC;

-- 12. Check Account Billing, Plan Tier & Seat Usage
SELECT id, name, plan_tier, subscription_status, seat_limit, current_period_end
FROM accounts
WHERE id = '09e60b2d-7c0f-4242-aa74-c4becda130da';
```
