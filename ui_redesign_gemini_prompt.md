# WaCRM UI Redesign — Agent Execution Prompt

> **HOW TO USE:** Copy everything below the horizontal rule and paste it as your prompt to Gemini (or any coding agent). Attach/reference the `ui_redesign_plan.md` file as context.

---

---

## YOUR TASK

You are updating the visual UI/UX of a Next.js real estate CRM called **WaCRM** to match a new design system inspired by the Zakell demo screens. This is a **pure visual/layout update** — no APIs, no database schema, no routing, no business logic, and no auth flows are changed. Every data fetch, Supabase query, hook, and RLS policy must remain completely untouched.

The full redesign specification is in `ui_redesign_plan.md` (attached). Execute it phase by phase, in order, verifying the app compiles after each phase before continuing.

---

## CRITICAL: READ THESE BEFORE WRITING ANY CODE

### 1. Stack (exact — do not assume defaults)
- **Framework:** Next.js 16.3.5 App Router + Turbopack
- **React:** 19.2.4
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`) — **not v3**. Class utilities and config differ from v3. Check existing files before inventing utilities.
- **Components:** shadcn with `style: "base-nova"` built on **`@base-ui/react`** — **NOT Radix UI**. Do not import from `@radix-ui/*`. Check `src/components/ui/*.tsx` for actual component APIs before using them.
- **Icons:** `lucide-react` only. Do not import from other icon libraries.
- **i18n:** `next-intl` — every user-facing string must go through message keys, never hardcoded. Add any new strings to `messages/en.json` (and `es.json`, `ko.json`, `pt.json`) first, then use `useTranslations()` or `getTranslations()` to consume them.
- **Fonts:** Currently Geist (via `next/font/local`). When swapping to Inter, use `next/font/google` — **do not** add a `<link>` tag to HTML directly.
- **Toasts:** `sonner` via `components/themed-toaster.tsx`. Do not add new toast libraries.
- **Drag & drop on pipelines:** `@dnd-kit/core` + `@dnd-kit/sortable`. Do not replace or remove this.

### 2. Absolute DO NOT TOUCH list
Modifying any of these without an explicit reason is a critical failure:

| What | Why |
|---|---|
| `supabase/migrations/` | Never edit existing migrations. No new migrations needed for this UI task. |
| `src/app/api/**` | All API route handlers — untouched |
| `src/middleware.ts` | Has a critical wedged-session fix. Leave it. |
| `src/lib/auth/**` | Role checks, API auth — untouched |
| `src/lib/rate-limit.ts` | Intentional in-memory design — untouched |
| `src/hooks/**` | All hooks (useAuth, useTotalUnread, etc.) — untouched |
| RLS policies | Never loosen, remove, or rewrite any Supabase RLS policy |
| `messages/*.json` key hierarchy | Add new keys only. Never rename or restructure existing ones. |
| `AGENTS.md` `<!-- BEGIN:nextjs-agent-rules -->` block | Tool-managed, leave intact |

### 3. Safe to create (new files)
- `src/components/layout/announcement-banner.tsx`
- `src/components/layout/page-header.tsx`
- `src/components/ui/source-badge.tsx`
- `src/components/ui/status-badge.tsx`
- `src/lib/avatar-color.ts`

### 4. Files to modify (and what NOT to break in each)

| File | What to preserve |
|---|---|
| `src/app/globals.css` | All dark mode token values, all existing token names, all accent theme variable names |
| `src/app/layout.tsx` | Metadata exports, font loading logic, `next-intl` provider, script execution order |
| `src/app/(dashboard)/layout.tsx` | Route group structure, `DashboardShell` import, children prop |
| `src/app/(dashboard)/dashboard-shell.tsx` | All auth logic (`useAuth`, `useRouter`), loading states, mobile sidebar state |
| `src/components/layout/sidebar.tsx` | All auth/role checks, `useAuth` hook usage, `useTotalUnread` hook, `useUnreadNotifications` hook, sign-out handler, availability toggle and its API call |
| `src/components/layout/header.tsx` | `useAuth` hook, availability toggle and its `fetch('/api/account/members/...')` call, sign-out, ModeToggle (keep it in settings or header, do not delete) |
| `src/app/(dashboard)/contacts/page.tsx` | All `supabase.from(...)` queries, all state management, all toast calls, pagination logic, filter logic, bulk delete logic |
| `src/app/(dashboard)/site-visits/page.tsx` | All data fetching, status update handlers, all existing props/types |
| `src/app/(dashboard)/pipelines/**` | All `@dnd-kit` drag logic, all deal CRUD handlers, all Supabase queries |
| `src/app/(dashboard)/integrations/page.tsx` | Portal connection logic, all fetch calls |
| `src/app/(dashboard)/dashboard/page.tsx` | All `loadMetrics`, `loadActivity`, `loadPipelineDonut` calls and their state, `range` selector logic |

---

## PHASE-BY-PHASE EXECUTION INSTRUCTIONS

Execute phases in this exact order. After each phase, verify the dev server compiles without errors (`npm run dev` should show no compilation errors in the terminal, and the page should render in the browser).

---

### PHASE 1 — CSS Design Tokens (`src/app/globals.css`)

**Goal:** Switch light mode to a clean white/blue palette matching the demo.

**Rules:**
- Only edit the `html[data-mode='light']` block — do NOT touch the `:root, html[data-mode='dark']` block.
- Do NOT rename any existing token names — only change values.
- Add the new `html[data-theme='blue']` block AFTER all existing theme blocks.
- Add source badge color tokens at the end of the light mode block.

**Changes:**

In `html[data-mode='light']`, update these token values:
```css
--background: #F9FAFB;
--foreground: #111827;
--card: #FFFFFF;
--card-2: #F9FAFB;
--card-foreground: #111827;
--popover: #FFFFFF;
--popover-foreground: #111827;
--secondary: #F3F4F6;
--secondary-foreground: #1F2937;
--muted: #F3F4F6;
--muted-foreground: #6B7280;
--accent: #F3F4F6;
--accent-foreground: #1F2937;
--border: #E5E7EB;
--input: #E5E7EB;
--sidebar: #FFFFFF;
--sidebar-foreground: #111827;
--sidebar-accent: #EFF6FF;
--sidebar-accent-foreground: #1D4ED8;
--sidebar-border: #E5E7EB;
--status-new: #2563EB;
--status-contacted: #7C3AED;
--status-site-visit: #0D9488;
--status-negotiation: #D97706;
--status-closed: #16A34A;
```

Add new blue accent theme block (after all existing accent theme blocks):
```css
html[data-theme='blue'] {
  --primary: #2563EB;
  --primary-foreground: #FFFFFF;
  --primary-hover: #1D4ED8;
  --primary-soft: rgba(37, 99, 235, 0.10);
  --primary-soft-2: rgba(37, 99, 235, 0.18);
  --ring: #2563EB;
  --chart-1: #2563EB;
  --sidebar-primary: #2563EB;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-ring: #2563EB;
}
```

**Verification:** Run dev server. Navigate to any page. The background should be white/light gray. If you see dark backgrounds, the `data-mode` default hasn't been set yet — that's Phase 1b.

---

### PHASE 1b — Default Mode + Accent (`src/app/layout.tsx`)

Find the inline `<script>` that sets `document.documentElement.dataset.mode`. Change the fallback:
```diff
- document.documentElement.dataset.mode = saved || 'dark';
+ document.documentElement.dataset.mode = saved || 'light';
```

Find the script that sets `dataset.theme` and change its fallback:
```diff  
- document.documentElement.dataset.theme = saved || 'violet';
+ document.documentElement.dataset.theme = saved || 'blue';
```

**⚠️ Important:** If there is no `localStorage` key saved yet, users will now see light/blue. Existing users with a saved preference are unaffected (their preference is preserved).

---

### PHASE 1c — Inter Font (`src/app/layout.tsx`)

Import Inter via `next/font/google` and assign it to `--font-sans`. Keep the existing Geist Mono for code:
```tsx
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// In <html> className, add: inter.variable
```

Do NOT remove the existing GeistMono import if it's used elsewhere. Only add Inter.

---

### PHASE 2 — Announcement Banner

Create `src/components/layout/announcement-banner.tsx`:
- Dismissible gradient blue→purple strip
- Reads/writes `localStorage` key `'wacrm-banner-v1-dismissed'`
- Shows: emoji + text + "Start free →" button + X close button
- Renders `null` on SSR (use `useEffect` to check localStorage)

Wire into `src/app/(dashboard)/layout.tsx` as first child before `<DashboardShell>`. Import and add `<AnnouncementBanner />`.

**⚠️ Important:** The layout.tsx may be a server component. If `AnnouncementBanner` uses `'use client'`, that is fine — it will be a client boundary inside a server layout.

---

### PHASE 3 — Sidebar Redesign (`src/components/layout/sidebar.tsx`)

**What to change:**
1. Logo area — replace with white panel, square icon + wordmark
2. Nav item rendering — add `emoji` field to navItems array, update active state classes to `bg-primary/10 text-primary` (active) vs `text-muted-foreground hover:bg-muted` (inactive)
3. Sidebar width — change to `w-44` (176px)
4. Footer user chip — compact `Avatar + name + role`

**What NOT to change:**
- The `ROLE_CHIP` object — keep it
- The `useAuth()` hook call and all destructured values
- The `useTotalUnread()` hook call
- The `useUnreadNotifications()` hook call
- The `signOut()` handler
- The availability `Switch` toggle and its state/handler
- The `adminOnly` filtering logic on nav items
- The mobile drawer open/close logic
- Any `useEffect` already in the file

**Nav items:** Add `emoji` field to the `NavItem` interface and `navItems` array. Render the emoji as a `<span>` before the label text. The Lucide icon can be kept as a fallback or removed from the nav row (the emoji replaces it visually). Keep the icon type in the interface for potential future use.

---

### PHASE 4 — Header Redesign (`src/components/layout/header.tsx`)

**What to change:**
1. Add a global search input in the center of the header (desktop only, `hidden md:flex`)
2. Restyle the right-side user controls: compact `Avatar + firstName + ChevronDown` chip
3. Add a notification dot on the bell icon when there are unread notifications

**What NOT to change:**
- The `useAuth()` hook and all its destructured values
- The availability toggle `Switch` and its `handleAvailabilityChange` function (keep it in the dropdown)
- The `signOut()` handler
- The `ModeToggle` component import and usage (move it inside the dropdown if needed, but do NOT delete it)
- The `onOpenSidebar` prop and the hamburger `<button>` (keep for mobile)

**New i18n key needed:**
Add to `messages/en.json` (and es/ko/pt):
```json
"Header": {
  "searchPlaceholder": "Search leads, properties..."
}
```
(Check if `Header` namespace already exists in the file — if yes, add the key to the existing object.)

---

### PHASE 5 — PageHeader Component

Create `src/components/layout/page-header.tsx`:
```tsx
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}
export function PageHeader({ title, subtitle, action }: PageHeaderProps) { ... }
```

This component is a pure presentational wrapper. No hooks, no data fetching.

---

### PHASE 6 — SourceBadge Component

Create `src/components/ui/source-badge.tsx`.

Source keys to handle (these are the exact values stored in `lead_details.source` in the database):
`'99acres'`, `'magicbricks'`, `'HousingCom'`, `'no_broker'`, `'referral'`, `'walk_in'`, `'whatsapp_inbound'`, `'manual'`, `null`

Display labels:
- `99acres` → "99acres" (red)
- `magicbricks` → "MagicBricks" (orange)
- `HousingCom` → "Housing.com" (green)
- `no_broker` → "NoBroker" (blue)
- `referral` → "Referral" (purple)
- `walk_in` → "Walk-in" (amber)
- `whatsapp_inbound` → "WhatsApp" (green)
- `manual` or null → "Manual" (gray)

Use Tailwind color classes (`bg-red-100 text-red-600` etc.) — do NOT use inline CSS hex values.

---

### PHASE 7 — StatusBadge Component

Create `src/components/ui/status-badge.tsx`.

Status values (these are pipeline stage `name` values from the database):
`'New'`, `'Contacted'`, `'Site Visit'`, `'Negotiation'`, `'Closed'`, `'Won'`

Pill style, full rounded, Tailwind classes only.

---

### PHASE 8 — Avatar Color Utility

Create `src/lib/avatar-color.ts`:
- `avatarColorForName(name: string): string` — deterministic color from 8-color palette
- `initialsForName(name: string): string` — up to 2 initials, uppercase

Pure functions, no side effects, no imports from the rest of the codebase.

---

### PHASE 9 — Dashboard Page Redesign

**File:** `src/app/(dashboard)/dashboard/page.tsx`

**What to keep intact (absolutely):**
- All `useState` declarations and their initial values
- All `useEffect` blocks and their dependency arrays
- All calls to: `loadMetrics()`, `loadActivity()`, `loadConversationseries()`, `loadPipelineDonut()`, `loadResponseTime()`, `getFollowupsDueCount()`
- The `range` state and `RangeDays` type
- The `{ defaultCurrency }` from `useAuth()`
- The `TeamSetupChecklist` component usage
- All `setMetrics`, `setActivity`, `setFollowups`, etc. state setters

**What to change (visual only):**
1. Page header → use `PageHeader` component with greeting ("Good morning, {firstName} 👋") and "+ Add Lead" button
2. Stat cards layout → 4-column grid, emoji icon above number, trend text below label
3. Recent Leads section → flat list rows with Avatar, name+HOT badge, location, SourceBadge, StatusBadge, action icons
4. Right column → `TodayVisitsWidget` + `TodayTasksWidget` stacked (these can be extracted as local sub-components within the same file or new component files)
5. Remove charts/graphs if they're not in the demo layout (but keep the data queries — they may be used elsewhere or re-added later)

**Data to use for the new widgets:**
- Recent Leads: fetch from `contacts` joined with `deals` and `lead_details` — reuse the existing Supabase client already in the file
- Today's Visits: fetch from `site_visits` where `scheduled_at` is today — use existing client
- Today's Tasks: use the `tasks` table seeded earlier

**New strings needed in `messages/en.json`** (add to `Dashboard.page`):
```json
"greeting": "Good morning",
"greetingEvening": "Good evening",
"hotLeadsNotice": "{count} hot leads need your attention",
"recentLeads": "Recent Leads",
"viewAll": "View all",
"todayVisits": "Today's Visits",
"todayTasks": "Today's Tasks",
"addLead": "+ Add Lead",
"pendingCount": "{count} pending"
```

---

### PHASE 10 — Contacts/Leads Page Redesign

**File:** `src/app/(dashboard)/contacts/page.tsx`

**What to keep intact:**
- All Supabase queries (contacts, tags, conversations, profiles joins)
- Pagination state (`page`, `totalPages`, `totalCount`)
- Filter state (`searchQuery`, `selectedTags`, `selected`)
- All `handleDeleteContact`, `handleBulkDelete` functions
- Modal open/close state (`showDeleteModal`, `showBulkDeleteModal`, `showImportModal`, etc.)
- All toast calls
- The `BulkReassignModal`, `ContactForm`, `ImportContactsModal`, `CustomFieldsModal` component usages

**What to change:**
1. Table columns reordered to: `LEAD | SOURCE | LOCATION | BUDGET | STATUS | LAST CONTACT | ACTIONS`
2. LEAD cell: Avatar circle (use `avatarColorForName`) + name + phone + HOT badge (if `tag=hot-lead`)
3. SOURCE cell: `<SourceBadge source={contact.lead_details?.source} />`
4. LOCATION cell: `contact.lead_details?.location_preference`
5. BUDGET cell: formatted budget range from lead_details
6. STATUS cell: `<StatusBadge status={dealStageName} />` (derive from deals)
7. LAST CONTACT cell: relative date from `contact.updated_at`
8. ACTIONS cell: three icon buttons (MessageCircle, Phone, Pencil) that trigger existing handlers
9. Page header → use `<PageHeader>` with title "Leads", subtitle, and Add Contact button

**Data shape:** The contacts query already joins `lead_details` (confirmed from earlier inspection). If `lead_details` is not in the select query, add it as a sub-select `lead_details(source, location_preference, budget_min, budget_max, configuration_preference)`.

---

### PHASE 11 — Site Visits Page Redesign

**File:** `src/app/(dashboard)/site-visits/page.tsx`

**What to keep intact:** All data fetching, status update handlers, form modals, all state.

**What to change:**
1. Page header → `<PageHeader>` with title, subtitle ("N visits scheduled"), and Schedule Visit button
2. Visit list rows → date block (TODAY/TOMORROW/date + time in colored rounded box) + contact name + property with 📍 icon + status badge + action icons
3. Visit status badge colors: confirmed=green, pending=amber, no_show=red, rescheduled=blue, completed=gray

---

### PHASE 12 — Pipeline Kanban Redesign

**Files:** `src/app/(dashboard)/pipelines/` directory

**What to keep intact:**
- ALL `@dnd-kit` drag-and-drop logic (`DndContext`, `SortableContext`, `useSortable`, `DragOverlay`)
- All deal CRUD handlers
- All Supabase queries
- Column/stage data shape

**What to change (visual only):**
1. Column header: stage name in stage color + count badge in matching color (not just white text)
2. Deal cards: Avatar circle + name + location + `<SourceBadge>` + budget range
3. "+ Add Lead" dashed button at bottom of each column
4. Stage color map using the demo's exact colors (New=blue, Contacted=purple, Site Visit=teal, Negotiation=amber, Closed=green)

---

### PHASE 13 — Integrations Page Redesign

**File:** `src/app/(dashboard)/integrations/page.tsx`

**What to keep intact:** All portal connection fetch logic, connect/disconnect handlers, all API calls.

**What to change:**
1. Add Universal Email Capture card at the top (blue-bordered info card with copy button)
2. Portal grid cards: portal icon + connected status + name + Manage/Connect CTA
3. "Coming Soon" state for WhatsApp Business and Instagram portals

---

### PHASE 14 — Content Area Spacing

**File:** `src/app/(dashboard)/layout.tsx`

Update the `<main>` content wrapper to use `px-6 py-6 md:px-8 md:py-7` padding. Ensure `max-w-7xl mx-auto` wraps content for large screens.

---

## VERIFICATION CHECKLIST

After completing ALL phases, run in this order:

```bash
npm run typecheck   # Must pass with 0 errors
npm run lint        # Must pass (fix any warnings about unused imports)
npm run format      # Auto-fix formatting
npm run test        # All 1023 tests must still pass
```

Then manually verify in browser (at `http://localhost:3000`):

- [ ] App loads in light mode by default (white background, not dark)
- [ ] Sidebar shows blue active state for current page
- [ ] Dashboard shows greeting + 4 stat cards + recent leads list
- [ ] Contacts/Leads page shows table with Source badge and Status pill columns
- [ ] Site Visits shows date block + property name + status badge
- [ ] Pipeline kanban shows colored column headers + deal cards with source badge
- [ ] Integrations shows portal grid with connection status
- [ ] Announcement banner appears at top and can be dismissed
- [ ] Sign-out still works
- [ ] Availability toggle in header/sidebar still works and calls the API
- [ ] Dark mode toggle still switches the app to dark (test via Settings)
- [ ] No console errors of type `MISSING_MESSAGE` (i18n)
- [ ] No console errors of type `TypeError` or `ReferenceError`
- [ ] Drag-and-drop on pipeline kanban still works
- [ ] Contact detail view still opens when clicking a contact
- [ ] Adding a new deal still works
- [ ] The Export CSV button on Contacts page still works

---

## STYLE RULES

1. **Class strings:** Use Tailwind utility classes. For colors not in the design token set, use Tailwind's color palette classes directly (`bg-red-100 text-red-600`) rather than inline CSS.
2. **New i18n strings:** Every user-visible string in a new component gets a message key. Add to all 4 locale files (`en`, `es`, `ko`, `pt`). For `es`/`ko`/`pt`, use the English value if you're unsure of the translation — the key must exist in all files.
3. **No new dependencies:** Do not `npm install` anything. Use only what's already in `package.json`.
4. **No `any` types:** Use proper TypeScript types. Check existing files for the established type patterns (e.g., `Contact`, `Deal`, `SiteVisit` types are in `src/lib/` modules).
5. **Responsive:** Desktop (sidebar visible) and mobile (bottom nav) must both still work. The new design is primarily a desktop redesign. Mobile layout changes are secondary — do not break the existing mobile `<BottomNav>` and `<TopAppBar>`.
6. **Component size:** If a new component is getting long (>150 lines), split it into subcomponents in the same file or a new file in the same directory.

---

## COMMON MISTAKES TO AVOID

| Mistake | Prevention |
|---|---|
| Importing from `@radix-ui/*` | Check `src/components/ui/` for the actual component — it's `@base-ui/react` |
| Using `className="text-gray-900"` where a token exists | Use `text-foreground` instead |
| Hardcoding `#FFFFFF` as inline style | Use `bg-card` or `bg-white` Tailwind class |
| Forgetting `'use client'` on new interactive components | Any component with hooks or event handlers needs it |
| Breaking the `data-mode` attribute system | Don't add `className="dark"` to html — the existing system uses `data-mode` attribute |
| Removing the `ModeToggle` component | Keep it accessible somewhere (Settings or header dropdown) |
| Using `router.push()` for external links | Use `<a href>` or `<Link>` appropriately |
| Adding `@apply` in CSS | Tailwind v4 in this repo does NOT use `@apply` in the same way — check existing CSS patterns first |

---

## DEFINITION OF DONE

A phase is complete only when:
1. The dev server compiles without errors after the change
2. The affected page renders correctly in the browser
3. No existing functionality is broken on that page
4. No TypeScript errors introduced (`npm run typecheck`)
5. Any new user-facing string has been added to all 4 locale files
