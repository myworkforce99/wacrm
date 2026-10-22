'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SocialPost } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { PostStatusBadge } from './post-status-badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  CalendarCheck,
  Clock,
  ExternalLink,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
  Ban,
  User,
  Sparkles,
} from 'lucide-react';
import { Instagram, Facebook } from '@/components/social/icons';
import { toast } from 'sonner';

interface PostPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: SocialPost | null;
  canPublish?: boolean;
  canManage?: boolean;
  onEditPost?: (post: SocialPost) => void;
  onDeletePost?: (post: SocialPost) => void;
  onPostUpdated?: () => void;
}

export function PostPreviewDialog({
  open,
  onOpenChange,
  post,
  canPublish = false,
  canManage = false,
  onEditPost,
  onDeletePost,
  onPostUpdated,
}: PostPreviewDialogProps) {
  const t = useTranslations('SocialMedia');
  const [publishing, setPublishing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  if (!post) return null;

  const isInstagram = post.social_account?.platform === 'instagram';

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const handlePublishNow = async () => {
    setPublishing(true);
    try {
      const res = await fetch('/api/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Publish failed');
      }
      toast.success(t('status.published'));
      onOpenChange(false);
      onPostUpdated?.();
    } catch (err) {
      toast.error(
        t('errors.publishFailed', {
          message: err instanceof Error ? err.message : 'Unknown error',
        })
      );
      onPostUpdated?.();
    } finally {
      setPublishing(false);
    }
  };

  const handleApproveAndSchedule = async () => {
    setActionLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('social_posts')
        .update({ status: 'scheduled' })
        .eq('id', post.id);

      if (error) throw error;
      toast.success(t('status.scheduled'));
      onOpenChange(false);
      onPostUpdated?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to approve schedule'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSchedule = async () => {
    setActionLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('social_posts')
        .update({ status: 'draft' })
        .eq('id', post.id);

      if (error) throw error;
      toast.success(t('table.cancelSchedule'));
      onOpenChange(false);
      onPostUpdated?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to cancel schedule'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Helper to highlight hashtags in caption
  const renderFormattedCaption = (text: string) => {
    const words = text.split(/(\s+)/);
    return words.map((word, i) => {
      if (word.startsWith('#') && word.length > 1) {
        return (
          <span key={i} className="text-primary font-medium">
            {word}
          </span>
        );
      }
      return word;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-[95vw] flex-col overflow-hidden p-4 sm:max-w-xl sm:p-6">
        {/* Header */}
        <DialogHeader className="border-border border-b p-0 pb-3">
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              {isInstagram ? (
                <Instagram className="size-4 text-pink-600 dark:text-pink-400" />
              ) : (
                <Facebook className="size-4 text-blue-600 dark:text-blue-400" />
              )}
              <span>{t('preview.title')}</span>
            </DialogTitle>
            <PostStatusBadge status={post.status} />
          </div>
        </DialogHeader>

        {/* Scrollable Preview Body */}
        <div className="flex-1 scrollbar-none space-y-4 overflow-y-auto py-2 pr-1">
          {/* Simulated Social Post Card */}
          <div className="border-border bg-card overflow-hidden rounded-xl border shadow-xs">
            {/* Social Header */}
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2.5">
                <Avatar className="border-border size-9 border">
                  {post.social_account?.avatar_url && (
                    <AvatarImage
                      src={post.social_account.avatar_url}
                      alt={post.social_account.display_name}
                    />
                  )}
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {post.social_account?.display_name
                      ?.charAt(0)
                      .toUpperCase() ?? 'W'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-foreground text-xs font-semibold">
                      {post.social_account?.display_name ?? 'Connected Page'}
                    </p>
                    {isInstagram ? (
                      <Instagram className="size-3 text-pink-600 dark:text-pink-400" />
                    ) : (
                      <Facebook className="size-3 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <p className="text-muted-foreground text-[10px]">
                    {post.created_at
                      ? formatDateTime(post.created_at)
                      : 'Draft'}
                  </p>
                </div>
              </div>

              {post.creator && (
                <div className="border-border bg-muted/60 text-muted-foreground flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]">
                  <User className="size-3" />
                  <span className="text-foreground font-medium">
                    {post.creator.full_name}
                  </span>
                </div>
              )}
            </div>

            {/* Post Media */}
            {post.media_url ? (
              <div className="bg-muted relative aspect-square w-full overflow-hidden sm:aspect-4/3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.media_url}
                  alt={post.caption ?? 'Social media image'}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="bg-muted text-muted-foreground flex aspect-video w-full flex-col items-center justify-center gap-2 text-xs">
                <span>No media attached</span>
              </div>
            )}

            {/* Simulated Action Bar */}
            <div className="border-border flex items-center justify-between border-t px-3 py-2">
              <div className="text-foreground flex items-center gap-4">
                <Heart className="size-4.5 cursor-pointer transition-colors hover:text-red-500" />
                <MessageCircle className="hover:text-primary size-4.5 cursor-pointer transition-colors" />
                <Send className="hover:text-primary size-4.5 cursor-pointer transition-colors" />
              </div>
              <Bookmark className="text-foreground hover:text-primary size-4.5 cursor-pointer transition-colors" />
            </div>

            {/* Caption Content */}
            <div className="space-y-2 p-3 pt-1">
              {post.caption ? (
                <div className="text-foreground text-xs leading-relaxed whitespace-pre-line">
                  <span className="mr-1.5 font-semibold">
                    {post.social_account?.display_name ?? 'account'}
                  </span>
                  {renderFormattedCaption(post.caption)}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs italic">
                  No caption provided
                </p>
              )}
            </div>
          </div>

          {/* Metadata Alerts */}
          {post.status === 'draft' && !canPublish && (
            <div className="border-primary/20 bg-primary/5 text-foreground flex items-start gap-2.5 rounded-xl border p-3 text-xs">
              <Sparkles className="text-primary mt-0.5 size-4 shrink-0" />
              <div>
                <p className="text-primary font-semibold">
                  {t('preview.reviewPending')}
                </p>
                <p className="text-muted-foreground mt-0.5 text-[11px]">
                  {t('preview.reviewPendingDesc')}
                </p>
              </div>
            </div>
          )}

          {post.scheduled_at && (
            <div className="border-border bg-card flex items-center justify-between rounded-xl border p-3 text-xs shadow-xs">
              <div className="text-primary flex items-center gap-2 font-medium">
                <Clock className="size-4 shrink-0" />
                <span>
                  {t('preview.scheduleFor', {
                    time: formatDateTime(post.scheduled_at),
                  })}
                </span>
              </div>
              <PostStatusBadge status={post.status} />
            </div>
          )}

          {post.status === 'failed' && post.failure_reason && (
            <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-start gap-2.5 rounded-xl border p-3 text-xs">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">{t('preview.failedNotice')}</p>
                <p className="mt-0.5 font-mono text-[11px] break-all">
                  {post.failure_reason}
                </p>
              </div>
            </div>
          )}

          {post.status === 'published' && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-600 dark:text-emerald-400">
              <div className="flex items-center gap-2">
                <PostStatusBadge status="published" />
                <span>
                  {t('preview.publishedOn', {
                    time: formatDateTime(post.updated_at),
                  })}
                </span>
              </div>

              {post.platform_post_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = isInstagram
                      ? `https://instagram.com`
                      : `https://facebook.com`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                  className="h-7 border-emerald-500/30 text-xs text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                >
                  <ExternalLink className="mr-1.5 size-3.5" />
                  {t('preview.viewLive')}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Action Bar Footer */}
        <div className="border-border mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div className="flex items-center gap-2">
            {canManage && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    onEditPost?.(post);
                  }}
                  className="h-8 text-xs"
                >
                  <Edit className="mr-1.5 size-3.5" />
                  {t('preview.editPost')}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    onDeletePost?.(post);
                  }}
                  className="text-muted-foreground hover:text-destructive hover:border-destructive/30 h-8 text-xs"
                >
                  <Trash2 className="mr-1.5 size-3.5" />
                  {t('preview.deletePost')}
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canPublish && post.status === 'draft' && post.scheduled_at && (
              <Button
                type="button"
                size="sm"
                disabled={actionLoading || publishing}
                onClick={handleApproveAndSchedule}
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-xs font-medium"
              >
                {actionLoading ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <CalendarCheck className="mr-1.5 size-3.5" />
                )}
                {t('table.approveAndSchedule')}
              </Button>
            )}

            {canPublish && post.status === 'draft' && (
              <Button
                type="button"
                size="sm"
                disabled={publishing || actionLoading}
                onClick={handlePublishNow}
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-xs font-medium"
              >
                {publishing ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Send className="mr-1.5 size-3.5" />
                )}
                {t('table.publishDraft')}
              </Button>
            )}

            {canPublish && post.status === 'scheduled' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={actionLoading || publishing}
                  onClick={handleCancelSchedule}
                  className="text-muted-foreground hover:text-destructive h-8 text-xs"
                >
                  {actionLoading ? (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <Ban className="mr-1.5 size-3.5" />
                  )}
                  {t('table.cancelSchedule')}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  disabled={publishing || actionLoading}
                  onClick={handlePublishNow}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-xs font-medium"
                >
                  {publishing ? (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 size-3.5" />
                  )}
                  {t('composer.publishNow')}
                </Button>
              </>
            )}

            {canPublish && post.status === 'failed' && (
              <Button
                type="button"
                size="sm"
                disabled={publishing}
                onClick={handlePublishNow}
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-xs font-medium"
              >
                {publishing ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 size-3.5" />
                )}
                {t('page.retry')}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
