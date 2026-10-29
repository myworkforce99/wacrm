'use client';

import { useState, useEffect, useRef, useTransition, useId } from 'react';
import { useTranslations } from 'next-intl';
import type { SocialAccount } from '@/types';
import { createClient } from '@/lib/supabase/client';
import {
  uploadAccountMedia,
  compressImageIfNeeded,
} from '@/lib/storage/upload-media';
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
import {
  Loader2,
  X,
  Upload,
  Info,
  FileCheck,
  Sparkles,
  LayoutTemplate,
  Building2,
} from 'lucide-react';
import { Instagram, Facebook } from '@/components/social/icons';
import { TemplatePicker } from '@/components/social/template-picker';
import { PropertyAttachPicker } from '@/components/social/property-attach-picker';
import { SocialPostTemplate } from '@/lib/social/templates';
import { SocialPost } from '@/types';
import { toast } from 'sonner';

interface PostComposerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: SocialAccount[];
  accountId: string;
  canPublish?: boolean;
  postToEdit?: SocialPost | null;
  initialDate?: string | null;
  onPostCreated?: () => void;
}

export function PostComposerSheet({
  open,
  onOpenChange,
  accounts,
  accountId,
  canPublish = true,
  postToEdit = null,
  initialDate = null,
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
  const [scheduledAt, setScheduledAt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, startSubmitting] = useTransition();

  // Phase 3: AI Caption Assist & Templates State
  const [showAiAssist, setShowAiAssist] = useState(false);
  const [propertyDetails, setPropertyDetails] = useState('');
  const [tone, setTone] = useState<'professional' | 'friendly' | 'urgent'>(
    'professional'
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [propertyPickerOpen, setPropertyPickerOpen] = useState(false);

  const selectedAccount =
    accounts.find((a) => a.id === selectedAccountId) ?? accounts[0];
  const isInstagram = selectedAccount?.platform === 'instagram';
  const charLimit = isInstagram ? 2200 : 63206;
  const charsRemaining = charLimit - caption.length;

  const formatScheduleTime = (dateStr: string) => {
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

  const resetForm = () => {
    setCaption('');
    setMediaUrl(null);
    setMediaStoragePath(null);
    setScheduledAt('');
    setUploading(false);
    setPropertyDetails('');
    setShowAiAssist(false);
    setIsGenerating(false);
  };

  // Sync state on open or postToEdit change
  useEffect(() => {
    if (!open) return;
    if (postToEdit) {
      setSelectedAccountId(postToEdit.social_account_id);
      setCaption(postToEdit.caption ?? '');
      setMediaUrl(postToEdit.media_url ?? null);
      setMediaStoragePath(postToEdit.media_storage_path ?? null);
      setScheduledAt(
        postToEdit.scheduled_at ? postToEdit.scheduled_at.slice(0, 16) : ''
      );
    } else {
      resetForm();
      if (initialDate) {
        setScheduledAt(`${initialDate}T10:00`);
      }
    }
  }, [open, postToEdit, initialDate]);

  const handleUpdatePost = () => {
    if (!postToEdit) return;
    startSubmitting(async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase
          .from('social_posts')
          .update({
            social_account_id: selectedAccountId,
            caption: caption.trim() || null,
            media_url: mediaUrl,
            media_storage_path: mediaStoragePath,
            scheduled_at: scheduledAt
              ? new Date(scheduledAt).toISOString()
              : null,
            status: scheduledAt
              ? canPublish
                ? 'scheduled'
                : 'draft'
              : postToEdit.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', postToEdit.id);

        if (error) throw error;
        toast.success(t('composer.postUpdated'));
        onOpenChange(false);
        onPostCreated?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Update failed');
      }
    });
  };

  const handleSelectProperty = (
    propertyText: string,
    suggestedHashtags: string[]
  ) => {
    setPropertyDetails(propertyText);
    setShowAiAssist(true);
    void handleGenerateCaption(propertyText, suggestedHashtags);
  };

  const handleGenerateCaption = async (
    overrideDetails?: string,
    suggestedHashtags?: string[]
  ) => {
    const details = (overrideDetails ?? propertyDetails).trim();
    if (!details) {
      toast.error('Please enter property details to generate a caption');
      setShowAiAssist(true);
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/social/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: selectedAccount?.platform ?? 'instagram',
          property_details: details,
          tone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to generate caption');
      }

      let generated = (data.caption as string) || '';
      if (suggestedHashtags && suggestedHashtags.length > 0) {
        const tagsString = suggestedHashtags.join(' ');
        if (!generated.includes(suggestedHashtags[0])) {
          generated = `${generated.trim()}\n\n${tagsString}`;
        }
      }

      setCaption(generated);
      toast.success('Caption generated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectTemplate = (template: SocialPostTemplate) => {
    setPropertyDetails(template.promptSeed);
    setShowAiAssist(true);
    void handleGenerateCaption(template.promptSeed, template.suggestedHashtags);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    if (!rawFile.type.startsWith('image/')) {
      toast.error('Only image files (PNG, JPG, WebP) are supported');
      return;
    }

    setUploading(true);
    try {
      const file = await compressImageIfNeeded(rawFile);
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
          scheduled_at: scheduledAt
            ? new Date(scheduledAt).toISOString()
            : null,
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

  const handleSchedule = () => {
    if (!selectedAccount) {
      toast.error('Please select an account');
      return;
    }

    if (!mediaUrl) {
      toast.error(t('errors.missingMedia'));
      return;
    }

    if (!scheduledAt) {
      toast.error('Please select a date and time');
      return;
    }

    startSubmitting(async () => {
      try {
        const supabase = createClient();
        const scheduledIso = new Date(scheduledAt).toISOString();
        const { error } = await supabase.from('social_posts').insert({
          account_id: accountId,
          social_account_id: selectedAccount.id,
          caption: caption.trim() || null,
          media_url: mediaUrl,
          media_storage_path: mediaStoragePath,
          status: 'scheduled',
          scheduled_at: scheduledIso,
        });

        if (error) throw error;
        toast.success(
          t('composer.scheduledSuccessfully', {
            time: formatScheduleTime(scheduledAt),
          })
        );
        resetForm();
        onOpenChange(false);
        onPostCreated?.();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to schedule post'
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
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col justify-between overflow-x-hidden overflow-y-auto p-4 data-[side=right]:w-full data-[side=right]:max-w-full sm:p-6 data-[side=right]:sm:max-w-xl"
        >
          <div className="space-y-6">
            <SheetHeader className="p-0">
              <SheetTitle className="text-xl font-bold">
                {postToEdit ? t('composer.editTitle') : t('composer.title')}
              </SheetTitle>
            </SheetHeader>

            {!canPublish && (
              <div className="border-primary/20 bg-primary/5 text-foreground/90 flex items-start gap-2.5 rounded-lg border p-3 text-xs">
                <Info className="text-primary mt-0.5 size-4 shrink-0" />
                <span>
                  {scheduledAt
                    ? t('composer.scheduledDraftNotice')
                    : t('composer.agentNotice')}
                </span>
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

            {/* Caption Textarea & AI Assist Section */}
            <div className="space-y-2.5">
              {/* Header: Label + Character Counter */}
              <div className="flex items-center justify-between">
                <label className="text-foreground text-sm font-medium">
                  {t('composer.caption')}
                </label>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground text-[11px]">
                    {caption ? `${caption.length} chars` : ''}
                  </span>
                  <span
                    className={
                      charsRemaining < 0
                        ? 'text-destructive text-[11px] font-semibold'
                        : 'text-muted-foreground text-[11px]'
                    }
                  >
                    {t('composer.charactersLeft', { count: charsRemaining })}
                  </span>
                </div>
              </div>

              {/* Action Toolbar Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPropertyPickerOpen(true)}
                  className="hover:bg-muted h-7 rounded-full px-2.5 text-xs"
                >
                  <Building2 className="text-muted-foreground mr-1.5 size-3.5" />
                  {t('composer.attachProperty')}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTemplatePickerOpen(true)}
                  className="hover:bg-muted h-7 rounded-full px-2.5 text-xs"
                >
                  <LayoutTemplate className="text-muted-foreground mr-1.5 size-3.5" />
                  {t('composer.useTemplate')}
                </Button>

                <Button
                  type="button"
                  variant={showAiAssist ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setShowAiAssist(!showAiAssist)}
                  className="border-primary/20 hover:bg-primary/10 text-primary h-7 rounded-full px-2.5 text-xs"
                >
                  <Sparkles className="mr-1.5 size-3.5" />
                  {t('composer.aiAssistLabel')}
                </Button>
              </div>

              {/* AI Assist Drawer Box */}
              {showAiAssist && (
                <div className="border-primary/20 bg-primary/5 space-y-2.5 rounded-xl border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
                      <Sparkles className="text-primary size-3" />
                      {t('composer.generateCaption')}
                    </span>
                    <div className="flex flex-wrap items-center gap-1 text-[11px]">
                      {(['professional', 'friendly', 'urgent'] as const).map(
                        (tVal) => (
                          <button
                            key={tVal}
                            type="button"
                            onClick={() => setTone(tVal)}
                            className={`cursor-pointer rounded-full px-2 py-0.5 capitalize transition-colors ${
                              tone === tVal
                                ? 'bg-primary text-primary-foreground font-medium'
                                : 'bg-background/80 text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {t(
                              `composer.tone${
                                (tVal.charAt(0).toUpperCase() +
                                  tVal.slice(1)) as
                                  'Professional' | 'Friendly' | 'Urgent'
                              }`
                            )}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={propertyDetails}
                      onChange={(e) => setPropertyDetails(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isGenerating) {
                          e.preventDefault();
                          void handleGenerateCaption();
                        }
                      }}
                      placeholder={t('composer.propertyDetailsPlaceholder')}
                      className="border-border bg-background text-foreground focus:ring-primary w-full min-w-0 flex-1 rounded-md border px-3 py-1.5 text-xs shadow-xs focus:ring-1 focus:outline-hidden"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={isGenerating || !propertyDetails.trim()}
                      onClick={() => void handleGenerateCaption()}
                      className="bg-primary text-primary-foreground h-8 w-full shrink-0 px-3 text-xs sm:w-auto"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-1.5 size-3 animate-spin" />
                          {t('composer.generating')}
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-1.5 size-3" />
                          {t('composer.generateCaption')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={t('composer.captionPlaceholder')}
                rows={5}
                className="resize-none"
              />
            </div>

            {/* Schedule Post for Later */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="schedule-datetime"
                  className="text-foreground text-sm font-medium"
                >
                  {t('composer.schedulePost')}
                </label>
                {scheduledAt && (
                  <button
                    type="button"
                    onClick={() => setScheduledAt('')}
                    className="text-muted-foreground hover:text-foreground text-xs"
                  >
                    {t('composer.cancelSchedule')}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="schedule-datetime"
                  type="datetime-local"
                  min={new Date().toISOString().slice(0, 16)}
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="border-border bg-background text-foreground focus:ring-ring focus:border-ring w-full rounded-md border px-3 py-2 text-sm shadow-xs focus:ring-1 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="border-border mt-6 flex flex-wrap items-center justify-end gap-2.5 border-t pt-4">
            {postToEdit ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting || uploading}
                  onClick={() => onOpenChange(false)}
                >
                  {t('delete.cancel')}
                </Button>
                <Button
                  type="button"
                  disabled={
                    isSubmitting || uploading || !mediaUrl || charsRemaining < 0
                  }
                  onClick={handleUpdatePost}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      {t('composer.updating')}
                    </>
                  ) : (
                    t('composer.updatePost')
                  )}
                </Button>
              </>
            ) : canPublish ? (
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
                    isSubmitting ||
                    uploading ||
                    !mediaUrl ||
                    charsRemaining < 0 ||
                    (Boolean(scheduledAt) &&
                      isNaN(new Date(scheduledAt).getTime()))
                  }
                  onClick={scheduledAt ? handleSchedule : handlePublishNow}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      {t('composer.publishing')}
                    </>
                  ) : scheduledAt ? (
                    t('composer.scheduleFor', {
                      time: formatScheduleTime(scheduledAt),
                    })
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

      {/* Template Picker Dialog */}
      <TemplatePicker
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* Property Attach Picker Dialog */}
      <PropertyAttachPicker
        open={propertyPickerOpen}
        onOpenChange={setPropertyPickerOpen}
        accountId={accountId}
        onSelectProperty={handleSelectProperty}
      />
    </>
  );
}
