'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SocialAccount, SocialPost } from '@/types';
import { AccountRole } from '@/lib/auth/roles';
import { useCan } from '@/hooks/use-can';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { GatedButton } from '@/components/ui/gated-button';
import { Input } from '@/components/ui/input';
import { PullToRefresh } from '@/components/layout/pull-to-refresh';
import { SocialAccountTile } from '@/components/social/social-account-tile';
import { PostHistoryTable } from '@/components/social/post-history-table';
import { PostGridView } from '@/components/social/post-grid-view';
import { PostCalendar } from '@/components/social/post-calendar';
import { PostComposerSheet } from '@/components/social/post-composer-sheet';
import { PostPreviewDialog } from '@/components/social/post-preview-dialog';
import { PostDeleteDialog } from '@/components/social/post-delete-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Share2,
  Plus,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  FileText,
  Calendar as CalendarIcon,
  LayoutGrid,
  Search,
  X,
  Sparkles,
} from 'lucide-react';
import { Instagram, Facebook } from '@/components/social/icons';
import { toast } from 'sonner';

interface SocialMediaClientProps {
  accountId: string;
  role: AccountRole;
  socialAccounts: SocialAccount[];
  initialPosts: SocialPost[];
}

export function SocialMediaClient({
  accountId,
  socialAccounts: initialAccounts,
  initialPosts,
}: SocialMediaClientProps) {
  const t = useTranslations('SocialMedia');
  const router = useRouter();
  const searchParams = useSearchParams();

  const canManagePosts = useCan('manage-social-posts');
  const canPublish = useCan('publish-social-post');
  const canConnectSocial = useCan('connect-social-account');

  const [accounts, setAccounts] = useState<SocialAccount[]>(initialAccounts);
  const [posts, setPosts] = useState<SocialPost[]>(initialPosts);

  // View state: 'posts' (table), 'grid' (feed), 'calendar'
  const [activeTab, setActiveTab] = useState<'posts' | 'grid' | 'calendar'>(
    'posts'
  );

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'needs_review' | 'scheduled' | 'published' | 'failed'
  >('all');
  const [platformFilter, setPlatformFilter] = useState<
    'all' | 'instagram' | 'facebook'
  >('all');

  // Modal states
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [scheduledDateForComposer, setScheduledDateForComposer] = useState<
    string | null
  >(null);
  const [previewPost, setPreviewPost] = useState<SocialPost | null>(null);
  const [deleteTargetPost, setDeleteTargetPost] = useState<SocialPost | null>(
    null
  );

  // Check URL query parameters for OAuth results
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');

    if (connected) {
      toast.success(
        `${connected === 'instagram' ? 'Instagram' : 'Facebook Page'} connected successfully!`
      );
      router.replace('/social-media');
    } else if (error) {
      toast.error(`OAuth connection failed: ${error}`);
      router.replace('/social-media');
    }
  }, [searchParams, router]);

  const fetchAccounts = useCallback(async () => {
    try {
      const db = createClient();
      const { data, error } = await db
        .from('social_accounts')
        .select(
          'id, account_id, platform, display_name, platform_user_id, token_expires_at, avatar_url, is_active, created_at, updated_at'
        )
        .eq('account_id', accountId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setAccounts((data ?? []) as SocialAccount[]);
    } catch {
      // Keep existing accounts
    }
  }, [accountId]);

  const fetchPosts = useCallback(async () => {
    try {
      const db = createClient();
      const [postsRes, profilesRes] = await Promise.all([
        db
          .from('social_posts')
          .select(
            '*, social_account:social_accounts(id, platform, display_name, avatar_url)'
          )
          .eq('account_id', accountId)
          .order('created_at', { ascending: false })
          .limit(100),
        db
          .from('profiles')
          .select('user_id, full_name, email, avatar_url')
          .eq('account_id', accountId),
      ]);

      if (postsRes.error) throw postsRes.error;

      const profileMap = new Map(
        (profilesRes.data ?? []).map((p) => [p.user_id, p])
      );

      const enriched = (postsRes.data ?? []).map((post) => ({
        ...post,
        creator: post.created_by ? profileMap.get(post.created_by) : undefined,
      })) as SocialPost[];

      setPosts(enriched);
    } catch {
      toast.error(t('page.errorLoad'));
    }
  }, [accountId, t]);

  // Statistics for Situational Awareness Strip
  const stats = useMemo(() => {
    const total = posts.length;
    const published = posts.filter((p) => p.status === 'published').length;
    const drafts = posts.filter((p) => p.status === 'draft').length;
    const failed = posts.filter((p) => p.status === 'failed').length;
    const scheduled = posts.filter(
      (p) => p.status === 'scheduled' || p.status === 'publishing'
    ).length;
    return { total, published, drafts, failed, scheduled };
  }, [posts]);

  // Filtered Posts List based on search, status, and platform
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      // Platform filter
      if (
        platformFilter !== 'all' &&
        post.social_account?.platform !== platformFilter
      ) {
        return false;
      }

      // Status filter
      if (statusFilter === 'needs_review' && post.status !== 'draft') {
        return false;
      }
      if (
        statusFilter === 'scheduled' &&
        post.status !== 'scheduled' &&
        post.status !== 'publishing'
      ) {
        return false;
      }
      if (statusFilter === 'published' && post.status !== 'published') {
        return false;
      }
      if (statusFilter === 'failed' && post.status !== 'failed') {
        return false;
      }

      // Search Query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesCaption = post.caption?.toLowerCase().includes(query);
        const matchesAccount = post.social_account?.display_name
          ?.toLowerCase()
          .includes(query);
        const matchesCreator = post.creator?.full_name
          ?.toLowerCase()
          .includes(query);

        if (!matchesCaption && !matchesAccount && !matchesCreator) {
          return false;
        }
      }

      return true;
    });
  }, [posts, platformFilter, statusFilter, searchQuery]);

  const handleConnectOAuth = (platform: 'instagram' | 'facebook') => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/api/social/connect?platform=${platform}`;
  };

  const handleOpenEdit = (post: SocialPost) => {
    setEditingPost(post);
    setScheduledDateForComposer(null);
    setComposerOpen(true);
  };

  const handleOpenNewPost = (initialDateStr?: string) => {
    setEditingPost(null);
    setScheduledDateForComposer(initialDateStr ?? null);
    setComposerOpen(true);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'all' ||
    platformFilter !== 'all';

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPlatformFilter('all');
  };

  return (
    <PullToRefresh
      onRefresh={async () => {
        await Promise.all([fetchAccounts(), fetchPosts()]);
      }}
    >
      <div className="space-y-6 pb-20 md:pb-8">
        {/* Header Strip */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-foreground text-2xl font-bold tracking-tight">
              {t('page.title')}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {t('page.subtitle')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canConnectSocial && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" className="text-xs sm:text-sm">
                      <LinkIcon className="mr-1.5 size-4" />
                      {t('page.connectAccount')}
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={() => handleConnectOAuth('instagram')}
                    className="cursor-pointer"
                  >
                    <Instagram className="mr-2 size-4 text-pink-600 dark:text-pink-400" />
                    <span>{t('accounts.connectInstagram')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleConnectOAuth('facebook')}
                    className="cursor-pointer"
                  >
                    <Facebook className="mr-2 size-4 text-blue-600 dark:text-blue-400" />
                    <span>{t('accounts.connectFacebook')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <GatedButton
              canAct={canManagePosts && accounts.length > 0}
              gateReason={
                accounts.length === 0
                  ? 'connect an account first'
                  : 'create posts'
              }
              onClick={() => handleOpenNewPost()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm"
            >
              <Plus className="mr-1.5 size-4" />
              {t('page.newPost')}
            </GatedButton>
          </div>
        </div>

        {/* Connected Accounts Strip */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground text-sm font-semibold tracking-wide">
              {t('accounts.connected')} ({accounts.length})
            </h2>
          </div>

          {accounts.length > 0 ? (
            <div className="flex scrollbar-none gap-3 overflow-x-auto pb-2">
              {accounts.map((account) => (
                <SocialAccountTile
                  key={account.id}
                  account={account}
                  canManage={canConnectSocial}
                  onDisconnected={async () => {
                    await fetchAccounts();
                    await fetchPosts();
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="border-border bg-card flex flex-col items-center justify-between gap-4 rounded-xl border p-5 shadow-xs sm:flex-row">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <Share2 className="size-5" />
                </div>
                <div>
                  <h3 className="text-foreground text-sm font-medium">
                    {t('page.noAccountsTitle')}
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {t('page.noAccountsSubtitle')}
                  </p>
                </div>
              </div>

              {canConnectSocial && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button size="sm" className="w-full text-xs sm:w-auto">
                        <LinkIcon className="mr-1.5 size-3.5" />
                        {t('page.connectAccount')}
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      onClick={() => handleConnectOAuth('instagram')}
                      className="cursor-pointer"
                    >
                      <Instagram className="mr-2 size-4 text-pink-600 dark:text-pink-400" />
                      <span>{t('accounts.connectInstagram')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleConnectOAuth('facebook')}
                      className="cursor-pointer"
                    >
                      <Facebook className="mr-2 size-4 text-blue-600 dark:text-blue-400" />
                      <span>{t('accounts.connectFacebook')}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>

        {/* Needs Review Alert Banner for Admins */}
        {canPublish && stats.drafts > 0 && (
          <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-900 sm:flex-row sm:items-center dark:text-amber-200">
            <div className="flex items-center gap-2.5">
              <Sparkles className="size-4.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-semibold">
                {t('page.needsReviewBanner', { count: stats.drafts })}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setStatusFilter('needs_review');
                setActiveTab('posts');
              }}
              className="h-7 border-amber-500/40 text-xs font-medium text-amber-800 hover:bg-amber-500/20 dark:text-amber-300"
            >
              {t('page.viewAllDrafts')}
            </Button>
          </div>
        )}

        {/* Situational Awareness KPI Strip (Interactive click-to-filter) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div
            onClick={() => setStatusFilter('all')}
            className={`border-border bg-card hover:border-primary/40 cursor-pointer rounded-xl border p-4 shadow-xs transition-all ${
              statusFilter === 'all' ? 'ring-primary/40 ring-2' : ''
            }`}
          >
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Total Posts</span>
              <Layers className="size-4" />
            </div>
            <p className="text-foreground mt-2 text-2xl font-bold">
              {stats.total}
            </p>
          </div>

          <div
            onClick={() => setStatusFilter('published')}
            className={`border-border bg-card cursor-pointer rounded-xl border p-4 shadow-xs transition-all hover:border-emerald-500/40 ${
              statusFilter === 'published' ? 'ring-2 ring-emerald-500/40' : ''
            }`}
          >
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Published</span>
              <CheckCircle2 className="size-4 text-emerald-500" />
            </div>
            <p className="text-foreground mt-2 text-2xl font-bold">
              {stats.published}
            </p>
          </div>

          <div
            onClick={() => setStatusFilter('scheduled')}
            className={`border-border bg-card cursor-pointer rounded-xl border p-4 shadow-xs transition-all hover:border-blue-500/40 ${
              statusFilter === 'scheduled' ? 'ring-2 ring-blue-500/40' : ''
            }`}
          >
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Scheduled</span>
              <Clock className="text-primary size-4" />
            </div>
            <p className="text-foreground mt-2 text-2xl font-bold">
              {stats.scheduled}
            </p>
          </div>

          <div
            onClick={() => setStatusFilter('needs_review')}
            className={`border-border bg-card cursor-pointer rounded-xl border p-4 shadow-xs transition-all hover:border-amber-500/40 ${
              statusFilter === 'needs_review' ? 'ring-2 ring-amber-500/40' : ''
            }`}
          >
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Drafts / Review</span>
              <FileText className="size-4 text-amber-500" />
            </div>
            <p className="text-foreground mt-2 text-2xl font-bold">
              {stats.drafts}
            </p>
          </div>

          <div
            onClick={() => setStatusFilter('failed')}
            className={`border-border bg-card hover:border-destructive/40 col-span-2 cursor-pointer rounded-xl border p-4 shadow-xs transition-all sm:col-span-1 ${
              statusFilter === 'failed' ? 'ring-destructive/40 ring-2' : ''
            }`}
          >
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Failed</span>
              <AlertCircle className="text-destructive size-4" />
            </div>
            <p className="text-foreground mt-2 text-2xl font-bold">
              {stats.failed}
            </p>
          </div>
        </div>

        {/* Omni-Search & Filters Bar */}
        <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('page.searchPlaceholder')}
              className="pr-8 pl-9 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-muted-foreground hover:text-foreground absolute top-2.5 right-2.5"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {/* Status Filter Pill Select */}
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                if (val) setStatusFilter(val as typeof statusFilter);
              }}
            >
              <SelectTrigger className="h-9 w-full min-w-[130px] flex-1 text-xs sm:w-36 sm:flex-none">
                <SelectValue placeholder={t('page.allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('page.allStatuses')}</SelectItem>
                <SelectItem value="needs_review">
                  {t('page.statusNeedsReview')} ({stats.drafts})
                </SelectItem>
                <SelectItem value="scheduled">
                  {t('status.scheduled')} ({stats.scheduled})
                </SelectItem>
                <SelectItem value="published">
                  {t('status.published')} ({stats.published})
                </SelectItem>
                <SelectItem value="failed">
                  {t('status.failed')} ({stats.failed})
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Platform Filter Select */}
            <Select
              value={platformFilter}
              onValueChange={(val) => {
                if (val) setPlatformFilter(val as typeof platformFilter);
              }}
            >
              <SelectTrigger className="h-9 w-full min-w-[130px] flex-1 text-xs sm:w-36 sm:flex-none">
                <SelectValue placeholder={t('page.allPlatforms')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('page.allPlatforms')}</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-muted-foreground hover:text-foreground h-9 px-2 text-xs"
              >
                <X className="mr-1 size-3.5" />
                {t('page.clearFilters')}
              </Button>
            )}
          </div>
        </div>

        {/* View Switcher: Posts History vs Grid Feed vs Calendar */}
        <Tabs
          value={activeTab}
          onValueChange={(val) =>
            setActiveTab(val as 'posts' | 'grid' | 'calendar')
          }
          className="w-full space-y-4"
        >
          <div className="border-border flex items-center justify-between border-b pb-3">
            <TabsList className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto">
              <TabsTrigger value="posts" className="cursor-pointer">
                <Layers className="mr-1.5 size-4" />
                {t('page.postsTab')}
              </TabsTrigger>
              <TabsTrigger value="grid" className="cursor-pointer">
                <LayoutGrid className="mr-1.5 size-4" />
                {t('page.gridTab')}
              </TabsTrigger>
              <TabsTrigger value="calendar" className="cursor-pointer">
                <CalendarIcon className="mr-1.5 size-4" />
                {t('page.calendarTab')}
              </TabsTrigger>
            </TabsList>

            <span className="text-muted-foreground hidden text-xs sm:inline-block">
              {filteredPosts.length} of {posts.length} posts
            </span>
          </div>

          <TabsContent value="posts" className="space-y-3 outline-none">
            <PostHistoryTable
              posts={filteredPosts}
              canManage={canManagePosts}
              canPublish={canPublish}
              onPreviewPost={(post) => setPreviewPost(post)}
              onEditPost={(post) => handleOpenEdit(post)}
              onDeletePost={(post) => setDeleteTargetPost(post)}
              onPostUpdated={fetchPosts}
            />
          </TabsContent>

          <TabsContent value="grid" className="space-y-3 outline-none">
            <PostGridView
              posts={filteredPosts}
              onSelectPost={(post) => setPreviewPost(post)}
            />
          </TabsContent>

          <TabsContent value="calendar" className="space-y-3 outline-none">
            <PostCalendar
              posts={filteredPosts}
              canPublish={canPublish}
              onPreviewPost={(post) => setPreviewPost(post)}
              onScheduleOnDate={(dateStr) => handleOpenNewPost(dateStr)}
              onPostUpdated={fetchPosts}
            />
          </TabsContent>
        </Tabs>

        {/* Post Preview Dialog */}
        <PostPreviewDialog
          open={Boolean(previewPost)}
          onOpenChange={(open) => {
            if (!open) setPreviewPost(null);
          }}
          post={previewPost}
          canPublish={canPublish}
          canManage={canManagePosts}
          onEditPost={(post) => handleOpenEdit(post)}
          onDeletePost={(post) => setDeleteTargetPost(post)}
          onPostUpdated={fetchPosts}
        />

        {/* Post Delete Confirmation Dialog */}
        <PostDeleteDialog
          open={Boolean(deleteTargetPost)}
          onOpenChange={(open) => {
            if (!open) setDeleteTargetPost(null);
          }}
          post={deleteTargetPost}
          onDeleted={fetchPosts}
        />

        {/* Post Composer Sheet (handles both create and edit mode) */}
        {accounts.length > 0 && (
          <PostComposerSheet
            open={composerOpen}
            onOpenChange={setComposerOpen}
            accounts={accounts}
            accountId={accountId}
            canPublish={canPublish}
            postToEdit={editingPost}
            initialDate={scheduledDateForComposer}
            onPostCreated={fetchPosts}
          />
        )}
      </div>
    </PullToRefresh>
  );
}
