# WaCRM UI/UX, Design Consistency, Edge-Case & Mobile Adaptation Testing Plan

> **Target:** Full Application UI/UX, Visual Design System, Edge-Case Hardening, and Mobile Adaptation in WaCRM (Real Estate Vertical CRM).  
> **Framework & Stack:** Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4, shadcn (`base-nova` on `@base-ui/react`), `next-intl`, Lucide Icons, Recharts / Tremor wrappers.  
> **Environment:** Local Next.js 16 (`http://localhost:3000`), Supabase Remote DB (`eielslitcyiknuupzwcf`), Active Test Account: *Apex Horizon Realty* (`09e60b2d-7c0f-4242-aa74-c4becda130da`).  
> **Execution Mode:** Multi-Viewport Browser Subagent, Visual DOM Analysis, CSS Static Analysis, Stress-Testing Injections.

---

## 1. Test Environment, Tooling & Viewport Baselines

### 1.1 Test Accounts & Credentials Baseline
All tests must be executable across the 4 established RBAC tiers to verify role-specific UI rendering and permission gates:
- **Owner:** `owner@apexrealty.in` (Arjun Malhotra) — Password: `Test@1234`
- **Admin:** `admin@apexrealty.in` (Neha Sharma) — Password: `Test@1234`
- **Agent:** `agent1@apexrealty.in` (Vikram Singh) — Password: `Test@1234`
- **Viewer:** `viewer@apexrealty.in` (Pooja Iyer) — Password: `Test@1234`

### 1.2 Viewport Testing Matrix
Every page and interactive component must be evaluated across these 6 distinct viewport profiles:

| Viewport ID | Device Profile | Width × Height | DPR | Navigation Paradigm | Primary Layout Target |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **VP-M1** | Small Mobile (iPhone SE / Mini) | `375 × 667` | 2.0 | `BottomNav` + `TopAppBar` + Slide Drawer | Single-column stacked cards, full-width inputs |
| **VP-M2** | Standard Mobile (iPhone 14/15/16) | `390 × 844` | 3.0 | `BottomNav` + `TopAppBar` + Slide Drawer | Master-detail push/pop or segmented tabs |
| **VP-M3** | Large Mobile (Pixel 7 / Pro, Max) | `412 × 915` | 2.6 | `BottomNav` + `TopAppBar` + Slide Drawer | Fluid bottom sheets (`Drawer` / `Sheet`) |
| **VP-T1** | Tablet Portrait (iPad 10th / Air) | `768 × 1024` | 2.0 | Collapsible Sidebar + Compact Header | 2-column responsive grid, fluid data tables |
| **VP-D1** | Desktop Standard (MacBook 14") | `1440 × 900` | 2.0 | Fixed Left Sidebar (`w-64`) + Top Header | 3-pane split (Inbox), multi-column Kanban |
| **VP-D2** | Desktop Ultrawide / External Monitor | `1920 × 1080` | 1.0 | Fixed Left Sidebar (`w-64`) + Max-W Container | `max-w-7xl` center-anchored layout |

---

## 2. Core Audit Dimensions & Quality Gates

### Dimension 1: UI/UX Layout Breakages
- **Flex & Grid Wrapping:** Ensure chips, badge clusters, action button groups, and metric cards wrap gracefully without clipping or vertical text overflow.
- **Header & Navbar Overlaps:** Verify sticky headers (`TopAppBar`, `Header`) do not occlude top-of-page content or duplicate back buttons.
- **Z-Index Layering Order:** Enforce strict stacking context hierarchy:
  1. Base content (`z-0`)
  2. Sticky headers / table headers (`z-10` to `z-20`)
  3. Fixed Desktop Sidebar / Mobile Bottom Nav (`z-30`)
  4. Slide-over Drawers / Sheets (`z-40`)
  5. Centered Modals / Dialogs (`z-50`)
  6. Dropdown Menus, Popovers & Tooltips (`z-60` to `z-70`)
  7. Toast Notifications (`z-100` via `ThemeToaster`)
- **Scroll Chaining & Double Scrollbars:** Modals and bottom sheets must lock background body scrolling (`overflow: hidden` on `body` while open). Nested scroll areas must have bounded heights (`h-[calc(100vh-...)]`) with clear scroll tracks.

### Dimension 2: UI/Features Duplication, Missing Features & Over-Engineering
- **Duplication Audit:** Eliminate redundant search bars, duplicate edit/delete triggers, and multiple identical quick-action buttons on the same view.
- **Missing UI / Functional Gaps:**
  - Empty states with illustrative SVG + primary CTA button on all list/table views when record count is 0.
  - Skeletons / loading spinners on async transitions (no jarring content layout shifts - CLS < 0.1).
  - Outbound Webhooks management UI in `/settings?tab=api`.
  - Breadcrumbs or intuitive Back navigation on detail views (`/contacts/[id]`, `/broadcasts/[id]`, `/flows/[id]`).
- **Over-Engineered / Clutter Audit:** Remove superfluous confirmation dialogs for lightweight non-destructive actions; simplify dense forms with collapsible sections; ensure analytics widgets provide actionable intelligence rather than visual noise.

### Dimension 3: Edge-Case Handling & Overflow Hardening
- **Extreme Text Strings:**
  - Ultra-long Indian contact names (e.g., `Dr. Chandrasekharaswamy Venkataramanasastry`).
  - 120-character property titles (e.g., `Godrej Platinum Sky Residences — Luxury Penthouse with 360° Arabian Sea View & Private Deck`).
  - Unspaced continuous strings (`WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW`).
  - Long email addresses (`very.long.first.name.and.family.surname@subdomain.corporateenterprise.com`).
  - Long URLs and WhatsApp deep links.
  - **Required Pattern:** `truncate` or `line-clamp-1`/`line-clamp-2` with native `title="..."` or Shadcn `Tooltip` for full string reveal; chat bubbles must use `break-words` and `break-all` on URLs.
- **Extreme Real Estate Currency & Numbers:**
  - High-value Indian Crores/Lakhs: `₹12,50,00,000`, `₹85,00,000`, `₹0`, and null/undefined values.
  - Number formatters must never render `NaN`, `undefined`, or `₹[object Object]`.
  - Floor rise numbers up to 100 floors; Carpet area from 150 sq ft (studio/commercial) to 25,000 sq ft (villas/plots).
- **Network & Extreme Data States:**
  - 0 items (custom empty states).
  - 10,000+ items (pagination controls or virtualized rendering).
  - Offline mode / poor connectivity (PWA banner `/offline`).
  - Viewer role disabled state: Action buttons must show clear disabled styling (`opacity-50 cursor-not-allowed`) with tooltip explaining missing permission.

### Dimension 4: Visual Consistency & Centralization of Design Constants
- **Centralized Design Token Discipline:**
  - **Zero Hardcoded Colors:** No raw hex codes (`#10b981`, `#ffffff`, `#1e293b`) or rogue arbitrary Tailwind classes in component JSX. All surfaces, borders, and typography must use theme variables from `src/app/globals.css`.
  - **Surfaces:** `bg-background`, `bg-card`, `bg-card-2`, `bg-muted`, `bg-popover`.
  - **Borders & Rings:** `border-border`, `ring-ring`.
  - **Text:** `text-foreground`, `text-muted-foreground`, `text-primary`.
- **Status & Badge Semantic Harmony:**
  - **Lead Temperature:** Hot (`bg-red-500/10 text-red-500 border-red-500/20`), Warm (`bg-amber-500/10 text-amber-500 border-amber-500/20`), Cold (`bg-blue-500/10 text-blue-500 border-blue-500/20`).
  - **Pipeline Stages:** New Lead (`--status-new`), Site Visit (`--status-site-visit`), Negotiation (`--status-negotiation`), Won/Closed (`bg-emerald-500/10 text-emerald-500`), Lost (`bg-rose-500/10 text-rose-500`).
  - **Agent Presence:** Online (`bg-emerald-500`), Away (`bg-amber-500`), Offline (`bg-muted-foreground/40`).
  - **SLA Indicators:** Good (`--sla-good`), Warning (`--sla-warning`), Critical (`--sla-critical`).
- **Typography Scale:**
  - H1 Page Titles: `text-2xl font-bold tracking-tight text-foreground`
  - H2 Section Titles: `text-lg font-semibold text-foreground`
  - H3 Card Titles: `text-sm font-medium text-foreground`
  - Body Text: `text-sm text-foreground`
  - Captions / Metadata: `text-xs text-muted-foreground`
- **Border Radius Uniformity:** `rounded-lg` for form controls/buttons, `rounded-xl` for cards/panels, `rounded-2xl` for dialogs/sheets.

### Dimension 5: Ideal Mobile View Adaptation (Zero Feature Loss)
- **Navigation Parity:** All 14 dashboard routes accessible on mobile via `BottomNav` (Top 4 shortcuts: Inbox, Leads, Pipeline, Properties) + a comprehensive "More" Drawer for remaining tools (Visits, Broadcasts, Automations, Flows, AI Agents, Team, Settings).
- **Master-Detail Inbox Transformation:**
  - Desktop: 3-pane split (List + Thread + Contact Sidebar).
  - Mobile: Single-pane view with stateful transition:
    - Step 1: Conversation List.
    - Step 2: Full-screen Message Thread with sticky back button and contact header.
    - Step 3: 1-click Contact Sheet / Real Estate Qualification drawer sliding from right/bottom.
- **Pipeline Kanban Transformation:**
  - Desktop: Multi-column horizontal drag-and-drop board.
  - Mobile: Segmented stage pill switcher (e.g., `[New (4)] [Visit (2)] [Negotiation (3)] [Won (1)]`) showing filtered cards with 1-tap stage progression buttons, avoiding horizontal pinching.
- **Data Table Transformation:**
  - Mobile tables must either transform into rich stacked cards or provide an explicit `overflow-x-auto` wrapper with fixed/sticky first column and scroll indicators.
- **Touch Targets & Ergonomics:**
  - Minimum touch target: `44 × 44 px` for all clickable icons, buttons, and dropdown triggers.
  - Safe Area Padding: `pb-safe` and `env(safe-area-inset-bottom)` applied to `BottomNav` and floating action buttons.
  - Hover Styles: No sticky `:hover` states lingering on mobile devices after tap.

---

## 3. Route-by-Route Testing Phases & Detailed Test Cases

---

### Phase 1: Global App Shell, Navigation & Responsive Framework
Verify the persistent outer container across all viewports, role gates, and theme switches.

- **TC-UX-01: Desktop vs Mobile Navigation Transformation**
  - **Viewports:** `VP-D1`, `VP-M2`
  - **Steps:**
    1. On `VP-D1` (`1440px`), verify left `Sidebar` is fixed (`w-64`), displaying logo, organization switcher ("Apex Horizon Realty"), 14 nav links, active indicator, and user presence pill.
    2. Resize viewport to `VP-M2` (`390px`).
    3. Verify desktop `Sidebar` hides immediately; `TopAppBar` appears at top; `BottomNav` appears fixed at screen bottom with blur backdrop (`backdrop-blur-md`).
    4. Tap hamburger icon on `TopAppBar`: verify slide-over navigation drawer renders smoothly with full roster of links.
    5. Tap outside or swipe left: drawer closes cleanly without freezing body scroll.
  - **Invariants:** Zero horizontal scrollbar on body; navigation links completely identical between desktop and mobile.

- **TC-UX-02: Header Command Palette (`⌘K`) & Notification Bell**
  - **Viewports:** `VP-D1`, `VP-M2`
  - **Steps:**
    1. On desktop, press `⌘K` (or `Ctrl+K`) or click search bar: Command palette dialog opens with instant search for contacts, properties, and navigation shortcuts.
    2. Type `"Rohan"`: highlights contact `Rohan Mehra` and provides direct keyboard jump to `/inbox?c=...`.
    3. On mobile, tap search icon in `TopAppBar`: opens full-screen or sheet command search with touch-friendly results.
    4. Click notification bell icon: popover displays unread notifications with timestamps and direct links; "Mark all as read" clears badge in real-time.
  - **Invariants:** Popover stays strictly within viewport boundaries on mobile; does not clip off-screen.

- **TC-UX-03: Theme Mode & Accent Dynamic Switcher**
  - **Viewports:** `VP-D1`, `VP-M2`
  - **Steps:**
    1. Open Theme Switcher (in Header or Settings Appearance).
    2. Switch between **Light** and **Dark** modes:
       - Inspect all text contrast: no gray-on-gray or white-on-white text.
       - Popovers, dialogs, and cards maintain WCAG AA contrast (minimum 4.5:1).
    3. Cycle through accent colors: **Violet**, **Emerald**, **Blue**, **Rose**, **Amber**.
       - Verify primary buttons, active nav pills, focus rings, and chart accents adopt the chosen accent color immediately without page reload.
  - **Invariants:** No hardcoded hex color overrides the selected accent token.

---

### Phase 2: Shared Multi-Agent Inbox & Real-Time Chat (`/inbox`)
Verify multi-agent communication hub, message bubbles, lead sidebar, and real estate modals.

- **TC-UX-04: Inbox 3-Pane to Mobile Push-Pop Navigation**
  - **Viewports:** `VP-D1`, `VP-M1`, `VP-M2`
  - **Steps:**
    1. On `VP-D1`, verify 3-pane layout: Conversation List (`w-80` to `w-96`), Message Thread (`flex-1`), and Contact Info Sidebar (`w-80` to `w-96`).
    2. In Conversation List, verify tabs: **Mine**, **Unassigned**, **All** with unread count badges.
    3. Switch to `VP-M2` (`390px`):
       - Viewport displays ONLY Conversation List.
       - Tap conversation for `Rohan Mehra`: smoothly transitions to Message Thread view.
       - Top bar in Message Thread shows contact name, phone, assigned agent avatar, and a prominent Back button (`<`).
       - Tap Back button: returns to Conversation List with previous scroll position preserved.
       - In Message Thread, tap contact header or info icon: opens Contact Info as a slide-over `Sheet` or bottom `Drawer`.
  - **Invariants:** No horizontal overflow; all contact actions (call, reassign, qualify) fully accessible on mobile.

- **TC-UX-05: Message Bubble Extreme Text & Media Overflow**
  - **Viewports:** `VP-M1`, `VP-M2`, `VP-D1`
  - **Steps:**
    1. Inject an ultra-long message body (1,000 characters with mixed Hindi/English text).
    2. Inject an unspaced continuous string (`https://rebel-tipping-prenatal.ngrok-free.dev/very/long/unbroken/path/parameter?token=123456789012345678901234567890`).
    3. Inject WhatsApp media messages: Image, PDF Document, Audio Voice Note, Location card, Interactive Button.
    4. Verify:
       - Chat bubble dynamically sizes to content with `max-w-[85%]` on mobile and `max-w-[70%]` on desktop.
       - Long text breaks cleanly using `break-words` and `break-all` on URLs without stretching the thread.
       - Media cards scale proportionally without overflowing message bubble container.
       - Voice note audio player controls are fully tappable on mobile without clipping playback slider.
  - **Invariants:** Chat thread horizontal scrollbar is NEVER triggered by wide messages.

- **TC-UX-06: Message Composer & Quick Action Pickers**
  - **Viewports:** `VP-M2`, `VP-D1`
  - **Steps:**
    1. In Message Composer, verify:
       - Auto-expanding textarea (grows up to 5 lines then scrolls vertically).
       - Quick action buttons: Template Picker (`FileText`), Quick Replies (`Zap`), AI Co-pilot Reply (`Sparkles`), Media Attach (`Paperclip`), Emoji picker.
    2. Tap Template Picker on mobile: opens touch-friendly bottom sheet with search and parameter inputs.
    3. Tap "Generate AI Reply": suggestion streams directly into composer with clear "Accept" / "Discard" controls.
    4. On mobile with virtual keyboard active: composer stays docked above keyboard (`interactive-widget=resizes-content` / sticky bottom).
  - **Invariants:** Composer buttons do not wrap awkwardly or crowd out the send button.

- **TC-UX-07: Contact Sidebar: Real Estate Qualification & Action Modals**
  - **Viewports:** `VP-D1`, `VP-M2`
  - **Steps:**
    1. In Contact Sidebar, verify Real Estate Qualification panel:
       - Budget Range (₹ INR formatted inputs).
       - BHK Multiselect chips (`1BHK`, `2BHK`, `3BHK`, `4BHK`, `Penthouse`).
       - Preferred Locations dropdown/chips.
       - Possession Timeline buttons (`Ready to Move`, `Under Construction`, `Within 1 Year`).
    2. Click **"Schedule Visit"**: opens `ScheduleVisitSheet`.
       - On desktop: clean right-side slide-over sheet.
       - On mobile: bottom sheet drawer with date picker, property selector, and driver pickup checkbox.
       - Test form submission: toast confirmation appears, sheet closes smoothly.
    3. Click **"Send Cost Sheet"**: opens `CostSheetModal`.
       - Verify calculation breakdown (Base Rate, Floor Rise, Parking, GST 5%, Stamp Duty 6%, Total).
       - Table renders cleanly on mobile without horizontal clipping.
       - 1-tap "Share via WhatsApp" inserts formatted cost summary into composer.
  - **Invariants:** Modals never exceed viewport height; submit buttons remain visible without scrolling off screen.

---

### Phase 3: Real Estate Pipeline & Deals Management (`/pipelines`)
Verify deals Kanban board, list view, stage drag/drop, and mobile stage navigation.

- **TC-UX-08: Kanban Multi-Column to Mobile Stage Swiper**
  - **Viewports:** `VP-D1`, `VP-T1`, `VP-M2`
  - **Steps:**
    1. On `VP-D1` (`1440px`), verify Kanban board displays all 5 standard stages in horizontal columns (`New Lead`, `Contacted`, `Site Visit Scheduled`, `Negotiation`, `Won / Lost`).
    2. Drag deal card from `New Lead` to `Site Visit Scheduled`: smooth drag preview with `@dnd-kit`, drop updates column count and total value in header.
    3. Switch to `VP-M2` (`390px`):
       - Multi-column drag board transforms into a **Segmented Stage Switcher** or **Horizontal Carousel**.
       - Stage tabs display stage name, deal count badge, and cumulative stage value (e.g., `Site Visit (4) • ₹4.8 Cr`).
       - Deals render as vertical stacked cards with contact name, property badge, deal value, assigned agent avatar, and SLA indicator.
       - Each card includes a 1-tap "Move Stage" menu to advance deals without requiring precision touch drag-and-drop.
    4. Switch to Table View (`?view=table`):
       - Renders responsive table with sorting by Value, Stage, and Age.
       - On mobile, horizontal scrolling is smooth with fixed deal title column.
  - **Invariants:** Deal values always formatted in Indian numbering (`₹1.65 Cr`, `₹85 Lakh`); no layout crushing on tablet.

- **TC-UX-09: Deal Creation & Lost Reason Dialog Hardening**
  - **Viewports:** `VP-M2`, `VP-D1`
  - **Steps:**
    1. Click "+ Add Deal" button:
       - Dialog opens with fields: Deal Title, Contact (autocomplete), Property (autocomplete), Value (₹), Stage select, Assigned Agent select.
       - On mobile: inputs have `44px` height with clear labels and touch-friendly dropdown options.
    2. Move deal to `Lost` stage:
       - `LostReasonModal` intercepts action.
       - Displays radio group of Indian real estate reasons (`Budget Mismatch`, `Preferred Different Location`, `Competitor Deal Closed`, `Loan Rejection`, `Dropped Plan`).
       - Required "Lost Notes" textarea.
       - Confirm submission: deal moves to lost, modal closes, audit trail logged.
  - **Invariants:** Closing modal without selecting reason cancels the stage move and restores card to original column.

---

### Phase 4: Contact Directory & Lead Intelligence (`/contacts`)
Verify contacts roster, multi-criteria filtering, CSV import/export, and contact detail drawer.

- **TC-UX-10: Contact Roster Responsive Transformation**
  - **Viewports:** `VP-D1`, `VP-M2`
  - **Steps:**
    1. On `VP-D1`, verify full data table with columns: Checkbox, Name & Phone, Lead Score / Status, Tags, Budget & BHK Preference, Assigned Agent, Created Date, Actions.
    2. On `VP-M2` (`390px`), verify table transforms into a touch-optimized card list:
       - Card shows Contact Name, WhatsApp quick chat icon, Lead Temperature badge, assigned agent pill, and budget summary.
       - Tap card: opens Contact Detail view.
    3. Test Search & Filter bar:
       - Search input with debounce and instant clear `(X)` button.
       - Filter trigger opens sheet with filters: Tag multiselect, Status, Assigned Agent, Budget range.
       - Active filter pills display above list with 1-tap remove.
  - **Invariants:** Empty search returns custom empty state illustration with "Clear search" CTA.

- **TC-UX-11: CSV / Excel Bulk Import Modal Hardening**
  - **Viewports:** `VP-D1`, `VP-M2`
  - **Steps:**
    1. Click "Import Contacts" button:
       - Step 1: File dropzone (supports drag & drop on desktop, file picker on mobile).
       - Step 2: Column mapping preview (matches `Name`, `Phone`, `Email`, `Budget`, `BHK`).
       - Step 3: Duplicate resolution strategy (`Update existing`, `Skip duplicates`).
    2. Test mapping preview with a 15-column wide CSV:
       - Mapping table has responsive horizontal scroll container without breaking modal boundaries.
    3. Submit import: progress bar displays percent completed; completion summary renders total imported / updated / skipped.
  - **Invariants:** Modal scrollbar is contained internally; footer buttons remain docked at bottom.

---

### Phase 5: Property Inventory & RERA Management (`/properties`)
Verify real estate property catalog, BHK/carpet area filters, share modal, and property edit form.

- **TC-UX-12: Property Catalog Responsive Grid & Card Layout**
  - **Viewports:** `VP-D1`, `VP-T1`, `VP-M2`
  - **Steps:**
    1. On `VP-D1`, verify 3-column responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`).
    2. On `VP-M2` (`390px`), cards stack cleanly in a single column (`grid-cols-1`).
    3. Inspect Property Card components:
       - Property Image carousel / thumbnail with "Ready to Move" or "Under Construction" badge.
       - Title, Location / Submarket (`Powai, Mumbai`).
       - Price formatted in Crores/Lakhs (`₹1.65 Cr - ₹2.10 Cr`).
       - Specs row: Configuration chips (`2BHK`, `3BHK`), Carpet Area (`1,250 sq ft`), Facing (`East`).
       - RERA ID badge with verified checkmark.
       - Action buttons: "Share via WhatsApp", "View Details", "Edit" (admin/owner only).
    4. Test filter bar: BHK toggle buttons, price range slider, location autocomplete.
  - **Invariants:** Card heights align uniformly across rows; image placeholders render gracefully when media is missing.

- **TC-UX-13: Property Share Modal & In-App CRM Chat Deep Link**
  - **Viewports:** `VP-D1`, `VP-M2`
  - **Steps:**
    1. Click "Share via WhatsApp" on `Apex Grandeur`:
    2. Modal displays:
       - Formatted WhatsApp message copy preview with specs, pricing, and brochure link.
       - Select Contact dropdown (searches existing CRM leads).
       - Two action buttons:
         - **"Open External WhatsApp"** (`wa.me` deep link).
         - **"Chat in CRM"** (routes directly to `/inbox?c=...` with pre-filled message text in composer).
    3. Test on mobile: modal adapts to bottom sheet; buttons have large tap targets.
  - **Invariants:** Deep link preserves pre-filled text and contact parameters without truncation.

---

### Phase 6: Site Visits & Field Logistics (`/site-visits`)
Verify site visit scheduler, calendar vs table view, pickup logistics, and status progression.

- **TC-UX-14: Site Visit Calendar vs Table View on Mobile**
  - **Viewports:** `VP-D1`, `VP-M2`
  - **Steps:**
    1. On `VP-D1`, verify toggle between **Calendar View** and **List/Table View**.
    2. In Calendar View: site visits displayed on monthly/weekly grid with colored status chips.
    3. Switch to `VP-M2` (`390px`):
       - Calendar automatically switches to an **Agenda / Daily Timeline View** (avoiding unreadable squished 7-column calendar grids).
       - Timeline card shows visit time, customer name, property title, assigned sales agent, and pickup badge (`🚗 Cab Required`).
    4. Test status transition dropdown:
       - Move visit from `Scheduled` -> `In Progress` -> `Completed` / `Cancelled`.
       - Status badge changes color smoothly (`Sky` -> `Amber` -> `Emerald` / `Rose`).
  - **Invariants:** Customer phone number provides 1-tap `tel:` and `wa.me` action buttons on mobile.

---

### Phase 7: Broadcast Campaigns & Template Sender (`/broadcasts`)
Verify 4-step broadcast wizard, audience segmentation, variable mapping, and analytics dashboard.

- **TC-UX-15: Broadcast 4-Step Wizard Ergonomics on Mobile**
  - **Viewports:** `VP-D1`, `VP-M2`
  - **Steps:**
    1. Click "+ New Broadcast":
    2. Inspect Step Indicator:
       - Desktop: Horizontal step progress bar (`1. Template -> 2. Audience -> 3. Variables -> 4. Review & Send`).
       - Mobile: Compact numbered indicator or step counter (`Step 2 of 4`).
    3. Step 1 (Template): Search and select Meta-approved template with live WhatsApp bubble preview.
    4. Step 2 (Audience): Filter contacts by Tag, Budget, or BHK preference; displays real-time recipient count badge (`Recipients: 42`).
    5. Step 3 (Variables): Dynamic input rows for `{{1}}`, `{{2}}` variables (supports fallback text and merge tags like `{{contact.name}}`).
    6. Step 4 (Review & Send): Summary card showing total cost estimate, audience size, and scheduled send toggle.
  - **Invariants:** Wizard navigation buttons ("Back", "Next") remain fixed at bottom of viewport on mobile; variable inputs do not trigger horizontal scrolling.

---

### Phase 8: Automation Rules & Visual Flow Builder (`/automations`, `/flows`)
Verify automation list, trigger-action editor, and React Flow visual canvas adaptability.

- **TC-UX-16: Visual Flow Builder Touch Canvas & Inspector (`/flows/[id]`)**
  - **Viewports:** `VP-D1`, `VP-T1`, `VP-M2`
  - **Steps:**
    1. On `VP-D1`, verify React Flow canvas (`@xyflow/react`):
       - Node palette on left (`Trigger`, `WhatsApp Message`, `Conditional Branch`, `Assign Agent`, `Add Tag`).
       - Canvas with grid, zoom controls, mini-map, and auto-layout button (`dagre`).
       - Right-side Node Inspector panel on node click.
    2. Switch to `VP-M2` (`390px`):
       - Mini-map hides automatically to prevent canvas occlusion.
       - Floating action button to add nodes.
       - Tap node: Node Inspector opens as a slide-up bottom sheet instead of crowding the screen with a side panel.
       - Pinch-to-zoom and two-finger pan work smoothly without page bouncing.
  - **Invariants:** Nodes do not overlap; text inside flow nodes wraps cleanly without truncation.

---

### Phase 9: Portal Integrations & Third-Party Lead Capture (`/integrations`)
Verify Indian real estate portal cards, webhook connection details, and error states.

- **TC-UX-17: Portal Card Grid & Setup Dialogs**
  - **Viewports:** `VP-D1`, `VP-M2`
  - **Steps:**
    1. Navigate to `/integrations`.
    2. Verify portal cards: **99acres**, **MagicBricks**, **Housing.com**, **Meta Lead Ads**, **Custom Webhooks**.
    3. Each card displays: Portal Logo, Connection Status badge (`Connected` / `Not Configured`), Universal Capture Email, and "Configure" button.
    4. Click "Configure" on MagicBricks:
       - Modal displays API Key input, Webhook Secret, and live webhook URL with 1-click copy button.
       - Test 1-click copy: toast feedback appears, copied string verified in clipboard.
  - **Invariants:** Copyable URLs wrap with `break-all` on mobile so they never push the card wider than the viewport.

---

### Phase 10: AI Co-Pilot & Real Estate Knowledge Base (`/agents`)
Verify AI playground, knowledge base document upload, and token usage cards.

- **TC-UX-18: AI Playground Chat Interface & Knowledge Manager**
  - **Viewports:** `VP-D1`, `VP-M2`
  - **Steps:**
    1. On `VP-D1`, verify 2-tab view: **Playground** and **Knowledge Base**.
    2. In Playground tab:
       - Model selector dropdown (`Gemini 2.5 Pro`, `GPT-4o`, `Claude 3.5 Sonnet`).
       - System prompt configuration preview.
       - Interactive chat stream: user prompt input and streaming bot response with property recommendations.
    3. In Knowledge Base tab:
       - PDF / Document upload dropzone.
       - Chunked knowledge index list with status badges (`Indexed`, `Processing`).
    4. On `VP-M2` (`390px`): chat interface fills height with docked input above keyboard; document table renders as stacked list with delete action.
  - **Invariants:** AI message markdown renders bullet lists, bold text, and currency correctly without layout glitches.

---

### Phase 11: Team Leaderboard, Targets & Print Reporting (`/team`)
Verify member performance cards, role badges, work distribution, and print layout.

- **TC-UX-19: Team Performance Grid & Print-Optimized Layout (`?print=true`)**
  - **Viewports:** `VP-D1`, `VP-M2`, Print Preview
  - **Steps:**
    1. On `VP-D1`, verify team roster cards:
       - Agent Avatar, Name, Email, Role badge (`Owner`, `Admin`, `Agent`, `Viewer`).
       - Availability switch (`Available` / `On Leave`).
       - Target Progress Bar: Deals Closed (₹ Value) vs Target, Conversion Rate %, Open Conversations count.
    2. On `VP-M2` (`390px`), cards stack cleanly with touch-friendly availability toggles.
    3. Test Print Report: click "Print Report" or navigate to `/team?print=true`:
       - `@media print` stylesheet activates:
       - Desktop sidebar, top header, bottom nav, action buttons, and availability toggles hide completely.
       - Content shifts to clean black-and-white print typography with tabular metrics.
       - Page breaks configured cleanly without splitting agent cards mid-page.
  - **Invariants:** Print preview produces 0 blank trailing pages; interactive widgets do not appear in print.

---

### Phase 12: Notification Center & Activity Feed (`/notifications`, `/dashboard`)
Verify real-time notification list, unread filtering, KPI metric cards, and Tremor charts.

- **TC-UX-20: Notification Center & Jump Links**
  - **Viewports:** `VP-D1`, `VP-M2`
  - **Steps:**
    1. Navigate to `/notifications`.
    2. Verify notification feed:
       - Notification icons: `UserPlus` (Lead assigned), `MessageSquare` (New inbound message), `Calendar` (Site visit reminder), `DollarSign` (Deal won).
       - Timestamp (`just now`, `10m ago`, `yesterday`).
       - Unread indicator dot.
    3. Filter tabs: **All** vs **Unread**.
    4. Click notification item:
       - Marks as read in real-time.
       - Directly routes user to destination (`/inbox?c=...` or `/site-visits`).
    5. Click "Mark all as read": header badge counter clears instantly.
  - **Invariants:** Empty notification list displays cheerful empty illustration and text.

- **TC-UX-21: Executive Dashboard KPIs & Chart Responsiveness (`/dashboard`)**
  - **Viewports:** `VP-D1`, `VP-T1`, `VP-M2`
  - **Steps:**
    1. On `VP-D1`, verify top 4 metric cards:
       - Total Active Leads, Closed Revenue (₹ Cr), Pipeline Conversion %, Avg First Response Time.
       - Sparkline trend indicators (+14% vs last month).
    2. Verify charts (Recharts / Tremor):
       - Deal Funnel Donut chart.
       - Inbound WhatsApp Volume Area chart.
       - Agent Leaderboard Bar chart.
    3. Switch to `VP-M2` (`390px`):
       - Metric cards stack in 1 column (`grid-cols-1`) or 2x2 grid (`grid-cols-2`).
       - Chart wrappers resize dynamically (`ResponsiveContainer width="100%"`).
       - Tooltips trigger accurately on touch press without getting stuck on screen.
  - **Invariants:** Chart text labels never overlap or clip outside SVG viewbox.

---

### Phase 13: Settings Information Architecture & Sub-Panels (`/settings`)
Verify settings left rail, 14 sub-panels, Indian real estate cost sheet configuration, and RBAC visibility.

- **TC-UX-22: Settings Left Rail to Mobile Selector**
  - **Viewports:** `VP-D1`, `VP-M2`
  - **Steps:**
    1. On `VP-D1`, verify left settings rail with grouped sections:
       - Account: `Overview`, `Your profile`, `Login & security`, `Appearance`.
       - Workspace: `WhatsApp`, `Templates`, `Quick replies`, `Fields & tags`, `Deals`, `Members`, `API`, `Routing`, `Billing`, `Cost sheet`.
    2. Switch to `VP-M2` (`390px`):
       - Left rail transforms into a **Horizontal Scrollable Pill Strip** or **Category Dropdown Menu**.
       - Active section highlighted clearly.
    3. Test RBAC tab restriction:
       - Login as Agent (`agent1@apexrealty.in`).
       - Navigate to `/settings?tab=members` or `?tab=billing`.
       - Displays clean localized "Access Restricted" state with "Go to Profile Settings" button without breaking layout.
  - **Invariants:** Active tab query parameter `?tab=` stays in sync with browser URL on selection.

- **TC-UX-23: Indian Cost Sheet Configuration UI (`/settings?tab=cost-sheet`)**
  - **Viewports:** `VP-D1`, `VP-M2`
  - **Steps:**
    1. Navigate to `/settings?tab=cost-sheet` as Admin.
    2. Verify configuration card with fields:
       - Base Rate (₹ per sq ft input with ₹ prefix).
       - Floor Rise Rate (₹ per sq ft per floor).
       - Floor Rise Threshold (Start floor number).
       - Covered Car Parking (₹ flat).
       - Statutory GST % (default `5%`).
       - Stamp Duty % (default `6%`).
       - Registration Fee (₹ flat).
    3. Test on mobile: numeric inputs use `inputmode="numeric"`; labels and helper texts wrap cleanly.
    4. Click "Save Cost Sheet Settings": toast confirmation appears; updated rates propagate to `/inbox` cost sheet calculator.
  - **Invariants:** Invalid inputs (negative numbers, non-numeric characters) blocked with inline error feedback.

---

### Phase 14: Authentication, Invitation & Onboarding Flows
Verify login, signup, forgot password, invite acceptance, and PWA offline screens.

- **TC-UX-24: Auth Card Responsive Centering & Input Focus**
  - **Viewports:** `VP-D1`, `VP-M1`, `VP-M2`
  - **Steps:**
    1. Open `/login`, `/signup`, `/forgot-password`.
    2. Verify:
       - Clean centered card with brand logo, title, description, and OAuth / email-password form.
       - Password reveal toggle icon (`Eye` / `EyeOff`) with touch-friendly hit area.
       - Focus states: clear primary ring on active input (`ring-2 ring-primary`).
       - On mobile: card fills horizontal space with safe margin (`mx-4`); virtual keyboard does not push submit button out of reach.
    3. Open `/join/[token]` (team invitation flow):
       - Displays inviter organization name, invited email, role badge, and password creation fields.
    4. Open `/offline` (PWA offline fallback):
       - Displays offline icon, helpful message, and "Try Reconnecting" button.
  - **Invariants:** 100% localized via `next-intl` across `en`, `es`, `ko`, `pt`.

---

### Phase 15: Centralized Design Tokens, Theming & Typography Audit
Perform static and visual audit across all components to eliminate ad-hoc CSS.

- **TC-UX-25: Elimination of Hardcoded Hex Colors & Arbitrary Styles**
  - **Tool:** Automated Grep / Codebase Scan
  - **Check:**
    1. Scan all files in `src/components/` and `src/app/` for hardcoded hex colors (`#[0-9a-fA-F]{3,6}`) outside `globals.css` and chart palettes.
    2. Scan for raw arbitrary Tailwind styles (e.g., `text-[#...]`, `bg-[#...]`).
    3. Replace any identified rogue styles with semantic design tokens:
       - Bad: `className="bg-[#1e293b] text-[#ffffff]"`
       - Good: `className="bg-card text-card-foreground border-border"`
    4. Verify dark mode contrast across all 25 modal dialogs and dropdown menus.
  - **Invariants:** `npm run build` and `npm run lint` pass with 0 errors.

---

## 4. UI/UX Feature Gaps, Duplications & Omission Audit Checklist

During test execution, Gemini must audit the codebase against this master checklist to identify and rectify discrepancies:

| # | Route / Component | Inspection Category | Expected Design & Behavior | Common Gap / Anti-Pattern to Flag |
| :- | :--- | :--- | :--- | :--- |
| **1** | `/settings?tab=api` | **Missing UI** | Dedicated Outbound Webhooks management card with URL input, event multiselect, secret reveal, and active endpoint roster. | Only API Keys table present; webhooks require curl/API. |
| **2** | `/inbox` (Thread) | **Edge Case** | Continuous unspaced URLs or long text strings break cleanly with `break-all` / `break-words`. | Unbroken string pushes composer or thread wider than screen. |
| **3** | `/pipelines` | **Mobile UX** | Mobile view offers segmented stage switcher or swipe carousel with 1-tap "Move Stage" action. | Squished 5-column Kanban board requiring horizontal pinch/zoom. |
| **4** | `/contacts` | **Missing UI** | Empty state with illustrative SVG and "+ Add Contact" CTA when search/filters return 0 records. | Blank white/dark container with no guidance. |
| **5** | `/properties` | **Feature Clutter** | Clean 3-column card grid with uniform card heights and responsive specs row. | Cards vary wildly in height depending on description length. |
| **6** | Global Modals | **Layout Breakage** | Modal maximum height bounded (`max-h-[90vh]`) with scrollable body and fixed footer buttons. | Submit button scrolls below bottom of mobile screen. |
| **7** | Data Tables | **Layout Breakage** | Horizontal scroll container (`overflow-x-auto`) with fixed left identifier column on mobile. | Table clips off-screen or causes entire webpage to wobble horizontally. |
| **8** | Color System | **Visual Consistency**| 100% semantic token usage (`bg-card`, `text-primary`, `border-border`). | Rogue hardcoded hex values (`#10b981`, `#3b82f6`) bypassing theme. |
| **9** | Status Badges | **Visual Consistency**| Unified color semantics across Deals, Leads, Visits, and Agent Presence. | Hot lead is amber in one component and red in another. |
| **10**| Mobile Shell | **Mobile UX** | `BottomNav` padded with `pb-safe` for iPhone home indicator bar. | Bottom buttons overlap with iPhone swipe home gesture bar. |

---

## 5. Automated Verification & Inspection Procedures

To execute this testing plan autonomously, Gemini should run these commands and inspection steps:

### 5.1 Static Codebase Audits (Lint, Types, Parity & Rogue Hex Scan)
```bash
# 1. Typecheck and lint validation
npm run typecheck
npm run lint

# 2. Strict i18n parity check across all 4 locales (en, es, ko, pt)
npm run test i18n/messages.test.ts

# 3. Rogue Hex Color Audit: Find any hardcoded hex colors in components
git grep -E '#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}' src/components/ src/app/ \
  ':!src/app/globals.css' ':!src/lib/themes.ts'

# 4. Check for unhandled overflow in chat and tables
git grep -n "overflow-x" src/components/
```

### 5.2 Browser Subagent Multi-Viewport Visual Inspection
For each phase, invoke `browser_subagent` with specific viewport parameters:
```bash
# Small Mobile (iPhone SE): 375x667
# Standard Mobile (iPhone 15): 390x844
# Tablet Portrait: 768x1024
# Desktop Standard: 1440x900
```
Inspect DOM bounding boxes, verify no elements have `scrollWidth > clientWidth` on the root container, and ensure touch targets satisfy the `44px` minimum requirement.
