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

| Role | Member Name | Login Email | User ID (`auth.users.id`) | Profile ID (`profiles.id`) | Availability | Operational Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Owner** | Arjun Malhotra | `owner@apexrealty.in` | `8acedd39-3e67-4c1c-8a69-4d29fd4d4b4a` | `fc50e090-697b-4240-93d6-be4d3e8f5def` | `true` | Full tenant owner, connects WhatsApp, billing |
| **Admin** | Neha Sharma | `admin@apexrealty.in` | `b60f77d9-b4b6-4534-a80b-81f0b9fe0894` | `86018075-24f3-46a4-b4ec-77e6d660f4d9` | `true` | Sales manager, routing rules, bulk reassignments |
| **Agent 1** | Vikram Singh | `agent1@apexrealty.in` | `d202706c-cd48-4647-afc8-ea13c680586d` | `549c9c94-e01a-4a78-bdc2-c5ef751b3a54` | `true` (Active) | Primary sales agent (round-robin target) |
| **Agent 2** | Ananya Roy | `agent2@apexrealty.in` | `ca26e9b1-f978-4621-8203-7ace9dbeb2af` | `08f26eb7-8adf-437e-9361-886ef1d0288f` | `true` (Active) | Secondary sales agent (round-robin target) |
| **Agent 3** | Karan Verma | `agent3@apexrealty.in` | `a5de3658-0818-466e-92dd-561a73321769` | `5ffb0727-8c63-4d5a-b657-0163f0f4a1e7` | `false` (On Leave) | Agent on leave (tests availability skipping) |
| **Viewer** | Pooja Iyer | `viewer@apexrealty.in` | `df9a8428-9528-4f54-8d32-f9e22821c5a1` | `33197f15-a713-4826-801b-0c0ac16e99fb` | `false` | Read-only trainee/auditor (RBAC gating) |

---

### 1.2 Official WhatsApp Business Channel (Meta Cloud API)
Credentials populated from `whatsapp_credentials.md` and encrypted in `whatsapp_config`:

| Parameter | Value | Notes |
| :--- | :--- | :--- |
| **Phone Number ID** | `939656362572111` | Official WhatsApp Business Phone Number ID |
| **WABA ID** | `2111247669610431` | WhatsApp Business Account ID |
| **Test Recipient Phone** | `+1 (555) 171-8060` | Meta developer test recipient number |
| **Webhook Verify Token** | `wacrm` | Stored encrypted in `whatsapp_config` |
| **Public Webhook URL** | `https://rebel-tipping-prenatal.ngrok-free.dev/api/whatsapp/webhook` | Verified HTTP 200 via ngrok tunnel |
| **Local Webhook URL** | `http://localhost:3000/api/whatsapp/webhook` | Verified HTTP 200 locally |

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

## 3. UI/UX Feature Gaps & Audit Checklist for Gemini

During inspection of the current codebase, the following specific UI/UX and wiring checks must be evaluated and verified:

| Component / File | Expected Ideal Feature | Current Status in Codebase | Action Item for Testing |
| :--- | :--- | :--- | :--- |
| `src/components/inbox/conversation-list.tsx` | Quick tabs for **Mine**, **Unassigned**, and **All** | Only filters by Status (`all`, `unread`, `open`, `pending`, `closed`) and tags | Verify if agent can filter strictly their own leads in `/inbox` or if "Mine" view needs implementation |
| `src/components/inbox/contact-sidebar.tsx` | Inline Real Estate qualification (Budget ₹ INR, BHK, Location) | Only displays Contact Info, Tags, Deals, Notes | Check if `ContactDetailView` modal is linked or if qualification form should be directly inside sidebar |
| `src/components/inbox/contact-sidebar.tsx` | "Schedule Visit" & "Send Cost Sheet" buttons | Currently missing in inbox sidebar (they exist in `/contacts` and `/properties`) | Verify if agent can trigger site visit scheduling directly from inbox without switching tabs |
| `src/components/inbox/message-thread.tsx` | Assignment change logs to `assignment_history` | Currently updates `conversations.assigned_agent_id` directly without writing to `assignment_history` | Verify whether changing assignee from thread header writes to audit log |
| `src/lib/automations/engine.ts` | Auto-assignment writes to `assignment_history` | Updates conversation directly | Check if automated round-robin writes reason `auto_round_robin` to `assignment_history` |

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

-- 5. Check Site Visits Scheduled
SELECT sv.id, sv.scheduled_at, sv.status, sv.pickup_required, sv.pickup_location,
       c.name as contact_name, p.title as property_title
FROM site_visits sv
LEFT JOIN contacts c ON c.id = sv.contact_id
LEFT JOIN properties p ON p.id = sv.property_id
WHERE sv.account_id = '09e60b2d-7c0f-4242-aa74-c4becda130da'
ORDER BY sv.scheduled_at DESC LIMIT 5;
```
