'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SocialPost } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { PostStatusBadge } from './post-status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  Loader2,
  Image as ImageIcon,
  Send,
  Clock,
  CalendarCheck,
  Ban,
} from 'lucide-react';
import { Instagram, Facebook } from '@/components/social/icons';
import { toast } from 'sonner';

interface PostHistoryTableProps {
  posts: SocialPost[];
  canManage?: boolean;
  canPublish?: boolean;
  onPostUpdated?: () => void;
}

export function PostHistoryTable({
  posts,
  canPublish = false,
  onPostUpdated,
}: PostHistoryTableProps) {
  const t = useTranslations('SocialMedia');
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const handlePublish = async (postId: string) => {
    setPublishingId(postId);
    try {
      const res = await fetch('/api/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Publish failed');
      }
      toast.success(t('status.published'));
      onPostUpdated?.();
    } catch (err) {
      toast.error(
        t('errors.publishFailed', {
          message: err instanceof Error ? err.message : 'Unknown error',
        })
      );
      onPostUpdated?.();
    } finally {
      setPublishingId(null);
    }
  };

  const handleApproveAndSchedule = async (postId: string) => {
    setActionLoadingId(postId);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('social_posts')
        .update({ status: 'scheduled' })
        .eq('id', postId);

      if (error) throw error;
      toast.success(t('status.scheduled'));
      onPostUpdated?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to approve schedule'
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelSchedule = async (postId: string) => {
    setActionLoadingId(postId);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('social_posts')
        .update({ status: 'draft' })
        .eq('id', postId);

      if (error) throw error;
      toast.success(t('table.cancelSchedule'));
      onPostUpdated?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to cancel schedule'
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  if (posts.length === 0) {
    return (
      <div className="border-border bg-card flex h-48 flex-col items-center justify-center rounded-xl border p-6 text-center">
        <ImageIcon className="text-muted-foreground mb-2 size-8" />
        <p className="text-foreground text-sm font-medium">
          {t('page.noPostsYet')}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {t('page.createFirstPost')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile Stacked Cards (< 768px) */}
      <div className="flex flex-col gap-3 md:hidden">
        {posts.map((post) => {
          const isInstagram = post.social_account?.platform === 'instagram';
          return (
            <div
              key={post.id}
              className="border-border bg-card space-y-3 rounded-xl border p-4 shadow-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="bg-muted flex h-7 w-7 items-center justify-center rounded-full">
                    {isInstagram ? (
                      <Instagram className="size-3.5 text-pink-600 dark:text-pink-400" />
                    ) : (
                      <Facebook className="size-3.5 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <span className="text-foreground truncate text-xs font-medium">
                    {post.social_account?.display_name ?? t('table.account')}
                  </span>
                </div>
                <PostStatusBadge status={post.status} />
              </div>

              {post.media_url && (
                <div className="bg-muted relative aspect-video w-full overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.media_url}
                    alt={post.caption ?? 'Post media'}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              {post.caption && (
                <p className="text-foreground line-clamp-3 text-xs whitespace-pre-line">
                  {post.caption}
                </p>
              )}

              {post.scheduled_at && (
                <div className="bg-primary/5 text-primary flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium">
                  <Clock className="size-3 shrink-0" />
                  <span>
                    {t('table.scheduledFor', {
                      time: formatDateTime(post.scheduled_at),
                    })}
                  </span>
                </div>
              )}

              {post.failure_reason && post.status === 'failed' && (
                <p className="text-destructive bg-destructive/10 rounded-md p-2 text-[11px]">
                  {post.failure_reason}
                </p>
              )}

              <div className="border-border text-muted-foreground flex items-center justify-between border-t pt-2 text-[11px]">
                <span>{new Date(post.created_at).toLocaleDateString()}</span>
                <div className="flex items-center gap-1.5">
                  {canPublish &&
                    post.status === 'draft' &&
                    post.scheduled_at && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={actionLoadingId === post.id}
                        onClick={() => handleApproveAndSchedule(post.id)}
                        className="border-primary/30 text-primary hover:bg-primary/10 h-7 text-xs font-medium"
                      >
                        {actionLoadingId === post.id ? (
                          <Loader2 className="mr-1 size-3 animate-spin" />
                        ) : (
                          <CalendarCheck className="mr-1 size-3" />
                        )}
                        {t('table.approveAndSchedule')}
                      </Button>
                    )}

                  {canPublish &&
                    post.status === 'draft' &&
                    !post.scheduled_at && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={publishingId === post.id}
                        onClick={() => handlePublish(post.id)}
                        className="border-primary/30 text-primary hover:bg-primary/10 h-7 text-xs font-medium"
                      >
                        {publishingId === post.id ? (
                          <Loader2 className="mr-1 size-3 animate-spin" />
                        ) : (
                          <Send className="mr-1 size-3" />
                        )}
                        {t('table.publishDraft')}
                      </Button>
                    )}

                  {canPublish && post.status === 'scheduled' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionLoadingId === post.id}
                      onClick={() => handleCancelSchedule(post.id)}
                      className="text-muted-foreground hover:text-destructive h-7 text-xs"
                    >
                      {actionLoadingId === post.id ? (
                        <Loader2 className="mr-1 size-3 animate-spin" />
                      ) : (
                        <Ban className="mr-1 size-3" />
                      )}
                      {t('table.cancelSchedule')}
                    </Button>
                  )}

                  {canPublish && post.status === 'failed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={publishingId === post.id}
                      onClick={() => handlePublish(post.id)}
                      className="h-7 text-xs"
                    >
                      {publishingId === post.id ? (
                        <Loader2 className="mr-1 size-3 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1 size-3" />
                      )}
                      {t('page.retry')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View (>= 768px) */}
      <div className="border-border bg-card hidden overflow-x-auto rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-16"></TableHead>
              <TableHead className="text-muted-foreground">
                {t('table.account')}
              </TableHead>
              <TableHead className="text-muted-foreground">
                {t('table.caption')}
              </TableHead>
              <TableHead className="text-muted-foreground">
                {t('table.status')}
              </TableHead>
              <TableHead className="text-muted-foreground">
                {t('table.date')}
              </TableHead>
              <TableHead className="text-muted-foreground text-right">
                {t('table.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.map((post) => {
              const isInstagram = post.social_account?.platform === 'instagram';
              return (
                <TableRow
                  key={post.id}
                  className="border-border hover:bg-muted/50"
                >
                  <TableCell className="py-2.5">
                    {post.media_url ? (
                      <div className="bg-muted h-10 w-10 overflow-hidden rounded-md">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={post.media_url}
                          alt="Thumbnail"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-md">
                        <ImageIcon className="size-4" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-foreground font-medium">
                    <div className="flex items-center gap-2">
                      <div className="bg-muted flex h-6 w-6 items-center justify-center rounded-full">
                        {isInstagram ? (
                          <Instagram className="size-3 text-pink-600 dark:text-pink-400" />
                        ) : (
                          <Facebook className="size-3 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <span className="max-w-[140px] truncate">
                        {post.social_account?.display_name ?? '—'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="text-foreground truncate text-sm">
                      {post.caption || '—'}
                    </p>
                    {post.failure_reason && post.status === 'failed' && (
                      <p className="text-destructive truncate text-[11px]">
                        {post.failure_reason}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <PostStatusBadge status={post.status} />
                  </TableCell>
                  <TableCell className="text-xs">
                    {post.scheduled_at ? (
                      <div>
                        <div className="text-foreground flex items-center gap-1 font-medium">
                          <Clock className="text-primary size-3 shrink-0" />
                          <span>
                            {t('table.scheduledFor', {
                              time: formatDateTime(post.scheduled_at),
                            })}
                          </span>
                        </div>
                        <span className="text-muted-foreground text-[11px]">
                          {new Date(post.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {canPublish &&
                      post.status === 'draft' &&
                      post.scheduled_at && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={actionLoadingId === post.id}
                          onClick={() => handleApproveAndSchedule(post.id)}
                          className="text-primary hover:bg-primary/10 hover:text-primary h-7 px-2 text-xs font-medium"
                        >
                          {actionLoadingId === post.id ? (
                            <Loader2 className="mr-1 size-3 animate-spin" />
                          ) : (
                            <CalendarCheck className="mr-1 size-3" />
                          )}
                          {t('table.approveAndSchedule')}
                        </Button>
                      )}

                    {canPublish &&
                      post.status === 'draft' &&
                      !post.scheduled_at && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={publishingId === post.id}
                          onClick={() => handlePublish(post.id)}
                          className="text-primary hover:bg-primary/10 hover:text-primary h-7 px-2 text-xs font-medium"
                        >
                          {publishingId === post.id ? (
                            <Loader2 className="mr-1 size-3 animate-spin" />
                          ) : (
                            <Send className="mr-1 size-3" />
                          )}
                          {t('table.publishDraft')}
                        </Button>
                      )}

                    {canPublish && post.status === 'scheduled' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionLoadingId === post.id}
                        onClick={() => handleCancelSchedule(post.id)}
                        className="text-muted-foreground hover:text-destructive h-7 px-2 text-xs"
                      >
                        {actionLoadingId === post.id ? (
                          <Loader2 className="mr-1 size-3 animate-spin" />
                        ) : (
                          <Ban className="mr-1 size-3" />
                        )}
                        {t('table.cancelSchedule')}
                      </Button>
                    )}

                    {canPublish && post.status === 'failed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={publishingId === post.id}
                        onClick={() => handlePublish(post.id)}
                        className="h-7 px-2 text-xs"
                      >
                        {publishingId === post.id ? (
                          <Loader2 className="mr-1 size-3 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-1 size-3" />
                        )}
                        {t('page.retry')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
