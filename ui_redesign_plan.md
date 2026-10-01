# UI/UX Redesign Implementation Plan

### Visual Refresh — Inspired by Zakell Demo Screens

> **Scope:** Pure visual/layout update — no API changes, no routing changes, no database changes.
> **Upstream safety:** Only files under `src/components/layout/`, `src/app/globals.css`, `src/components/dashboard/`, and specific page files are touched. Migration SQL files and API routes are not modified.

---

## Design System Extracted from Demo Screens

### Color Palette

| Token               | Value                                       | Usage                    |
| ------------------- | ------------------------------------------- | ------------------------ |
| Background          | `#FFFFFF`                                   | Page & sidebar           |
| Surface/Card        | `#FFFFFF` border `#E5E7EB`                  | All cards                |
| Sidebar bg          | `#F9FAFB` (very light gray)                 | Left nav panel           |
| Primary Blue        | `#2563EB` (blue-600)                        | CTAs, active nav, badges |
| Text Primary        | `#111827`                                   | Headings                 |
| Text Secondary      | `#6B7280`                                   | Subtitles, meta          |
| Border              | `#E5E7EB`                                   | Cards, rows              |
| HOT badge           | `#EF4444` pill                              | Lead HOT flag            |
| Status: New         | `#DBEAFE` / `#2563EB` text                  | Pipeline status          |
| Status: Contacted   | `#EDE9FE` / `#7C3AED` text                  | Pipeline status          |
| Status: Site Visit  | `#CCFBF1` / `#0D9488` text                  | Pipeline status          |
| Status: Negotiation | `#FEF3C7` / `#D97706` text                  | Pipeline status          |
| Status: Closed      | `#DCFCE7` / `#16A34A` text                  | Pipeline status          |
| 99acres badge       | `#FEE2E2` / `#DC2626`                       | Source badge             |
| MagicBricks badge   | `#FFEDD5` / `#EA580C`                       | Source badge             |
| Housing.com badge   | `#D1FAE5` / `#059669`                       | Source badge             |
| NoBroker badge      | `#EFF6FF` / `#3B82F6`                       | Source badge             |
| Manual badge        | `#F3F4F6` / `#6B7280`                       | Source badge             |
| Announcement bar    | `linear-gradient(90deg, #2563EB → #7C3AED)` | Top banner               |

### Typography

- **Font:** `Inter` (Google Fonts) — currently the app may use Geist; swap to Inter
- **Page title:** `font-semibold text-2xl text-gray-900`
- **Page subtitle:** `text-sm text-gray-500`
- **Nav items:** `text-sm font-medium`
- **Table headers:** `text-xs font-semibold uppercase tracking-wider text-gray-400`
- **Card number:** `text-3xl font-bold text-gray-900`
- **Card label:** `text-sm text-gray-500`

### Spacing & Radius

- **Sidebar width:** `176px` (fixed on desktop)
- **Content padding:** `px-8 py-6`
- **Card radius:** `rounded-xl` (12px)
- **Badge radius:** `rounded-full` pill
- **Button radius:** `rounded-lg` for regular, `rounded-full` for pill CTA
- **Row height:** `~64px` comfortable

---

## Phase 1 — Design Token Override (globals.css)

**File:** [`src/app/globals.css`](file:///home/ayush/Documents/Projects/wacrm/src/app/globals.css)

**Strategy:** The app has a `data-mode='light'` block. We update only the light mode tokens to match the demo palette. Dark mode tokens are untouched (preserves upstream patches).

### Changes to `html[data-mode='light']` block

```diff
html[data-mode='light'] {
-  --background: oklch(0.99 0.002 260);
-  --foreground: oklch(0.21 0.01 260);
-  --card: oklch(1 0 0);
-  --card-2: oklch(0.985 0.002 260);
-  --sidebar: oklch(0.985 0.002 260);
-  --border: oklch(0.922 0.004 260);
-  --muted: oklch(0.967 0.003 260);
-  --muted-foreground: oklch(0.52 0.015 260);
+  --background: #F9FAFB;          /* page bg — very light gray */
+  --foreground: #111827;          /* gray-900 */
+  --card: #FFFFFF;
+  --card-2: #F9FAFB;
+  --sidebar: #FFFFFF;             /* sidebar white */
+  --border: #E5E7EB;              /* gray-200 */
+  --muted: #F3F4F6;               /* gray-100 */
+  --muted-foreground: #6B7280;    /* gray-500 */

  /* Keep status tokens crisp for light mode */
-  --status-new: oklch(0.7 0.1 260);
-  --status-contacted: oklch(0.7 0.15 293);
-  --status-site-visit: oklch(0.75 0.15 65);
-  --status-negotiation: oklch(0.85 0.15 85);
-  --status-closed: oklch(0.65 0.15 162);
+  --status-new: #2563EB;
+  --status-contacted: #7C3AED;
+  --status-site-visit: #0D9488;
+  --status-negotiation: #D97706;
+  --status-closed: #16A34A;
}
```

### Add new semantic tokens (append after light block)

```css
/* RE vertical portal source badge colors — light mode */
html[data-mode='light'] {
  --source-99acres-bg: #fee2e2;
  --source-99acres-text: #dc2626;
  --source-magicbricks-bg: #ffedd5;
  --source-magicbricks-text: #ea580c;
  --source-housingcom-bg: #d1fae5;
  --source-housingcom-text: #059669;
  --source-nobroker-bg: #eff6ff;
  --source-nobroker-text: #3b82f6;
  --source-manual-bg: #f3f4f6;
  --source-manual-text: #6b7280;
  --source-referral-bg: #fdf4ff;
  --source-referral-text: #9333ea;
  --source-walkin-bg: #fff7ed;
  --source-walkin-text: #ea580c;
}
```

### Switch default mode to light

In [`src/app/layout.tsx`](file:///home/ayush/Documents/Projects/wacrm/src/app/layout.tsx), find the boot script that sets `data-mode`. Change default from `'dark'` to `'light'`:

```diff
- document.documentElement.dataset.mode = saved || 'dark';
+ document.documentElement.dataset.mode = saved || 'light';
```

### Switch accent to blue

```diff
- document.documentElement.dataset.theme = saved || 'violet';
+ document.documentElement.dataset.theme = saved || 'blue';
```

And add `html[data-theme='blue']` accent block in `globals.css`:

```css
html[data-theme='blue'] {
  --primary: #2563eb;
  --primary-foreground: #ffffff;
  --primary-hover: #1d4ed8;
  --primary-soft: rgba(37, 99, 235, 0.1);
  --primary-soft-2: rgba(37, 99, 235, 0.18);
  --ring: #2563eb;
  --chart-1: #2563eb;
  --sidebar-primary: #2563eb;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-ring: #2563eb;
}
```

---

## Phase 2 — Announcement Banner

**New file:** `src/components/layout/announcement-banner.tsx`

A dismissible full-width gradient strip above the sidebar+content. It auto-hides after dismiss (stored in `localStorage`).

```tsx
// announcement-banner.tsx
'use client';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AnnouncementBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('banner-v1-dismissed');
    setVisible(!dismissed);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="flex items-center justify-center gap-3 px-4 py-2 text-sm text-white"
      style={{ background: 'linear-gradient(90deg, #2563EB 0%, #7C3AED 100%)' }}
    >
      <span>🚀</span>
      <span>
        Agent Demo Mode — Explore freely. No login required.{' '}
        <button className="ml-2 rounded-full border border-white/40 px-3 py-0.5 text-xs font-semibold hover:bg-white/10">
          Start free →
        </button>
      </span>
      <button
        className="ml-auto p-1 hover:opacity-70"
        onClick={() => {
          localStorage.setItem('banner-v1-dismissed', '1');
          setVisible(false);
        }}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
```

**Wire into layout:** In [`src/app/(dashboard)/layout.tsx`](<file:///home/ayush/Documents/Projects/wacrm/src/app/(dashboard)/layout.tsx>) add `<AnnouncementBanner />` as first child before the shell `<div>`.

> **Upstream safety:** This is a purely additive new component. Layout.tsx changes are minimal (one import + one JSX line).

---

## Phase 3 — Sidebar Redesign

**File:** [`src/components/layout/sidebar.tsx`](file:///home/ayush/Documents/Projects/wacrm/src/components/layout/sidebar.tsx)

### 3a. Logo area

Replace the current logo markup with a Zakell-style icon + wordmark:

```tsx
{
  /* Logo */
}
<div className="border-border flex items-center gap-2 border-b px-4 py-5">
  <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white">
    W
  </div>
  <span className="text-foreground text-base font-semibold">WaCRM</span>
</div>;
```

### 3b. Nav item style

Replace Lucide icon imports with emoji + Lucide hybrid. The demo uses emoji for top-level RE nav items. Update `navItems` to carry an optional `emoji` field:

```ts
const navItems: NavItem[] = [
  {
    href: '/dashboard',
    labelKey: 'dashboard',
    icon: LayoutDashboard,
    emoji: '📊',
  },
  { href: '/contacts', labelKey: 'contacts', icon: Users, emoji: '👥' }, // Leads in demo
  {
    href: '/site-visits',
    labelKey: 'visits',
    icon: CalendarCheck,
    emoji: '🏠',
  },
  { href: '/pipelines', labelKey: 'pipelines', icon: GitBranch, emoji: '📈' },
  { href: '/inbox', labelKey: 'inbox', icon: MessageSquare, emoji: '💬' },
  { href: '/broadcasts', labelKey: 'broadcasts', icon: Radio, emoji: '📣' },
  {
    href: '/integrations',
    labelKey: 'integrations',
    icon: Plug,
    emoji: '🔌',
    adminOnly: true,
  },
  { href: '/automations', labelKey: 'automations', icon: Zap, emoji: '⚡' },
  {
    href: '/flows',
    labelKey: 'flows',
    icon: Workflow,
    emoji: '🔀',
    beta: true,
  },
  { href: '/agents', labelKey: 'aiAgents', icon: Bot, emoji: '🤖' },
  { href: '/properties', labelKey: 'properties', icon: Building, emoji: '🏢' },
  {
    href: '/team',
    labelKey: 'team',
    icon: UsersRound,
    emoji: '👤',
    adminOnly: true,
  },
];
```

### 3c. Nav item rendering

```tsx
// Replace current nav item rendering with:
<Link
  key={item.href}
  href={item.href}
  className={cn(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-primary/10 text-primary'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  )}
>
  <span className="text-base leading-none">{item.emoji}</span>
  <span>{t(item.labelKey)}</span>
  {/* Unread badge (inbox/notifications) */}
  {item.href === '/inbox' && unreadCount > 0 && (
    <span className="bg-primary ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  )}
</Link>
```

### 3d. Sidebar footer

Replace current profile strip with a compact user chip:

```tsx
{
  /* Footer: user info */
}
<div className="border-border border-t p-3">
  <div className="flex items-center gap-2">
    <Avatar className="h-7 w-7">
      <AvatarImage src={profile?.avatar_url ?? undefined} />
      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
    </Avatar>
    <div className="min-w-0 flex-1">
      <p className="text-foreground truncate text-xs font-medium">
        {profile?.full_name}
      </p>
      <p className="text-muted-foreground truncate text-[10px]">
        {accountRoleChip}
      </p>
    </div>
  </div>
</div>;
```

### 3e. Sidebar width

Change from current width to exactly `176px`:

```tsx
// Outer sidebar wrapper class
className={cn(
  'fixed inset-y-0 left-0 z-50 flex w-44 flex-col border-r border-border bg-sidebar',
  // ... mobile drawer classes
)}
```

> **Upstream safety:** The sidebar's logic (auth, role checks, unread hooks) stays identical. Only class strings and the nav item array change.

---

## Phase 4 — Header Redesign

**File:** [`src/components/layout/header.tsx`](file:///home/ayush/Documents/Projects/wacrm/src/components/layout/header.tsx)

### 4a. Global search bar

Add a search input in the header center (currently absent on desktop):

```tsx
{/* Center: Global search */}
<div className="hidden md:flex flex-1 max-w-sm mx-8">
  <div className="relative w-full">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
    <input
      type="text"
      placeholder={t('searchPlaceholder')}  {/* "Search leads, properties..." */}
      className="w-full rounded-lg border border-border bg-muted py-1.5 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
    />
  </div>
</div>
```

### 4b. Right-side user avatar

Replace the current right-side controls with the demo's compact chip:

```tsx
{
  /* Right: Bell + User chip */
}
<div className="flex items-center gap-2">
  <button className="hover:bg-muted relative rounded-lg p-2">
    <Bell className="text-muted-foreground size-4" />
    {unreadNotifs > 0 && (
      <span className="bg-primary absolute top-1 right-1 h-2 w-2 rounded-full" />
    )}
  </button>
  <DropdownMenu>
    <DropdownMenuTrigger className="hover:bg-muted flex items-center gap-2 rounded-lg px-2 py-1.5">
      <Avatar className="h-7 w-7">
        <AvatarImage src={profile?.avatar_url ?? undefined} />
        <AvatarFallback className="bg-primary text-xs text-white">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="text-foreground hidden text-sm font-medium md:block">
        {firstName}
      </span>
      <ChevronDown className="text-muted-foreground size-3.5" />
    </DropdownMenuTrigger>
    {/* ... existing dropdown items unchanged ... */}
  </DropdownMenu>
</div>;
```

### 4c. Header height

Change from current `h-14` to `h-13` (`52px`):

```tsx
className =
  'sticky top-0 z-40 flex h-13 items-center border-b border-border bg-card px-4 md:px-6';
```

> **Upstream safety:** ModeToggle component is removed from the header (it can move to Settings). All auth/sign-out logic inside the dropdown stays untouched.

---

## Phase 5 — Page-Level Header Pattern

Create a reusable component used by every page:

**New file:** `src/components/layout/page-header.tsx`

```tsx
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode; // "+ Add Lead" button etc.
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between pb-5">
      <div>
        <h1 className="text-foreground text-2xl font-semibold">{title}</h1>
        {subtitle && (
          <p className="text-muted-foreground mt-0.5 text-sm">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
```

**Usage in pages:**

```tsx
<PageHeader
  title="Leads"
  subtitle="7 total leads in your pipeline"
  action={
    <Button className="bg-primary rounded-full px-4 text-sm">+ Add Lead</Button>
  }
/>
```

**Apply to pages:** Contacts, Pipelines, Site Visits, Properties, Integrations, Dashboard.

> **Upstream safety:** This is purely additive. Pages just swap their existing `<h1>` + subtitle markup for `<PageHeader>`.

---

## Phase 6 — Source Badge Component

**New file:** `src/components/ui/source-badge.tsx`

Used on Leads/Contacts list and Pipeline kanban cards:

```tsx
const SOURCE_CONFIG: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  '99acres': { bg: 'bg-red-100', text: 'text-red-600', label: '99acres' },
  magicbricks: {
    bg: 'bg-orange-100',
    text: 'text-orange-600',
    label: 'MagicBricks',
  },
  HousingCom: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    label: 'Housing.com',
  },
  no_broker: { bg: 'bg-blue-100', text: 'text-blue-600', label: 'NoBroker' },
  referral: { bg: 'bg-purple-100', text: 'text-purple-600', label: 'Referral' },
  walk_in: { bg: 'bg-orange-50', text: 'text-orange-500', label: 'Walk-in' },
  whatsapp_inbound: {
    bg: 'bg-green-50',
    text: 'text-green-600',
    label: 'WhatsApp',
  },
  manual: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Manual' },
};

export function SourceBadge({ source }: { source: string | null }) {
  const cfg = source
    ? (SOURCE_CONFIG[source] ?? SOURCE_CONFIG['manual'])
    : SOURCE_CONFIG['manual'];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        cfg.bg,
        cfg.text
      )}
    >
      {cfg.label}
    </span>
  );
}
```

---

## Phase 7 — Status Badge Component

**New file:** `src/components/ui/status-badge.tsx`

Replaces inline stage/status coloring across contacts, pipeline cards, and dashboard lists:

```tsx
const STATUS_CONFIG = {
  New: { bg: 'bg-blue-100', text: 'text-blue-700' },
  Contacted: { bg: 'bg-purple-100', text: 'text-purple-700' },
  'Site Visit': { bg: 'bg-teal-100', text: 'text-teal-700' },
  Negotiation: { bg: 'bg-amber-100', text: 'text-amber-700' },
  Closed: { bg: 'bg-green-100', text: 'text-green-700' },
  Won: { bg: 'bg-green-100', text: 'text-green-700' },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
  };
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
        cfg.bg,
        cfg.text
      )}
    >
      {status}
    </span>
  );
}
```

---

## Phase 8 — Dashboard Page Redesign

**File:** [`src/app/(dashboard)/dashboard/page.tsx`](<file:///home/ayush/Documents/Projects/wacrm/src/app/(dashboard)/dashboard/page.tsx>)

### 8a. Greeting header

```tsx
<div className="flex items-center justify-between pb-6">
  <div>
    <h1 className="text-foreground text-2xl font-semibold">
      Good morning, {firstName} 👋
    </h1>
    <p className="text-muted-foreground mt-1 text-sm">
      {/* "Here's your pipeline today. {N} hot leads need your attention." */}
      Here&apos;s your pipeline today.{' '}
      <Link
        href="/contacts?tag=hot-lead"
        className="text-primary font-medium underline-offset-2 hover:underline"
      >
        {hotLeadsCount} hot leads
      </Link>{' '}
      need your attention.
    </p>
  </div>
  <Button className="bg-primary rounded-full px-4">+ Add Lead</Button>
</div>
```

### 8b. Stat cards (demo style)

Replace the current `<MetricCard>` with new card design:

```tsx
// New MetricCard design
<div className="border-border bg-card rounded-xl border p-5">
  <div className="mb-3 text-2xl">{emoji}</div>
  <div className="text-foreground text-3xl font-bold">{value}</div>
  <div className="text-muted-foreground mt-1 text-sm">{label}</div>
  <div
    className={cn(
      'mt-2 text-xs font-medium',
      positive ? 'text-green-600' : 'text-red-500'
    )}
  >
    {trend}
  </div>
</div>
```

Stat cards in order: `👥 Active Leads`, `📅 Site Visits Today`, `⚡ Follow-ups Due`, `🏆 Deals Closed`

### 8c. Two-column bottom layout

```
Left (2/3): Recent Leads list
Right (1/3): Today's Visits + Today's Tasks stacked
```

Layout:

```tsx
<div className="mt-6 grid grid-cols-3 gap-6">
  <div className="col-span-2">
    <RecentLeadsList />
  </div>
  <div className="col-span-1 flex flex-col gap-4">
    <TodayVisitsWidget />
    <TodayTasksWidget />
  </div>
</div>
```

### 8d. Recent Leads list row

Each row shows: Avatar circle, Name + HOT badge, location, source badge, status pill, action icons (chat, phone)

```tsx
<div className="border-border flex items-center gap-3 border-b py-3 last:border-0">
  <Avatar className="h-9 w-9 shrink-0">
    <AvatarFallback
      className="text-sm font-medium"
      style={{ background: avatarColor }}
    >
      {initials}
    </AvatarFallback>
  </Avatar>
  <div className="min-w-0 flex-1">
    <div className="flex items-center gap-1.5">
      <span className="text-foreground text-sm font-medium">
        {contact.name}
      </span>
      {isHot && (
        <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 uppercase">
          HOT
        </span>
      )}
    </div>
    <p className="text-muted-foreground truncate text-xs">
      {location} · {budget}
    </p>
  </div>
  <SourceBadge source={source} />
  <StatusBadge status={stageName} />
  <div className="ml-2 flex items-center gap-1.5">
    <button className="hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg p-1.5">
      <MessageCircle className="size-4" />
    </button>
    <button className="hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg p-1.5">
      <Phone className="size-4" />
    </button>
  </div>
</div>
```

### 8e. Today's Visits widget (right column)

```tsx
<div className="border-border bg-card rounded-xl border p-4">
  <div className="mb-3 flex items-center justify-between">
    <h3 className="text-foreground text-sm font-semibold">Today's Visits</h3>
    <span className="text-primary text-xs font-medium">{todayCount} today</span>
  </div>
  {visits.map((v) => (
    <div
      key={v.id}
      className="border-border flex items-center gap-2 border-b py-2 last:border-0"
    >
      <div className="bg-primary/10 min-w-[48px] shrink-0 rounded-lg px-2 py-1 text-center">
        <div className="text-primary text-[9px] font-bold uppercase">TODAY</div>
        <div className="text-primary text-sm font-bold">{time}</div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-xs font-medium">
          {v.contact_name}
        </p>
        <p className="text-muted-foreground truncate text-[10px]">
          📍 {v.property_title}
        </p>
      </div>
      <StatusBadge status={v.status} />
    </div>
  ))}
</div>
```

---

## Phase 9 — Contacts/Leads Page Redesign

**File:** [`src/app/(dashboard)/contacts/page.tsx`](<file:///home/ayush/Documents/Projects/wacrm/src/app/(dashboard)/contacts/page.tsx>)

### 9a. Page header

Use `<PageHeader title="Leads" subtitle="{n} total leads in your pipeline" action={<AddButton/>} />`

### 9b. Filter row

```tsx
<div className="mb-4 flex items-center gap-3">
  <div className="relative max-w-sm flex-1">
    <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
    <input placeholder="Search leads..." className="pl-9 ..." />
  </div>
  <Select>
    <SelectTrigger className="w-36">
      <SelectValue placeholder="All Status" />
    </SelectTrigger>
    ...
  </Select>
</div>
```

### 9c. Table columns

Reorder and rename columns to match demo:

```
LEAD | SOURCE | LOCATION | BUDGET | STATUS | LAST CONTACT | ACTIONS
```

### 9d. Table row

- **LEAD cell:** Avatar circle + Name (bold, with HOT badge if hot) + phone number (gray, smaller)
- **SOURCE cell:** `<SourceBadge source={contact.lead_details?.source} />`
- **LOCATION cell:** `lead_details.location_preference` plain text
- **BUDGET cell:** `₹{budget_min}L–{budget_max}L` formatted
- **STATUS cell:** `<StatusBadge status={dealStageName} />`
- **LAST CONTACT cell:** relative date (`Today`, `2d ago`)
- **ACTIONS cell:** three icon buttons `💬 📞 ✏️`

---

## Phase 10 — Site Visits Page Redesign

**File:** [`src/app/(dashboard)/site-visits/page.tsx`](<file:///home/ayush/Documents/Projects/wacrm/src/app/(dashboard)/site-visits/page.tsx>)

### Visit list row (demo timeline style)

```tsx
<div className="border-border bg-card flex items-center gap-4 rounded-xl border px-5 py-4">
  {/* Date block */}
  <div className="bg-primary/10 w-16 shrink-0 rounded-xl p-3 text-center">
    <div className="text-primary text-[9px] font-bold tracking-wide uppercase">
      {isToday ? 'TODAY' : isTomorrow ? 'TOMORROW' : formattedDate}
    </div>
    <div className="text-primary mt-0.5 text-xl font-bold">
      {hour}:{minute}
    </div>
    <div className="text-primary/70 text-[9px] uppercase">{ampm}</div>
  </div>

  {/* Name + Property */}
  <div className="min-w-0 flex-1">
    <p className="text-foreground font-semibold">{contactName}</p>
    <p className="text-muted-foreground mt-0.5 text-sm">
      📍 {propertyTitle}
      {property?.location ? `, ${property.location}` : ''}
    </p>
  </div>

  {/* Status badge */}
  <VisitStatusBadge status={visit.status} />

  {/* Actions */}
  <div className="text-muted-foreground flex items-center gap-2">
    <button className="hover:bg-muted rounded-lg p-1.5">
      <MessageCircle className="size-4" />
    </button>
    <button className="hover:bg-muted rounded-lg p-1.5">
      <Pencil className="size-4" />
    </button>
  </div>
</div>
```

Visit status badge colors:

- `confirmed` → green pill
- `pending` → yellow/amber pill
- `no_show` → red pill
- `rescheduled` → blue pill
- `completed` → gray pill

---

## Phase 11 — Pipeline Kanban Redesign

**File:** [`src/app/(dashboard)/pipelines/`](<file:///home/ayush/Documents/Projects/wacrm/src/app/(dashboard)/pipelines/>)

### 11a. Column header

```tsx
<div className="mb-3 flex items-center gap-2">
  <span
    className="text-xs font-bold tracking-wider uppercase"
    style={{ color: stageColor }}
  >
    {stageName}
  </span>
  <span
    className="rounded-full px-2 py-0.5 text-xs font-bold"
    style={{ background: `${stageColor}20`, color: stageColor }}
  >
    {dealsInStage.length}
  </span>
</div>
```

Stage color map (matches demo):

```ts
const STAGE_COLORS = {
  New: '#2563EB',
  Contacted: '#7C3AED',
  'Site Visit': '#0D9488',
  Negotiation: '#D97706',
  Closed: '#16A34A',
};
```

### 11b. Deal card

```tsx
<div className="border-border bg-card cursor-grab rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md">
  {/* Avatar + Name row */}
  <div className="mb-2 flex items-center gap-2">
    <Avatar className="h-8 w-8">
      <AvatarFallback className="text-xs" style={{ background: avatarColor }}>
        {initials}
      </AvatarFallback>
    </Avatar>
    <div>
      <p className="text-foreground text-sm font-semibold">{contactName}</p>
      <p className="text-muted-foreground text-xs">{location}</p>
    </div>
  </div>
  {/* Source badge + Budget */}
  <div className="mt-2 flex items-center justify-between">
    <SourceBadge source={leadSource} />
    <span className="text-muted-foreground text-xs font-medium">
      ₹{budgetMin}–{budgetMax}
    </span>
  </div>
</div>
```

### 11c. "+ Add Lead" button per column

```tsx
<button className="border-border text-muted-foreground hover:border-primary hover:text-primary mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed py-2 text-xs transition-colors">
  + Add Lead
</button>
```

---

## Phase 12 — Integrations Page Redesign

**File:** [`src/app/(dashboard)/integrations/page.tsx`](<file:///home/ayush/Documents/Projects/wacrm/src/app/(dashboard)/integrations/page.tsx>)

### 12a. Universal email capture card

```tsx
<div className="mb-6 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
  <div className="flex items-center gap-3">
    <div className="rounded-lg border border-blue-200 bg-white p-2">
      <Mail className="size-5 text-blue-600" />
    </div>
    <div>
      <p className="text-sm font-semibold text-blue-900">
        Your Universal Lead Capture Email
      </p>
      <p className="text-xs text-blue-700">
        Add this as CC in any portal's notification settings to auto-import
        leads
      </p>
    </div>
  </div>
  <div className="flex items-center gap-2">
    <code className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 font-mono text-sm text-blue-700">
      {captureEmail}
    </code>
    <Button size="sm" variant="outline" onClick={handleCopy}>
      {copied ? '✓ Copied' : '📋 Copy'}
    </Button>
  </div>
</div>
```

### 12b. Portal grid cards

```tsx
{
  /* 3-column grid */
}
<div className="grid grid-cols-3 gap-4">
  {portals.map((portal) => (
    <div
      key={portal.slug}
      className="border-border bg-card rounded-xl border p-5"
    >
      {/* Header: icon + connection status */}
      <div className="mb-3 flex items-start justify-between">
        <img
          src={portal.logoUrl}
          alt={portal.name}
          className="h-10 w-10 rounded-lg object-contain"
        />
        {portal.connected ? (
          <span className="text-xs font-medium text-green-600">
            ✓ Connected
          </span>
        ) : portal.comingSoon ? (
          <span className="text-xs font-medium text-orange-500">
            Coming Soon
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">Not Connected</span>
        )}
      </div>
      <p className="text-foreground font-semibold">{portal.name}</p>
      {/* CTA */}
      {portal.connected ? (
        <button className="text-primary mt-2 text-xs font-medium hover:underline">
          🟢 Manage →
        </button>
      ) : (
        !portal.comingSoon && (
          <button className="text-primary mt-2 text-xs font-medium hover:underline">
            + Connect →
          </button>
        )
      )}
    </div>
  ))}
</div>;
```

---

## Phase 13 — Avatar Color System

Consistent deterministic avatar colors (same contact always same color, matches demo's colored initials circles):

**New file:** `src/lib/avatar-color.ts`

```ts
const AVATAR_COLORS = [
  '#EF4444',
  '#F97316',
  '#EAB308',
  '#22C55E',
  '#14B8A6',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
];

export function avatarColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function initialsForName(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
```

---

## Phase 14 — Content Area Layout Spacing

**File:** [`src/app/(dashboard)/layout.tsx`](<file:///home/ayush/Documents/Projects/wacrm/src/app/(dashboard)/layout.tsx>)

Update the main content wrapper padding to match demo's generous whitespace:

```tsx
{
  /* Main content wrapper */
}
<main className="flex-1 overflow-y-auto">
  <div className="mx-auto max-w-7xl px-6 py-6 md:px-8 md:py-7">{children}</div>
</main>;
```

---

## Upstream Safety Rules

> These rules ensure future `git pull` / upstream patches continue to apply cleanly.

| Rule                                                   | Rationale                                                                                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Never touch migration SQL files**                    | Upstream may add new migrations; conflicts here break DB sync                                                                      |
| **Never modify API route handlers** (`src/app/api/**`) | Upstream fixes in API routes should apply cleanly                                                                                  |
| **Never rename or delete existing CSS tokens**         | Only _override values_ of tokens in `globals.css`. Upstream may reference old token names                                          |
| **Keep Tailwind class structure intact**               | Add new classes; don't remove existing conditional class logic from shared components                                              |
| **Source badge + Status badge are new files**          | They don't replace upstream `cn(...)` calls — they layer on top                                                                    |
| **PageHeader is additive**                             | Pages import it optionally; their existing JSX is restructured but class-compatible                                                |
| **The `data-mode` default change**                     | If upstream adds a new dark-mode block, it'll layer correctly since we only change the JS default                                  |
| **Font change**                                        | Add `next/font/google` import for Inter in `layout.tsx`; the `--font-sans` token swap preserves the existing Tailwind font utility |

---

## Execution Order

```
Phase 1  → globals.css tokens + default mode/accent
Phase 2  → AnnouncementBanner component
Phase 3  → Sidebar (logo, nav, footer)
Phase 4  → Header (search, user chip)
Phase 5  → PageHeader component
Phase 6  → SourceBadge component
Phase 7  → StatusBadge component
Phase 13 → Avatar color util
Phase 8  → Dashboard page
Phase 9  → Contacts/Leads page
Phase 10 → Site Visits page
Phase 11 → Pipelines kanban
Phase 12 → Integrations page
Phase 14 → Layout spacing
```

Each phase is independently testable — run `npm run dev` and navigate to that page to verify before moving to the next.

---

## Files Touched Summary

| File                                            | Change type                                        |
| ----------------------------------------------- | -------------------------------------------------- |
| `src/app/globals.css`                           | Modify light-mode tokens, add blue accent block    |
| `src/app/layout.tsx`                            | Change default mode/accent, add Inter font         |
| `src/app/(dashboard)/layout.tsx`                | Add `<AnnouncementBanner>`, adjust content padding |
| `src/components/layout/sidebar.tsx`             | Restyle logo, nav items, footer                    |
| `src/components/layout/header.tsx`              | Add search bar, restyle user chip                  |
| `src/components/layout/announcement-banner.tsx` | **NEW**                                            |
| `src/components/layout/page-header.tsx`         | **NEW**                                            |
| `src/components/ui/source-badge.tsx`            | **NEW**                                            |
| `src/components/ui/status-badge.tsx`            | **NEW**                                            |
| `src/lib/avatar-color.ts`                       | **NEW**                                            |
| `src/app/(dashboard)/dashboard/page.tsx`        | Restyle greeting, stat cards, recent leads list    |
| `src/components/dashboard/metric-card.tsx`      | Restyle card layout                                |
| `src/app/(dashboard)/contacts/page.tsx`         | Restyle table columns, rows                        |
| `src/app/(dashboard)/site-visits/page.tsx`      | Restyle visit list rows                            |
| `src/app/(dashboard)/pipelines/*`               | Restyle kanban column + deal cards                 |
| `src/app/(dashboard)/integrations/page.tsx`     | Restyle portal grid + email capture card           |

**NOT touched:** `src/app/api/**`, `supabase/migrations/**`, `messages/*.json` (i18n keys), `src/hooks/**`, `src/lib/auth/**`
