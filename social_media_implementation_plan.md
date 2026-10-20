# Social Media Module — Implementation Plan (Phases 1–3)

> **For:** Gemini / any agent implementing the Social Media feature in wacrm.
> **Ground truth doc hierarchy:** `AGENT_MASTER_CONTEXT.md` > `docs/agent/ARCHITECTURE.md` > `docs/agent/AGENT_GUARDRAILS.md`.
> Read the relevant source files before touching any directory you haven't touched in this session.
> **Next available migration number: `131`.**

---

## Pre-Implementation Checklist (run before any phase)

- [ ] Read `src/lib/whatsapp/encryption.ts` — you will reuse this exact utility for token encryption.
- [ ] Read `src/app/(dashboard)/integrations/page.tsx` — the Instagram tile is already stubbed as `coming_soon`. This is your Phase 1 connection point.
- [ ] Read `src/app/(dashboard)/broadcasts/page.tsx` — this is the gold-standard pattern for a new dashboard list page (data fetch, loading state, empty state, table, `useCan`, `useTranslations`, `PullToRefresh`).
- [ ] Read `src/components/layout/sidebar.tsx` and `src/components/layout/bottom-nav.tsx` — you will add one item to each.
- [ ] Read `src/lib/auth/roles.ts` — you will add three capability predicates here (`canManageSocialPosts`, `canPublishSocialPost`, `canConnectSocialAccount`).
- [ ] Read one recent migration (e.g., `supabase/migrations/129_deal_lifecycle_fields.sql`) to match RLS and trigger style.

---

## Phase 1 — Connect & Compose (MVP)

**Goal:** Business owner can connect their Instagram Business or Facebook Page account via OAuth. Sales agents can draft posts and submit them for review, while Admins/Owners can publish immediately or approve agent drafts (Workflow Option 3: "Agent Drafts, Admin Publishes").

---

### Step 1.1 — New RBAC Predicates in `roles.ts`

**File:** `src/lib/auth/roles.ts`

Add three new predicates **at the end** of the file, following the existing doc-comment style:

```ts
/**
 * Social media post creation/drafting.
 * - Owner / Admin: full control over social accounts and posts.
 * - Agent: can create and save draft posts, but CANNOT publish live or connect accounts.
 * - Viewer: read-only — can view the post history but not create or publish.
 */
export function canManageSocialPosts(role: AccountRole): boolean {
  return hasMinRole(role, 'agent');
}

/**
 * Social media live publishing & approval.
 * Restricted to Admin / Owner accounts to ensure brand safety.
 * Agents can draft posts, but an Admin or Owner must approve & publish.
 */
export function canPublishSocialPost(role: AccountRole): boolean {
  return hasMinRole(role, 'admin');
}

/**
 * Social account connection: linking/unlinking an Instagram Business
 * or Facebook Page. This is an account-wide credential change —
 * same privilege level as WhatsApp config (admin/owner only).
 */
export function canConnectSocialAccount(role: AccountRole): boolean {
  return hasMinRole(role, 'admin');
}
```

> **Why three predicates? (Workflow Option 3)**
> Posting to the business's public social media is a high-visibility, sensitive action. Sales agents are empowered to draft marketing content and submit it for review, but only Admin and Owner accounts can publish live to Instagram/Facebook or connect/disconnect social accounts. Viewers have read-only access.

---

### Step 1.2 — Database Migration `131_social_accounts.sql`

**File:** `supabase/migrations/131_social_accounts.sql`

```sql
-- ============================================================
-- 131_social_accounts.sql
-- Social media account connections (Instagram, Facebook Page)
-- per business account. Access tokens encrypted at rest with
-- the same ENCRYPTION_KEY used by whatsapp_config.
-- ============================================================

CREATE TYPE social_platform AS ENUM ('instagram', 'facebook');

CREATE TABLE social_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  platform          social_platform NOT NULL,
  -- Human-readable name pulled from Meta Graph API (e.g., "@prestige_homes")
  display_name      TEXT NOT NULL,
  -- Opaque platform user/page ID from Meta Graph API
  platform_user_id  TEXT NOT NULL,
  -- Encrypted long-lived access token (same scheme as whatsapp_config)
  access_token_enc  TEXT NOT NULL,
  -- ISO-8601 expiry for the access token; NULL = non-expiring system token
  token_expires_at  TIMESTAMPTZ,
  -- Profile picture URL pulled from Graph API at connect time
  avatar_url        TEXT,
  -- Soft-disconnect without destroying the row (allows reconnect)
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Required for PostgREST .upsert(..., { onConflict: 'account_id,platform' })
  CONSTRAINT social_accounts_account_platform_key UNIQUE (account_id, platform)
);

-- RLS: same pattern as api_keys, ai_configs, whatsapp_config.
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY social_accounts_tenant_isolation ON social_accounts
  FOR ALL USING (is_account_member(account_id));

-- Read-only access for agents and viewers.
CREATE POLICY social_accounts_agent_read ON social_accounts
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

-- Writes (connect/disconnect) gated to admin+.
CREATE POLICY social_accounts_admin_write ON social_accounts
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));

CREATE POLICY social_accounts_admin_update ON social_accounts
  FOR UPDATE USING (is_account_member(account_id, 'admin'));

-- updated_at trigger
CREATE TRIGGER set_social_accounts_updated_at
  BEFORE UPDATE ON social_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Step 1.3 — Database Migration `132_social_posts.sql`

**File:** `supabase/migrations/132_social_posts.sql`

```sql
-- ============================================================
-- 132_social_posts.sql
-- Social media posts — draft, immediate publish, or scheduled.
-- Scheduling is introduced in Phase 2; the status enum includes
-- 'scheduled' from day one so Phase 2 is a zero-migration add.
-- ============================================================

CREATE TYPE social_post_status AS ENUM (
  'draft',       -- saved but not queued
  'scheduled',   -- Phase 2: queued for future publish
  'publishing',  -- in-flight API call to Meta
  'published',   -- successfully published
  'failed'       -- Meta rejected or network error
);

CREATE TABLE social_posts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  social_account_id   UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  -- Caption text (Instagram: up to 2,200 chars; Facebook: up to 63,206 chars)
  caption             TEXT,
  -- Phase 1: single image URL in Supabase Storage.
  -- Phase 2+: extend to TEXT[] for carousel support.
  media_url           TEXT,
  -- Supabase Storage object path (for deletion/management)
  media_storage_path  TEXT,
  status              social_post_status NOT NULL DEFAULT 'draft',
  -- Phase 2: populated when status = 'scheduled'
  scheduled_at        TIMESTAMPTZ,
  -- Meta's returned post ID (e.g., "17841405338028819_12345") after publish
  platform_post_id    TEXT,
  -- Human-readable error message if status = 'failed'
  failure_reason      TEXT,
  -- Retry counter for the scheduler (Phase 2)
  retry_count         INT NOT NULL DEFAULT 0,
  last_attempt_at     TIMESTAMPTZ,
  -- Author who created the post (defaults to auth.uid())
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for list queries: most recent posts first per account.
CREATE INDEX social_posts_account_created ON social_posts (account_id, created_at DESC);
-- Phase 2: index to efficiently poll for due scheduled posts.
CREATE INDEX social_posts_scheduled ON social_posts (scheduled_at)
  WHERE status = 'scheduled';

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY social_posts_tenant_isolation ON social_posts
  FOR ALL USING (is_account_member(account_id));

CREATE TRIGGER set_social_posts_updated_at
  BEFORE UPDATE ON social_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

> **Storage Setup:** Phase 1 also provisions a public Supabase Storage bucket named `social-media` (max 16MB file limit, PNG/JPG/WebP mime types) with INSERT, SELECT, and UPDATE storage policies.

> After applying both migrations, update `docs/agent/SCHEMA_REFERENCE.md` to add `social_accounts` and `social_posts` to the table inventory and bump the highest migration number to `132`.

---

### Step 1.4 — TypeScript Types

**File:** `src/types/index.ts` — **append** to the bottom, matching the existing doc-comment style.

```ts
// ============================================================
// Social Media
// ============================================================

/**
 * A connected social media account (Instagram or Facebook Page).
 * Access tokens are never returned in this shape — they are
 * decrypted server-side only when an API call needs them.
 */
export interface SocialAccount {
  id: string;
  account_id: string;
  platform: 'instagram' | 'facebook';
  display_name: string;
  platform_user_id: string;
  /** Token expiry as ISO-8601 string. Null means non-expiring. */
  token_expires_at: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type SocialPostStatus =
  'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';

/**
 * A social media post record. `media_url` holds the Supabase
 * Storage public URL. `platform_post_id` is populated after
 * a successful Meta Graph API publish call.
 */
export interface SocialPost {
  id: string;
  account_id: string;
  social_account_id: string;
  caption: string | null;
  media_url: string | null;
  media_storage_path: string | null;
  status: SocialPostStatus;
  scheduled_at: string | null;
  platform_post_id: string | null;
  failure_reason: string | null;
  retry_count: number;
  last_attempt_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Joined from social_accounts */
  social_account?: SocialAccount;
}
```

---

### Step 1.5 — Core Library Module

**File:** `src/lib/social/` (new directory)

Create three files following the `src/lib/whatsapp/` module pattern:

#### `src/lib/social/meta-api.ts`

```ts
/**
 * Meta Graph API helpers for Instagram Content Publishing and
 * Facebook Page Posts.
 *
 * Wraps the Graph API v21.0 endpoints used for social posting.
 * All calls are server-side only (API routes) — never import
 * this module from client components.
 *
 * Endpoint reference:
 *   Instagram: POST /{ig-user-id}/media  → /{ig-user-id}/media_publish
 *   Facebook:  POST /{page-id}/photos or /{page-id}/feed
 */

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface PublishImageResult {
  success: boolean;
  platform_post_id?: string;
  error?: string;
}

/**
 * Publishes a single-image post to an Instagram Business account.
 * Instagram requires a two-step flow:
 *   1. Create a media container (returns a container ID).
 *   2. Publish the container (returns the final media ID).
 */
export async function publishInstagramPost(params: {
  igUserId: string;
  accessToken: string;
  imageUrl: string; // Must be a publicly reachable URL
  caption?: string;
}): Promise<PublishImageResult> {
  // Step 1: Create container
  const containerRes = await fetch(`${GRAPH_BASE}/${params.igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: params.imageUrl,
      caption: params.caption ?? '',
      access_token: params.accessToken,
    }),
  });
  const containerData = await containerRes.json();
  if (!containerRes.ok || !containerData.id) {
    return {
      success: false,
      error: containerData.error?.message ?? 'Container creation failed',
    };
  }

  // Step 2: Publish container
  const publishRes = await fetch(
    `${GRAPH_BASE}/${params.igUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerData.id,
        access_token: params.accessToken,
      }),
    }
  );
  const publishData = await publishRes.json();
  if (!publishRes.ok || !publishData.id) {
    return {
      success: false,
      error: publishData.error?.message ?? 'Publish failed',
    };
  }
  return { success: true, platform_post_id: publishData.id as string };
}

/**
 * Publishes a photo post to a Facebook Page.
 */
export async function publishFacebookPost(params: {
  pageId: string;
  accessToken: string;
  imageUrl: string;
  caption?: string;
}): Promise<PublishImageResult> {
  const res = await fetch(`${GRAPH_BASE}/${params.pageId}/photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: params.imageUrl,
      message: params.caption ?? '',
      access_token: params.accessToken,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.post_id) {
    return { success: false, error: data.error?.message ?? 'Publish failed' };
  }
  return { success: true, platform_post_id: data.post_id as string };
}
```

#### `src/lib/social/encryption.ts`

```ts
/**
 * Social account token encryption/decryption.
 *
 * Delegates to the same AES-GCM helpers already used by
 * src/lib/whatsapp/encryption.ts. Import that module's
 * `encrypt` and `decrypt` directly — do NOT duplicate the
 * cipher logic here. This file is a thin adapter that names
 * the domain clearly so callers stay readable.
 */
export {
  encrypt as encryptToken,
  decrypt as decryptToken,
} from '@/lib/whatsapp/encryption';
```

#### `src/lib/social/accounts.ts`

```ts
/**
 * Server-side helpers for social_accounts table access.
 * These run under the authenticated user's Supabase session
 * (RLS enforced), NOT under a service-role key.
 *
 * The access token is never returned by any of these helpers —
 * decryption only happens inside API routes that need to call Meta.
 */
import { createClient } from '@/lib/supabase/server';
import { SocialAccount } from '@/types';

export async function getActiveSocialAccounts(
  accountId: string
): Promise<SocialAccount[]> {
  const db = await createClient();
  const { data, error } = await db
    .from('social_accounts')
    .select(
      'id, account_id, platform, display_name, platform_user_id, token_expires_at, avatar_url, is_active, created_at, updated_at'
    )
    .eq('account_id', accountId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SocialAccount[];
}
```

---

### Step 1.6 — OAuth API Routes

**Directory:** `src/app/api/social/`

#### `src/app/api/social/connect/route.ts`

Initiates the Meta OAuth flow. Redirects the user to Meta's login dialog.

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { canConnectSocialAccount } from '@/lib/auth/roles';

const META_APP_ID = process.env.META_APP_ID!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_SITE_URL}/api/social/callback`;

export async function GET(request: NextRequest) {
  const { role } = await getCurrentAccount();
  if (!canConnectSocialAccount(role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const platform = request.nextUrl.searchParams.get('platform') ?? 'instagram';
  const scopes =
    platform === 'instagram'
      ? 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement'
      : 'pages_show_list,pages_read_engagement,pages_manage_posts';

  const state = Buffer.from(JSON.stringify({ platform })).toString('base64');
  const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  url.searchParams.set('client_id', META_APP_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', scopes);
  url.searchParams.set('state', state);

  return NextResponse.redirect(url.toString());
}
```

#### `src/app/api/social/callback/route.ts`

Handles the OAuth redirect: exchanges the code for a long-lived token, fetches the platform account details, encrypts the token, and upserts into `social_accounts`.

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { createClient } from '@/lib/supabase/server';
import { encryptToken } from '@/lib/social/encryption';

const META_APP_ID = process.env.META_APP_ID!;
const META_APP_SECRET = process.env.META_APP_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_SITE_URL}/api/social/callback`;

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const rawState = request.nextUrl.searchParams.get('state');
  if (!code || !rawState) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/social-media?error=oauth_cancelled`
    );
  }

  const { platform } = JSON.parse(Buffer.from(rawState, 'base64').toString());
  const { accountId, role } = await getCurrentAccount();
  if (!canConnectSocialAccount(role)) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/social-media?error=forbidden`
    );
  }

  // Exchange short-lived code for long-lived access token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&code=${code}`
  );
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/social-media?error=token_exchange_failed`
    );
  }

  // For Instagram: get the connected Instagram Business Account
  // For Facebook: get the first connected Page
  let platformUserId: string;
  let displayName: string;
  let avatarUrl: string | null = null;
  const accessToken: string = tokenData.access_token;

  if (platform === 'instagram') {
    const meRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`
    );
    const meData = await meRes.json();
    const page = meData.data?.[0];
    if (!page)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/social-media?error=no_page_found`
      );

    const igRes = await fetch(
      `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
    );
    const igData = await igRes.json();
    const igAccount = igData.instagram_business_account;
    if (!igAccount)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/social-media?error=no_ig_account`
      );

    const igDetailRes = await fetch(
      `https://graph.facebook.com/v21.0/${igAccount.id}?fields=name,profile_picture_url&access_token=${page.access_token}`
    );
    const igDetail = await igDetailRes.json();
    platformUserId = igAccount.id as string;
    displayName = (igDetail.name ?? '@instagram_account') as string;
    avatarUrl = (igDetail.profile_picture_url ?? null) as string | null;
  } else {
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`
    );
    const pagesData = await pagesRes.json();
    const page = pagesData.data?.[0];
    if (!page)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/social-media?error=no_page_found`
      );
    platformUserId = page.id as string;
    displayName = (page.name ?? 'Facebook Page') as string;
  }

  const tokenEncrypted = encryptToken(accessToken);
  const tokenExpiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  const db = await createClient();
  const { error } = await db.from('social_accounts').upsert(
    {
      account_id: accountId,
      platform,
      display_name: displayName,
      platform_user_id: platformUserId,
      access_token_enc: tokenEncrypted,
      token_expires_at: tokenExpiresAt,
      avatar_url: avatarUrl,
      is_active: true,
    },
    { onConflict: 'account_id,platform', ignoreDuplicates: false }
  );

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/social-media?error=db_save_failed`
    );
  }

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_SITE_URL}/social-media?connected=${platform}`
  );
}
```

#### `src/app/api/social/publish/route.ts`

Accepts a `social_post` ID, decrypts the token, calls Meta Graph API, and updates the post status.

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { canPublishSocialPost } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/social/encryption';
import {
  publishInstagramPost,
  publishFacebookPost,
} from '@/lib/social/meta-api';

export async function POST(request: NextRequest) {
  const { role, accountId } = await getCurrentAccount();
  // Option 3: Only Admin and Owner accounts can publish live to Meta
  if (!canPublishSocialPost(role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { post_id } = (await request.json()) as { post_id: string };
  const db = await createClient();

  // Fetch post + social account (RLS ensures tenant isolation)
  const { data: post, error: postErr } = await db
    .from('social_posts')
    .select('*, social_account:social_accounts(*)')
    .eq('id', post_id)
    .eq('account_id', accountId)
    .single();

  if (postErr || !post)
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (!post.media_url)
    return NextResponse.json({ error: 'MISSING_MEDIA' }, { status: 400 });

  const accessToken = decryptToken(post.social_account.access_token_enc);

  // Mark as publishing
  await db
    .from('social_posts')
    .update({ status: 'publishing', last_attempt_at: new Date().toISOString() })
    .eq('id', post_id);

  let result;
  if (post.social_account.platform === 'instagram') {
    result = await publishInstagramPost({
      igUserId: post.social_account.platform_user_id,
      accessToken,
      imageUrl: post.media_url,
      caption: post.caption ?? undefined,
    });
  } else {
    result = await publishFacebookPost({
      pageId: post.social_account.platform_user_id,
      accessToken,
      imageUrl: post.media_url,
      caption: post.caption ?? undefined,
    });
  }

  await db
    .from('social_posts')
    .update({
      status: result.success ? 'published' : 'failed',
      platform_post_id: result.platform_post_id ?? null,
      failure_reason: result.error ?? null,
    })
    .eq('id', post_id);

  if (!result.success)
    return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({
    success: true,
    platform_post_id: result.platform_post_id,
  });
}
```

---

### Step 1.7 — Dashboard Route: `/social-media`

**Directory:** `src/app/(dashboard)/social-media/`

#### `src/app/(dashboard)/social-media/page.tsx` (Server Component)

```tsx
import { getCurrentAccount } from '@/lib/auth/account';
import { getActiveSocialAccounts } from '@/lib/social/accounts';
import { createClient } from '@/lib/supabase/server';
import { SocialMediaClient } from './social-media-client';

export const metadata = { title: 'Social Media' };

export default async function SocialMediaPage() {
  const { accountId, role } = await getCurrentAccount();
  const socialAccounts = await getActiveSocialAccounts(accountId);

  const db = await createClient();
  const { data: posts } = await db
    .from('social_posts')
    .select(
      '*, social_account:social_accounts(platform, display_name, avatar_url)'
    )
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <SocialMediaClient
      accountId={accountId}
      role={role}
      socialAccounts={socialAccounts}
      initialPosts={posts ?? []}
    />
  );
}
```

#### `src/app/(dashboard)/social-media/social-media-client.tsx` (Client Component)

This is the main client component. Structure it with these sections (implementing Workflow Option 3: "Agent Drafts, Admin Publishes"):

1. **Header row & KPI strip**:
   - `<h1>Social Media</h1>` + subtitle + `<GatedButton canAct={canManagePosts}>New Post</GatedButton>` (enabled for agent, admin, owner).
   - Situational Awareness KPI strip with 4 metrics: Total Posts, Drafts / Review, Published, Failed.
2. **Connected Accounts strip**:
   - Horizontal scroll row of connected account tiles. Each tile shows avatar, platform icon, display name, and a "Disconnect" button (gated strictly to `canConnectSocialAccount`).
   - Prominent "Connect Account" CTA visible only to admins/owners (`canConnectSocialAccount`).
3. **Post composer sheet (`post-composer-sheet.tsx`)**:
   - Triggered by "New Post". Takes `canPublish` (`useCan('publish-social-post')`).
   - Fields: platform selector, image uploader (Supabase Storage bucket `social-media`), caption textarea with counter.
   - **Agent Draft Workflow:** If user is a sales agent (`!canPublish`), displays an informational alert banner (`composer.agentNotice`) explaining that the post will be submitted for admin review, and the primary CTA is "Submit for Review" (saves as `draft`).
   - **Admin Workflow:** If user is an admin or owner (`canPublish`), displays two actions: "Save Draft" and "Publish Now".
4. **Post history table (`post-history-table.tsx`)**:
   - Desktop: table with columns `Account | Media | Caption | Status | Date | Actions`.
   - Mobile: stacked cards with status badge and actions.
   - **Admin Approval Action:** For posts in `draft` status, Admins/Owners see an inline "Approve & Publish" action button (as well as "Retry" for `failed` posts). Sales agents see draft posts in read-only state.

**Component conventions to match:**

- Use `useCan('manage-social-posts')` and `useCan('publish-social-post')` hooks
- Use `useTranslations('SocialMedia')` for all strings
- Loading state: `<Loader2 className="text-primary h-6 w-6 animate-spin" />`
- Empty state: centered icon + heading + CTA (match broadcasts empty state)
- Wrap outer div in `<PullToRefresh onRefresh={fetchPosts}>`
- Status badges: `draft` → muted/amber badge, `publishing` → amber + pulse dot, `published` → green, `failed` → red

---

### Step 1.8 — Hook & Capability String

**File:** `src/hooks/use-can.ts`

Add three capability strings to the switch/map in `useCan`:

```ts
case 'manage-social-posts': return canManageSocialPosts(role);
case 'publish-social-post': return canPublishSocialPost(role);
case 'connect-social-account': return canConnectSocialAccount(role);
```

---

### Step 1.9 — Sidebar & Navigation Updates

**File:** `src/components/layout/sidebar.tsx`

In the `navItems` array, add after the `integrations` entry (accessible to all authenticated roles so agents can draft posts; viewers have read-only view):

```ts
import { Share2 } from 'lucide-react'; // add to icon imports at top

// In navItems array:
{
  href: '/social-media',
  labelKey: 'socialMedia',
  icon: Share2,
  emoji: '📱',
},
```

**File:** `src/components/layout/bottom-nav.tsx`

Add to `moreNavItems`:

```ts
import { Share2 } from 'lucide-react'; // add to imports

// In moreNavItems:
{ href: '/social-media', labelKey: 'socialMedia', icon: Share2 },
```

**File:** `src/app/(dashboard)/dashboard-shell.tsx`

Add to `pageTitles`:

```ts
'/social-media': 'socialMedia',
```

---

### Step 1.10 — i18n Keys

**Add to all 4 locale files** (`messages/en.json`, `messages/es.json`, `messages/pt.json`, `messages/ko.json`).

In `messages/en.json`, add at the top level:

```json
"SocialMedia": {
  "page": {
    "title": "Social Media",
    "subtitle": "Manage your Instagram and Facebook posts",
    "newPost": "New Post",
    "connectAccount": "Connect Account",
    "noAccountsTitle": "No social accounts connected",
    "noAccountsSubtitle": "Connect your Instagram or Facebook Page to start posting",
    "noPostsYet": "No posts yet",
    "createFirstPost": "Create your first post to get started",
    "errorLoad": "Failed to load posts",
    "retry": "Retry"
  },
  "composer": {
    "title": "New Post",
    "selectAccount": "Select account",
    "caption": "Caption",
    "captionPlaceholder": "Write a caption...",
    "charactersLeft": "{count} characters remaining",
    "uploadImage": "Upload Image",
    "changeImage": "Change Image",
    "publishNow": "Publish Now",
    "saveDraft": "Save Draft",
    "submitForReview": "Submit for Review",
    "agentNotice": "Posts created by agents are saved as drafts for admin approval before publishing.",
    "publishing": "Publishing..."
  },
  "status": {
    "draft": "Draft",
    "scheduled": "Scheduled",
    "publishing": "Publishing",
    "published": "Published",
    "failed": "Failed"
  },
  "table": {
    "account": "Account",
    "caption": "Caption",
    "status": "Status",
    "date": "Date",
    "actions": "Actions",
    "publish": "Publish",
    "publishDraft": "Approve & Publish"
  },
  "accounts": {
    "connected": "Connected",
    "disconnect": "Disconnect",
    "connectInstagram": "Connect Instagram",
    "connectFacebook": "Connect Facebook Page",
    "tokenExpiresSoon": "Token expires in {days} days — reconnect soon"
  },
  "errors": {
    "publishFailed": "Failed to publish post: {message}",
    "uploadFailed": "Image upload failed",
    "missingMedia": "Please upload an image before publishing"
  }
}
```

In `messages/en.json`, also add the `socialMedia` key to the `Sidebar` namespace:

```json
"Sidebar": {
  ...existing keys...,
  "socialMedia": "Social Media"
}
```

**Mirror all these keys identically in `es.json`, `pt.json`, and `ko.json`** (use English values as stubs; the key hierarchy must match exactly or `i18n/messages.test.ts` will fail).

Also add to `Header` namespace in all 4 files:

```json
"Header": {
  ...existing keys...,
  "socialMedia": "Social Media"
}
```

---

### Step 1.11 — Components Directory

**Directory:** `src/components/social/`

Create these component files (structure only — implement following the broadcasts/flows component style):

- `social-account-tile.tsx` — shows avatar, platform badge, display name, "Disconnect" button (gated strictly to `canConnectSocialAccount`)
- `post-composer-sheet.tsx` — Sheet-based compose form (image upload + caption + draft submission / publish depending on `canPublish`)
- `post-status-badge.tsx` — status badge (matches broadcast status badge pattern)
- `post-history-table.tsx` — desktop table + mobile stacked card (with inline "Approve & Publish" action for admins/owners on draft posts)

---

### Step 1.12 — Environment Variables

**File:** `.env.local.example` — add these two lines with placeholder comments:

```bash
# Meta App credentials for Social Media OAuth (Instagram & Facebook Page publishing)
META_APP_ID=your_meta_app_id_here
# META_APP_SECRET is already present for WhatsApp — reuse the same env var
```

> `META_APP_SECRET` is already in `.env.local.example` for WhatsApp webhook verification. The same Meta App can have both WhatsApp and Social permissions — no new secret needed if using the same Meta App.

---

### Step 1.13 — Integrations Page Update

**File:** `src/app/(dashboard)/integrations/page.tsx`

Change the Instagram entry from `coming_soon` to a real connect tile:

```ts
// Replace:
{
  name: 'Instagram',
  slug: 'Instagram',
  icon: 'MessageCircle',
  status: 'coming_soon' as ...,
  test_lead: false,
},

// With:
{
  name: 'Instagram',
  slug: 'Instagram',
  icon: 'Instagram',
  status: 'coming_soon' as ...,  // Keep for now; Phase 1 routing goes through /social-media
  test_lead: false,
  link: '/social-media',  // Add a "Set up" link pointing to the social media page
},
```

---

### Step 1.14 — Phase 1 Definition of Done

Before declaring Phase 1 complete, all of the following must pass:

```bash
npm run typecheck   # 0 errors
npm run lint        # 0 errors
npm run format:check
npx vitest run src/i18n/messages.test.ts  # all 4 locales in parity
npm run test        # all tests pass
```

Manual verification:

- [ ] Admin & agent can navigate to `/social-media` via sidebar (visible to agent for drafting; viewers see read-only history)
- [ ] Agent and viewer cannot see the "Connect Account" or "Disconnect" buttons (`canConnectSocialAccount` gated)
- [ ] Viewer sees post history as read-only (no "New Post" button, `canManageSocialPosts` gated)
- [ ] Agent can open Post Composer, upload image, write caption, see the approval notice, and click "Submit for Review" (saves post as `draft`)
- [ ] Agent CANNOT see "Publish Now" button in composer, and direct call to `/api/social/publish` returns 403 Forbidden
- [ ] Admin/Owner sees draft posts in history table with "Approve & Publish" action button
- [ ] Admin/Owner can publish immediately from composer ("Publish Now") or approve existing drafts from table ("Approve & Publish")
- [ ] OAuth flow completes and creates a row in `social_accounts` with encrypted token
- [ ] Image uploads to `social-media` Supabase Storage bucket
- [ ] Publishing calls `/api/social/publish`, marks post as `published`, shows success toast
- [ ] Failed publish shows error toast with `failure_reason` and an inline "Retry" button for admins
- [ ] Post history table renders on desktop; stacked cards on mobile (`< 768px`)

---

## Phase 2 — Post Scheduling & Calendar View

**Goal:** Business owners/admins can schedule approved posts for future auto-publishing via a background job. Sales agents can propose target schedule dates on drafts submitted for admin approval (Option 3 workflow).

---

### Step 2.1 — No New Migration Required

The `social_posts` table already has `scheduled_at TIMESTAMPTZ` and `status = 'scheduled'` from migration `132`. Phase 2 is purely application-layer work.

---

### Step 2.2 — Scheduler: Supabase Edge Function

**File:** `supabase/functions/social-post-scheduler/index.ts`

This Edge Function is invoked by pg_cron (or manually by Supabase Dashboard → scheduled triggers).

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Called every minute by pg_cron: SELECT cron.schedule('social-post-scheduler', '* * * * *', $$SELECT net.http_post(...)$$);
Deno.serve(async () => {
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date().toISOString();

  // Fetch all due scheduled posts (max 20 per invocation to prevent timeouts)
  const { data: duePosts } = await db
    .from('social_posts')
    .select(
      'id, account_id, social_account_id, caption, media_url, retry_count, social_account:social_accounts(platform, platform_user_id, access_token_enc)'
    )
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .lt('retry_count', 3) // Give up after 3 attempts
    .order('scheduled_at', { ascending: true })
    .limit(20);

  if (!duePosts?.length) return new Response('No posts due', { status: 200 });

  const results = await Promise.allSettled(
    duePosts.map(async (post) => {
      // Mark publishing first (prevents double-trigger on overlapping cron ticks)
      await db
        .from('social_posts')
        .update({
          status: 'publishing',
          last_attempt_at: now,
          retry_count: post.retry_count + 1,
        })
        .eq('id', post.id);

      // Call the internal publish API route (reuses the existing publish logic)
      const publishRes = await fetch(
        `${Deno.env.get('NEXT_PUBLIC_SITE_URL')}/api/social/publish`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Internal service call — use a shared secret, not a user session
            'x-internal-secret': Deno.env.get('INTERNAL_API_SECRET')!,
          },
          body: JSON.stringify({ post_id: post.id }),
        }
      );

      if (!publishRes.ok) {
        const err = await publishRes.json();
        await db
          .from('social_posts')
          .update({
            status: post.retry_count >= 2 ? 'failed' : 'scheduled',
            failure_reason: err.error ?? 'Scheduler publish failed',
          })
          .eq('id', post.id);
      }
    })
  );

  return new Response(JSON.stringify({ processed: results.length }), {
    status: 200,
  });
});
```

> **Brand Safety Invariant (Option 3):** The scheduler only queries posts where `status = 'scheduled'`. Under Option 3, only Admins/Owners can transition a post to `status = 'scheduled'`. If an agent proposes a schedule date, the post remains in `status = 'draft'` until an admin clicks "Approve & Schedule". This guarantees that no unreviewed agent content can ever be published automatically by pg_cron.
>
> **Note:** Add `INTERNAL_API_SECRET` to `.env.local.example`. The `/api/social/publish` route must accept this header as an alternative to the user session when processing scheduled posts.

---

### Step 2.3 — pg_cron Setup Migration `133_social_scheduler_cron.sql`

```sql
-- 133_social_scheduler_cron.sql
-- Registers a pg_cron job to trigger the social post scheduler
-- Edge Function every minute.
-- Requires the pg_cron and pg_net extensions (already available in Supabase).

SELECT cron.schedule(
  'social-post-scheduler',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_functions_url') || '/social-post-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);
```

---

### Step 2.4 — Post Composer: Add Date/Time Picker

**File:** `src/components/social/post-composer-sheet.tsx`

Extend the Phase 1 composer to add a scheduling section below the caption:

```tsx
// Add after the caption textarea:
<div className="space-y-2">
  <label className="text-foreground text-sm font-medium">
    {t('composer.schedulePost')}
  </label>
  <div className="flex items-center gap-3">
    <input
      type="datetime-local"
      min={new Date().toISOString().slice(0, 16)}
      value={scheduledAt}
      onChange={(e) => setScheduledAt(e.target.value)}
      className="border-border bg-background text-foreground rounded-md border px-3 py-2 text-sm"
    />
    {scheduledAt && (
      <button
        type="button"
        onClick={() => setScheduledAt('')}
        className="text-muted-foreground hover:text-foreground text-xs"
      >
        {t('composer.publishNow')}
      </button>
    )}
  </div>
</div>;

// Footer buttons (differentiated by role privilege):
{
  canPublish ? (
    <div className="flex gap-2">
      <Button variant="outline" onClick={handleSaveDraft}>
        {t('composer.saveDraft')}
      </Button>
      <Button
        onClick={scheduledAt ? handleSchedule : handlePublishNow}
        disabled={publishing}
      >
        {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {scheduledAt
          ? t('composer.scheduleFor', { time: formatTime(scheduledAt) })
          : t('composer.publishNow')}
      </Button>
    </div>
  ) : (
    <div className="flex flex-col gap-2">
      <div className="rounded bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
        {scheduledAt
          ? t('composer.scheduledDraftNotice')
          : t('composer.agentNotice')}
      </div>
      <Button onClick={handleSubmitForReview} disabled={submitting}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {t('composer.submitForReview')}
      </Button>
    </div>
  );
}
```

> **Review Workflow for Scheduled Posts:**
> When an agent picks a target schedule time and submits, the post is saved with `status = 'draft'` and `scheduled_at = <selected-time>`. In `post-history-table.tsx` and `post-calendar.tsx`, Admins/Owners see an inline **"Approve & Schedule"** button that verifies the content and transitions the status to `'scheduled'`, queuing it for the cron scheduler.

---

### Step 2.5 — Calendar View Component

**File:** `src/components/social/post-calendar.tsx`

Build a monthly calendar view showing scheduled posts as colored dots/pills on their scheduled dates. Follow the `site-visits` calendar component pattern (`src/components/site-visits/`).

- Desktop: Full monthly grid. Each day cell shows post count or truncated caption.
- Mobile: Scrollable list grouped by date (week-by-week), matching the site-visits mobile list view.
- Tab switcher on the `/social-media` page: `[Posts] [Calendar]` using the existing `Tabs` component.
- Visual distinction: Active scheduled posts show in green/blue badge; agent-proposed drafts show in amber with "Pending Approval" pill.

---

### Step 2.6 — i18n Additions (Phase 2)

Add to `SocialMedia.composer` in all 4 locale files:

```json
"schedulePost": "Schedule for later",
"scheduleFor": "Schedule for {time}",
"scheduledSuccessfully": "Post scheduled for {time}",
"cancelSchedule": "Cancel Schedule",
"scheduledDraftNotice": "This post and its target schedule time will be submitted as a draft for admin approval.",
"approveAndSchedule": "Approve & Schedule"
```

Add to `SocialMedia.page`:

```json
"calendarTab": "Calendar",
"postsTab": "Posts",
"noScheduledPosts": "No scheduled posts",
"scheduleYourFirst": "Schedule a post to see it here"
```

---

### Step 2.7 — Phase 2 Definition of Done

- [ ] All Phase 1 checks still pass
- [ ] Date/time picker appears in composer below caption
- [ ] Admin scheduling a post sets `status = 'scheduled'` and `scheduled_at` in DB
- [ ] Agent scheduling a post saves it as `draft` with `scheduled_at` set (never directly `scheduled`), awaiting admin approval
- [ ] Admin sees "Approve & Schedule" action on agent drafts with proposed schedule time
- [ ] Scheduled posts appear on calendar view on their scheduled date (with status distinction for pending drafts)
- [ ] Edge Function deploys without error (`supabase functions deploy social-post-scheduler`)
- [ ] pg_cron job fires every minute (verify in Supabase Dashboard → pg_cron logs)
- [ ] A test post scheduled 2 minutes in the future auto-publishes
- [ ] A post that fails 3 times becomes `failed` (retry_count >= 3)
- [ ] Cancelling a scheduled post resets it to `draft`

---

## Phase 3 — AI Caption Assist & Post Templates

**Goal:** Team (both sales agents drafting posts and admins reviewing/publishing) can generate real-estate-specific captions using the existing AI infrastructure, and pick from a library of post templates.

---

### Step 3.1 — AI Caption Generation API Route

**File:** `src/app/api/social/generate-caption/route.ts`

Reuse the existing `src/lib/ai/generate.ts` infrastructure (the same module that powers AI draft messages in the inbox).

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { canManageSocialPosts } from '@/lib/auth/roles';
import { generateText } from '@/lib/ai/generate';

const REAL_ESTATE_SYSTEM_PROMPT = `
You are a real estate marketing copywriter for an Indian property developer.
Write engaging social media captions for Instagram and Facebook.
Captions should:
- Highlight the property's key features (location, configuration, price if provided)
- Use relevant real estate hashtags for Indian markets
- Have a clear call-to-action (e.g., "Call now", "Book a site visit")
- Be concise: under 300 characters for the main text, hashtags after a line break
- Use INR formatting (₹45 L, ₹1.2 Cr) for prices
- Sound professional but warm, not corporate
Return ONLY the caption text — no explanations or formatting markup.
`.trim();

export async function POST(request: NextRequest) {
  const { role, accountId } = await getCurrentAccount();
  if (!canManageSocialPosts(role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { platform, property_details, tone } = (await request.json()) as {
    platform: 'instagram' | 'facebook';
    property_details: string; // Free-text: "3BHK in Noida, ₹1.2 Cr, ready to move"
    tone?: 'professional' | 'friendly' | 'urgent';
  };

  const userPrompt = `Platform: ${platform}\nProperty: ${property_details}\nTone: ${tone ?? 'professional'}`;

  const caption = await generateText({
    accountId,
    systemPrompt: REAL_ESTATE_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 300,
  });

  return NextResponse.json({ caption });
}
```

---

### Step 3.2 — Caption Assist UI in Composer

**File:** `src/components/social/post-composer-sheet.tsx`

Add a "✨ Generate Caption" button above the caption textarea:

```tsx
<div className="flex items-center justify-between">
  <label className="text-foreground text-sm font-medium">
    {t('composer.caption')}
  </label>
  <button
    type="button"
    onClick={handleGenerateCaption}
    disabled={generating || !propertyDetails}
    className="text-primary hover:bg-primary/10 flex items-center gap-1 rounded-md px-2 py-1 text-xs disabled:opacity-50"
  >
    {generating ? (
      <Loader2 className="h-3 w-3 animate-spin" />
    ) : (
      <Sparkles className="h-3 w-3" />
    )}
    {t('composer.generateCaption')}
  </button>
</div>;

{
  /* Property details input (shown when AI assist is enabled) */
}
{
  showAiAssist && (
    <input
      type="text"
      placeholder={t('composer.propertyDetailsPlaceholder')}
      value={propertyDetails}
      onChange={(e) => setPropertyDetails(e.target.value)}
      className="border-border bg-muted w-full rounded-md border px-3 py-2 text-sm"
    />
  );
}
```

---

### Step 3.3 — Post Templates Library

**File:** `src/lib/social/templates.ts`

Static template library (no DB table needed — similar to `src/lib/automations/templates.ts`):

```ts
/**
 * Real estate social media post templates.
 * Structured as fill-in-the-blank prompts that the AI caption
 * generator can use as starting points.
 */
export interface SocialPostTemplate {
  id: string;
  title: string;
  category:
    'property_launch' | 'site_visit' | 'testimonial' | 'offer' | 'general';
  promptSeed: string; // Sent as `property_details` to the generate-caption API
  suggestedHashtags: string[];
}

export const SOCIAL_POST_TEMPLATES: SocialPostTemplate[] = [
  {
    id: 'new-launch',
    title: 'New Project Launch',
    category: 'property_launch',
    promptSeed:
      'New residential project launch. Highlight exclusivity and early-bird pricing.',
    suggestedHashtags: [
      '#NewLaunch',
      '#RealEstate',
      '#IndianRealty',
      '#DreamHome',
    ],
  },
  {
    id: 'site-visit-invite',
    title: 'Site Visit Invitation',
    category: 'site_visit',
    promptSeed:
      'Inviting leads to visit the site. Emphasize the experience and personal tour.',
    suggestedHashtags: ['#SiteVisit', '#PropertyTour', '#BookNow'],
  },
  {
    id: 'happy-client',
    title: 'Happy Client Story',
    category: 'testimonial',
    promptSeed:
      'Sharing a client success story. Warm, grateful, community-focused tone.',
    suggestedHashtags: ['#HappyClient', '#Testimonial', '#RealEstateIndia'],
  },
  {
    id: 'limited-offer',
    title: 'Limited-Time Offer',
    category: 'offer',
    promptSeed:
      'Special pricing or offer ending soon. Create urgency without being pushy.',
    suggestedHashtags: ['#LimitedOffer', '#EarlyBird', '#RealEstateDeals'],
  },
  {
    id: 'project-update',
    title: 'Project Construction Update',
    category: 'general',
    promptSeed:
      'Project construction milestone update. Build trust and excitement.',
    suggestedHashtags: ['#ConstructionUpdate', '#Progress', '#YourDreamHome'],
  },
];
```

---

### Step 3.4 — Template Picker UI

**File:** `src/components/social/template-picker.tsx`

A grid of template cards shown in a Dialog (triggered by "Use Template" button in the composer). On template selection:

1. Pre-fills `propertyDetails` with the template's `promptSeed`.
2. Inserts `suggestedHashtags` at the end of the caption textarea.
3. Auto-triggers the AI caption generation.

Pattern to follow: `src/components/broadcasts/` step wizard component grid style.

---

### Step 3.5 — i18n Additions (Phase 3)

Add to `SocialMedia.composer` in all 4 locale files:

```json
"generateCaption": "Generate Caption",
"generating": "Generating...",
"propertyDetailsPlaceholder": "e.g. 3BHK in Noida, ₹1.2 Cr, ready to move",
"useTemplate": "Use Template",
"aiAssistLabel": "AI Assist"
```

Add `SocialMedia.templates` namespace:

```json
"templates": {
  "title": "Post Templates",
  "subtitle": "Start with a real estate template",
  "categories": {
    "property_launch": "Property Launch",
    "site_visit": "Site Visit",
    "testimonial": "Testimonial",
    "offer": "Offer",
    "general": "General"
  }
}
```

---

### Step 3.6 — Phase 3 Definition of Done

- [ ] All Phase 1 & 2 checks still pass
- [ ] "✨ Generate Caption" button appears in composer for admin/agent roles
- [ ] Typing property details and clicking generate calls `/api/social/generate-caption`
- [ ] Generated caption populates the textarea (editable after generation)
- [ ] "Use Template" opens template picker Dialog
- [ ] Selecting a template pre-fills property details and auto-generates a caption
- [ ] Suggested hashtags appended to caption
- [ ] AI errors show a toast (not a crashed UI)
- [ ] Viewer role does NOT see the Generate or Template buttons

---

## Cross-Phase Guardrails (Apply Throughout)

| Rule                                                         | Reference                                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Never import from `@radix-ui/*`                              | Use `@base-ui/react` via existing `src/components/ui/` wrappers                            |
| Never hardcode hex colors                                    | Use `globals.css` CSS variables only                                                       |
| Never compare role strings inline                            | Always call predicates from `src/lib/auth/roles.ts`                                        |
| Never call Meta Graph API from client components             | API routes only                                                                            |
| Never store plaintext access tokens                          | Always use `encryptToken`/`decryptToken` from `src/lib/social/encryption.ts`               |
| Never skip i18n for new strings                              | All 4 locale files must have identical key hierarchy                                       |
| Always add RLS to new account-scoped tables                  | `is_account_member(account_id)` pattern                                                    |
| Run verification gates before declaring done                 | `typecheck`, `lint`, `format:check`, `test`                                                |
| Add tests for new `lib/` logic                               | Co-locate `<file>.test.ts` per existing convention                                         |
| Update `docs/agent/SCHEMA_REFERENCE.md`                      | Any new migration = update the table inventory                                             |
| Only Admins/Owners can publish or set `status = 'scheduled'` | Enforce Option 3 brand safety via `canPublishSocialPost(role)` server-side and client-side |

---

## Summary of New Files Created Across All Phases

| File                                                       | Phase |
| ---------------------------------------------------------- | ----- |
| `supabase/migrations/131_social_accounts.sql`              | 1     |
| `supabase/migrations/132_social_posts.sql`                 | 1     |
| `supabase/migrations/133_social_scheduler_cron.sql`        | 2     |
| `supabase/functions/social-post-scheduler/index.ts`        | 2     |
| `src/lib/social/meta-api.ts`                               | 1     |
| `src/lib/social/encryption.ts`                             | 1     |
| `src/lib/social/accounts.ts`                               | 1     |
| `src/lib/social/templates.ts`                              | 3     |
| `src/app/api/social/connect/route.ts`                      | 1     |
| `src/app/api/social/callback/route.ts`                     | 1     |
| `src/app/api/social/publish/route.ts`                      | 1     |
| `src/app/api/social/generate-caption/route.ts`             | 3     |
| `src/app/(dashboard)/social-media/page.tsx`                | 1     |
| `src/app/(dashboard)/social-media/social-media-client.tsx` | 1     |
| `src/components/social/social-account-tile.tsx`            | 1     |
| `src/components/social/post-composer-sheet.tsx`            | 1     |
| `src/components/social/post-status-badge.tsx`              | 1     |
| `src/components/social/post-history-table.tsx`             | 1     |
| `src/components/social/post-calendar.tsx`                  | 2     |
| `src/components/social/template-picker.tsx`                | 3     |

## Summary of Modified Files Across All Phases

| File                                        | What Changes                                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/lib/auth/roles.ts`                     | +3 predicates (`canManageSocialPosts`, `canPublishSocialPost`, `canConnectSocialAccount`)      |
| `src/hooks/use-can.ts`                      | +3 capability strings (`manage-social-posts`, `publish-social-post`, `connect-social-account`) |
| `src/types/index.ts`                        | +`SocialAccount`, `SocialPost`, `SocialPostStatus` types                                       |
| `src/components/layout/sidebar.tsx`         | +1 nav item (`socialMedia`, accessible to agent/admin/owner)                                   |
| `src/components/layout/bottom-nav.tsx`      | +1 nav item in `moreNavItems`                                                                  |
| `src/app/(dashboard)/dashboard-shell.tsx`   | +1 entry in `pageTitles`                                                                       |
| `src/app/(dashboard)/integrations/page.tsx` | Instagram tile: add `link` prop                                                                |
| `messages/en.json`                          | +`SocialMedia` namespace, +`socialMedia` key in `Sidebar` & `Header`                           |
| `messages/es.json`                          | Same (mirrored keys)                                                                           |
| `messages/pt.json`                          | Same (mirrored keys)                                                                           |
| `messages/ko.json`                          | Same (mirrored keys)                                                                           |
| `.env.local.example`                        | +`META_APP_ID` comment                                                                         |
| `docs/agent/SCHEMA_REFERENCE.md`            | +2 new table rows, updated migration number                                                    |
