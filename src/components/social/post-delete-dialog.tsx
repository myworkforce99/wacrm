'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { SocialPost } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface PostDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: SocialPost | null;
  onDeleted?: (postId: string) => void;
}

export function PostDeleteDialog({
  open,
  onOpenChange,
  post,
  onDeleted,
}: PostDeleteDialogProps) {
  const t = useTranslations('SocialMedia.delete');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!post) return null;

  const postIdentifier =
    post.caption?.slice(0, 30) || post.social_account?.display_name || 'Post';

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const supabase = createClient();

      const { error } = await supabase
        .from('social_posts')
        .delete()
        .eq('id', post.id);

      if (error) throw error;

      toast.success(t('success'));
      onOpenChange(false);
      onDeleted?.(post.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] p-4 sm:max-w-md sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <Trash2 className="size-5" />
            {t('title')}
          </DialogTitle>
          <DialogDescription className="pt-2 text-sm">
            {t('description', { name: postIdentifier })}
          </DialogDescription>
        </DialogHeader>

        {post.media_url && (
          <div className="bg-muted relative aspect-video w-full overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.media_url}
              alt="Post preview"
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="bg-destructive/10 text-destructive border-destructive/20 flex items-start gap-2 rounded-lg border p-3 text-xs">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            This post will be permanently removed from your dashboard and
            scheduled queues.
          </span>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                {t('deleting')}
              </>
            ) : (
              <>
                <Trash2 className="mr-1.5 size-4" />
                {t('confirm')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
