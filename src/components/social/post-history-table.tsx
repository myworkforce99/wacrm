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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  RefreshCw,
  Loader2,
  Image as ImageIcon,
  Send,
  Clock,
  CalendarCheck,
  Ban,
  Eye,
  MoreVertical,
  Edit,
  Trash2,
  User,
} from 'lucide-react';
import { Instagram, Facebook } from '@/components/social/icons';
import { toast } from 'sonner';

interface PostHistoryTableProps {
  posts: SocialPost[];
  canManage?: boolean;
  canPublish?: boolean;
  onPreviewPost?: (post: SocialPost) => void;
  onEditPost?: (post: SocialPost) => void;
  onDeletePost?: (post: SocialPost) => void;
  onPostUpdated?: () => void;
}

export function PostHistoryTable({
  posts,
  canManage = false,
  canPublish = false,
  onPreviewPost,
  onEditPost,
  onDeletePost,
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
        <ImageIcon className="text-muted-foreground mb-2 size-8 opacity-40" />
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
              onClick={() => onPreviewPost?.(post)}
              className="border-border bg-card hover:border-primary/50 relative cursor-pointer space-y-3 rounded-xl border p-4 shadow-xs transition-colors"
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
                  <span className="text-foreground truncate text-xs font-semibold">
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
                <p className="text-foreground line-clamp-3 text-xs leading-relaxed whitespace-pre-line">
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

              <div
                className="border-border text-muted-foreground flex items-center justify-between border-t pt-2 text-[11px]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2">
                  <span>{new Date(post.created_at).toLocaleDateString()}</span>
                  {post.creator && (
                    <span className="text-foreground/80 flex items-center gap-1">
                      • <User className="size-3" />
                      <span>{post.creator.full_name.split(' ')[0]}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPreviewPost?.(post)}
                    className="h-7 px-2 text-xs font-medium"
                  >
                    <Eye className="mr-1 size-3.5" />
                    {t('table.preview')}
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-foreground h-7 w-7"
                        >
                          <MoreVertical className="size-3.5" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => onPreviewPost?.(post)}>
                        <Eye className="mr-2 size-3.5" />
                        <span>{t('table.preview')}</span>
                      </DropdownMenuItem>

                      {canManage && (
                        <DropdownMenuItem onClick={() => onEditPost?.(post)}>
                          <Edit className="mr-2 size-3.5" />
                          <span>{t('table.edit')}</span>
                        </DropdownMenuItem>
                      )}

                      {canPublish &&
                        post.status === 'draft' &&
                        post.scheduled_at && (
                          <DropdownMenuItem
                            onClick={() => handleApproveAndSchedule(post.id)}
                            className="text-primary font-medium"
                          >
                            <CalendarCheck className="mr-2 size-3.5" />
                            <span>{t('table.approveAndSchedule')}</span>
                          </DropdownMenuItem>
                        )}

                      {canPublish &&
                        post.status === 'draft' &&
                        !post.scheduled_at && (
                          <DropdownMenuItem
                            onClick={() => handlePublish(post.id)}
                            className="text-primary font-medium"
                          >
                            <Send className="mr-2 size-3.5" />
                            <span>{t('table.publishDraft')}</span>
                          </DropdownMenuItem>
                        )}

                      {canPublish && post.status === 'scheduled' && (
                        <DropdownMenuItem
                          onClick={() => handleCancelSchedule(post.id)}
                        >
                          <Ban className="mr-2 size-3.5" />
                          <span>{t('table.cancelSchedule')}</span>
                        </DropdownMenuItem>
                      )}

                      {canPublish && post.status === 'failed' && (
                        <DropdownMenuItem
                          onClick={() => handlePublish(post.id)}
                        >
                          <RefreshCw className="mr-2 size-3.5" />
                          <span>{t('page.retry')}</span>
                        </DropdownMenuItem>
                      )}

                      {canManage && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDeletePost?.(post)}
                            className="text-destructive focus:text-destructive cursor-pointer"
                          >
                            <Trash2 className="mr-2 size-3.5" />
                            <span>{t('table.delete')}</span>
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View (>= 768px) */}
      <div className="border-border bg-card hidden overflow-x-auto rounded-xl border shadow-xs md:block">
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
                {t('table.author')}
              </TableHead>
              <TableHead className="text-muted-foreground">
                {t('table.status')}
              </TableHead>
              <TableHead className="text-muted-foreground">
                {t('table.date')}
              </TableHead>
              <TableHead className="text-muted-foreground pr-4 text-right">
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
                  onClick={() => onPreviewPost?.(post)}
                  className="border-border hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  {/* Thumbnail */}
                  <TableCell className="py-2.5">
                    {post.media_url ? (
                      <div className="bg-muted border-border h-10 w-10 overflow-hidden rounded-md border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={post.media_url}
                          alt="Thumbnail"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="bg-muted text-muted-foreground border-border flex h-10 w-10 items-center justify-center rounded-md border">
                        <ImageIcon className="size-4 opacity-40" />
                      </div>
                    )}
                  </TableCell>

                  {/* Account */}
                  <TableCell className="text-foreground font-medium">
                    <div className="flex items-center gap-2">
                      <div className="bg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                        {isInstagram ? (
                          <Instagram className="size-3 text-pink-600 dark:text-pink-400" />
                        ) : (
                          <Facebook className="size-3 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <span className="max-w-[130px] truncate text-xs font-semibold">
                        {post.social_account?.display_name ?? '—'}
                      </span>
                    </div>
                  </TableCell>

                  {/* Caption */}
                  <TableCell className="max-w-xs">
                    <p className="text-foreground truncate text-sm">
                      {post.caption || (
                        <span className="text-muted-foreground italic">
                          No caption
                        </span>
                      )}
                    </p>
                    {post.failure_reason && post.status === 'failed' && (
                      <p className="text-destructive truncate font-mono text-[11px]">
                        {post.failure_reason}
                      </p>
                    )}
                  </TableCell>

                  {/* Creator */}
                  <TableCell className="text-muted-foreground text-xs">
                    {post.creator ? (
                      <span className="text-foreground flex items-center gap-1.5 font-medium">
                        <User className="text-muted-foreground size-3" />
                        <span className="max-w-[110px] truncate">
                          {post.creator.full_name}
                        </span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <PostStatusBadge status={post.status} />
                  </TableCell>

                  {/* Date / Schedule */}
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

                  {/* Actions */}
                  <TableCell
                    className="pr-4 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onPreviewPost?.(post)}
                        className="text-muted-foreground hover:text-foreground h-7 px-2 text-xs font-medium"
                      >
                        <Eye className="mr-1 size-3.5" />
                        {t('table.preview')}
                      </Button>

                      {canPublish &&
                        post.status === 'draft' &&
                        post.scheduled_at && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={actionLoadingId === post.id}
                            onClick={() => handleApproveAndSchedule(post.id)}
                            className="border-primary/30 text-primary hover:bg-primary/10 h-7 px-2 text-xs font-medium"
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
                            className="border-primary/30 text-primary hover:bg-primary/10 h-7 px-2 text-xs font-medium"
                          >
                            {publishingId === post.id ? (
                              <Loader2 className="mr-1 size-3 animate-spin" />
                            ) : (
                              <Send className="mr-1 size-3" />
                            )}
                            {t('table.publishDraft')}
                          </Button>
                        )}

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-foreground h-7 w-7"
                            >
                              <MoreVertical className="size-3.5" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            onClick={() => onPreviewPost?.(post)}
                          >
                            <Eye className="mr-2 size-3.5" />
                            <span>{t('table.preview')}</span>
                          </DropdownMenuItem>

                          {canManage && (
                            <DropdownMenuItem
                              onClick={() => onEditPost?.(post)}
                            >
                              <Edit className="mr-2 size-3.5" />
                              <span>{t('table.edit')}</span>
                            </DropdownMenuItem>
                          )}

                          {canPublish && post.status === 'scheduled' && (
                            <DropdownMenuItem
                              onClick={() => handleCancelSchedule(post.id)}
                            >
                              <Ban className="mr-2 size-3.5" />
                              <span>{t('table.cancelSchedule')}</span>
                            </DropdownMenuItem>
                          )}

                          {canPublish && post.status === 'failed' && (
                            <DropdownMenuItem
                              onClick={() => handlePublish(post.id)}
                            >
                              <RefreshCw className="mr-2 size-3.5" />
                              <span>{t('page.retry')}</span>
                            </DropdownMenuItem>
                          )}

                          {canManage && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onDeletePost?.(post)}
                                className="text-destructive focus:text-destructive cursor-pointer"
                              >
                                <Trash2 className="mr-2 size-3.5" />
                                <span>{t('table.delete')}</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
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
