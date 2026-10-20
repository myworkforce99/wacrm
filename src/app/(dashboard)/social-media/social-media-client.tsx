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
import { PullToRefresh } from '@/components/layout/pull-to-refresh';
import { SocialAccountTile } from '@/components/social/social-account-tile';
import { PostHistoryTable } from '@/components/social/post-history-table';
import { PostCalendar } from '@/components/social/post-calendar';
import { PostComposerSheet } from '@/components/social/post-composer-sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const [composerOpen, setComposerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'calendar'>('posts');

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
      const { data, error } = await db
        .from('social_posts')
        .select(
          '*, social_account:social_accounts(id, platform, display_name, avatar_url)'
        )
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setPosts((data ?? []) as SocialPost[]);
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

  const handleConnectOAuth = (platform: 'instagram' | 'facebook') => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/api/social/connect?platform=${platform}`;
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

          <div className="flex items-center gap-2">
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
              onClick={() => setComposerOpen(true)}
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

        {/* Situational Awareness KPI Strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="border-border bg-card rounded-xl border p-4 shadow-xs">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Total Posts</span>
              <Layers className="size-4" />
            </div>
            <p className="text-foreground mt-2 text-2xl font-bold">
              {stats.total}
            </p>
          </div>

          <div className="border-border bg-card rounded-xl border p-4 shadow-xs">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Published</span>
              <CheckCircle2 className="size-4 text-emerald-500" />
            </div>
            <p className="text-foreground mt-2 text-2xl font-bold">
              {stats.published}
            </p>
          </div>

          <div className="border-border bg-card rounded-xl border p-4 shadow-xs">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Scheduled</span>
              <Clock className="text-primary size-4" />
            </div>
            <p className="text-foreground mt-2 text-2xl font-bold">
              {stats.scheduled}
            </p>
          </div>

          <div className="border-border bg-card rounded-xl border p-4 shadow-xs">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Drafts / Review</span>
              <FileText className="size-4 text-amber-500" />
            </div>
            <p className="text-foreground mt-2 text-2xl font-bold">
              {stats.drafts}
            </p>
          </div>

          <div className="border-border bg-card col-span-2 rounded-xl border p-4 shadow-xs sm:col-span-1">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Failed</span>
              <AlertCircle className="text-destructive size-4" />
            </div>
            <p className="text-foreground mt-2 text-2xl font-bold">
              {stats.failed}
            </p>
          </div>
        </div>

        {/* View Switcher: Posts History vs Calendar */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'posts' | 'calendar')}
          className="w-full space-y-4"
        >
          <div className="border-border flex items-center justify-between border-b pb-3">
            <TabsList>
              <TabsTrigger value="posts" className="cursor-pointer">
                <Layers className="mr-1.5 size-4" />
                {t('page.postsTab')}
              </TabsTrigger>
              <TabsTrigger value="calendar" className="cursor-pointer">
                <CalendarIcon className="mr-1.5 size-4" />
                {t('page.calendarTab')}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="posts" className="space-y-3 outline-none">
            <PostHistoryTable
              posts={posts}
              canManage={canManagePosts}
              canPublish={canPublish}
              onPostUpdated={fetchPosts}
            />
          </TabsContent>

          <TabsContent value="calendar" className="space-y-3 outline-none">
            <PostCalendar
              posts={posts}
              canPublish={canPublish}
              onPostUpdated={fetchPosts}
            />
          </TabsContent>
        </Tabs>

        {/* Post Composer Sheet */}
        {accounts.length > 0 && (
          <PostComposerSheet
            open={composerOpen}
            onOpenChange={setComposerOpen}
            accounts={accounts}
            accountId={accountId}
            canPublish={canPublish}
            onPostCreated={fetchPosts}
          />
        )}
      </div>
    </PullToRefresh>
  );
}
