'use client';

import { useState, useRef, useTransition, useId } from 'react';
import { useTranslations } from 'next-intl';
import { SocialAccount } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { uploadAccountMedia } from '@/lib/storage/upload-media';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, X, Upload, Info, FileCheck } from 'lucide-react';
import { Instagram, Facebook } from '@/components/social/icons';
import { toast } from 'sonner';

interface PostComposerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: SocialAccount[];
  accountId: string;
  canPublish?: boolean;
  onPostCreated?: () => void;
}

export function PostComposerSheet({
  open,
  onOpenChange,
  accounts,
  accountId,
  canPublish = true,
  onPostCreated,
}: PostComposerSheetProps) {
  const t = useTranslations('SocialMedia');
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id ?? ''
  );
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaStoragePath, setMediaStoragePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, startSubmitting] = useTransition();

  const selectedAccount =
    accounts.find((a) => a.id === selectedAccountId) ?? accounts[0];
  const isInstagram = selectedAccount?.platform === 'instagram';
  const charLimit = isInstagram ? 2200 : 63206;
  const charsRemaining = charLimit - caption.length;

  const resetForm = () => {
    setCaption('');
    setMediaUrl(null);
    setMediaStoragePath(null);
    setUploading(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Only image files (PNG, JPG, WebP) are supported');
      return;
    }

    setUploading(true);
    try {
      let result;
      try {
        result = await uploadAccountMedia('social-media', file);
      } catch {
        // Fallback to chat-media bucket if social-media bucket is not yet active
        result = await uploadAccountMedia('chat-media', file);
      }
      setMediaUrl(result.publicUrl);
      setMediaStoragePath(result.path);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(
        t('errors.uploadFailed') +
          (err instanceof Error ? `: ${err.message}` : '')
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSaveDraft = () => {
    if (!selectedAccount) {
      toast.error('Please select an account');
      return;
    }

    startSubmitting(async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.from('social_posts').insert({
          account_id: accountId,
          social_account_id: selectedAccount.id,
          caption: caption.trim() || null,
          media_url: mediaUrl,
          media_storage_path: mediaStoragePath,
          status: 'draft',
        });

        if (error) throw error;
        toast.success(t('status.draft') + ' saved');
        resetForm();
        onOpenChange(false);
        onPostCreated?.();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to save draft'
        );
      }
    });
  };

  const handlePublishNow = () => {
    if (!selectedAccount) {
      toast.error('Please select an account');
      return;
    }

    if (!mediaUrl) {
      toast.error(t('errors.missingMedia'));
      return;
    }

    startSubmitting(async () => {
      try {
        const supabase = createClient();

        // Step 1: Create social_post row
        const { data: newPost, error: insertErr } = await supabase
          .from('social_posts')
          .insert({
            account_id: accountId,
            social_account_id: selectedAccount.id,
            caption: caption.trim() || null,
            media_url: mediaUrl,
            media_storage_path: mediaStoragePath,
            status: 'publishing',
          })
          .select('id')
          .single();

        if (insertErr || !newPost) {
          throw new Error(insertErr?.message ?? 'Failed to create post record');
        }

        // Step 2: Trigger publish endpoint
        const res = await fetch('/api/social/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ post_id: newPost.id }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? 'Publish failed');
        }

        toast.success(t('status.published'));
        resetForm();
        onOpenChange(false);
        onPostCreated?.();
      } catch (err) {
        toast.error(
          t('errors.publishFailed', {
            message: err instanceof Error ? err.message : 'Unknown error',
          })
        );
        onPostCreated?.();
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col justify-between overflow-y-auto p-6 sm:max-w-lg"
      >
        <div className="space-y-6">
          <SheetHeader className="p-0">
            <SheetTitle className="text-xl font-bold">
              {t('composer.title')}
            </SheetTitle>
          </SheetHeader>

          {!canPublish && (
            <div className="border-primary/20 bg-primary/5 text-foreground/90 flex items-start gap-2.5 rounded-lg border p-3 text-xs">
              <Info className="text-primary mt-0.5 size-4 shrink-0" />
              <span>{t('composer.agentNotice')}</span>
            </div>
          )}

          {/* Account Selector */}
          <div className="space-y-2">
            <label className="text-foreground text-sm font-medium">
              {t('composer.selectAccount')}
            </label>
            <Select
              value={selectedAccountId}
              onValueChange={(val) => {
                if (val) setSelectedAccountId(val as string);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('composer.selectAccount')} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    <div className="flex items-center gap-2">
                      {acc.platform === 'instagram' ? (
                        <Instagram className="size-3.5 text-pink-600 dark:text-pink-400" />
                      ) : (
                        <Facebook className="size-3.5 text-blue-600 dark:text-blue-400" />
                      )}
                      <span>{acc.display_name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Media Uploader */}
          <div className="space-y-2">
            <label className="text-foreground text-sm font-medium">
              {t('composer.uploadImage')}
            </label>

            <input
              id={fileInputId}
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {mediaUrl ? (
              <div className="border-border bg-muted relative aspect-video w-full overflow-hidden rounded-xl border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaUrl}
                  alt="Post preview"
                  className="h-full w-full object-cover"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  onClick={() => {
                    setMediaUrl(null);
                    setMediaStoragePath(null);
                  }}
                  className="bg-background/80 hover:bg-background absolute top-2 right-2 rounded-full shadow-xs"
                >
                  <X className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-background/80 hover:bg-background absolute right-2 bottom-2 text-xs"
                >
                  {t('composer.changeImage')}
                </Button>
              </div>
            ) : (
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="border-border hover:border-primary/50 hover:bg-muted/50 bg-muted/20 flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors"
              >
                {uploading ? (
                  <Loader2 className="text-primary size-8 animate-spin" />
                ) : (
                  <>
                    <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full">
                      <Upload className="size-5" />
                    </div>
                    <span className="text-foreground text-xs font-medium">
                      {t('composer.uploadImage')}
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      PNG, JPG or WebP (max 16MB)
                    </span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Caption Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-foreground text-sm font-medium">
                {t('composer.caption')}
              </label>
              <span
                className={`text-xs ${
                  charsRemaining < 0
                    ? 'text-destructive font-semibold'
                    : 'text-muted-foreground'
                }`}
              >
                {t('composer.charactersLeft', { count: charsRemaining })}
              </span>
            </div>

            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t('composer.captionPlaceholder')}
              rows={5}
              className="resize-none"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-border mt-6 flex items-center justify-end gap-3 border-t pt-4">
          {canPublish ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting || uploading}
                onClick={handleSaveDraft}
              >
                {t('composer.saveDraft')}
              </Button>

              <Button
                type="button"
                disabled={
                  isSubmitting || uploading || !mediaUrl || charsRemaining < 0
                }
                onClick={handlePublishNow}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    {t('composer.publishing')}
                  </>
                ) : (
                  t('composer.publishNow')
                )}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              disabled={isSubmitting || uploading || charsRemaining < 0}
              onClick={handleSaveDraft}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t('composer.publishing')}
                </>
              ) : (
                <>
                  <FileCheck className="mr-2 size-4" />
                  {t('composer.submitForReview')}
                </>
              )}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
