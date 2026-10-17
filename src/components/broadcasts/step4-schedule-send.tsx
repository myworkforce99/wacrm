'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Send,
  Loader2,
  Users,
  Save,
  Check,
  Zap,
  CalendarClock,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

interface AudienceConfig {
  type: string;
  tagIds?: string[];
  csvContacts?: { phone: string; name?: string }[];
}

interface Step4Props {
  name: string;
  onNameChange: (name: string) => void;
  template: MessageTemplate;
  audience: AudienceConfig;
  onSend: () => void;
  onSaveDraft?: () => void;
  onBack: () => void;
  isProcessing: boolean;
  progress: number;
}

export function Step4ScheduleSend({
  name,
  onNameChange,
  template,
  audience,
  onSend,
  onSaveDraft,
  onBack,
  isProcessing,
  progress,
}: Step4Props) {
  const t = useTranslations('Broadcasts.wizard');
  const [showConfirm, setShowConfirm] = useState(false);
  const [estimatedReach, setEstimatedReach] = useState<number>(0);
  const [loadingReach, setLoadingReach] = useState(true);
  const [sendLater, setSendLater] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');

  const costPerMessage =
    template.category?.toUpperCase() === 'MARKETING'
      ? 0.78
      : template.category?.toUpperCase() === 'UTILITY'
        ? 0.35
        : template.category?.toUpperCase() === 'AUTHENTICATION'
          ? 0.15
          : 0.5;
  const estimatedCost = (estimatedReach * costPerMessage).toFixed(2);

  useEffect(() => {
    async function calculateReach() {
      setLoadingReach(true);
      try {
        const supabase = createClient();

        if (audience.type === 'all') {
          const { count } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true });
          setEstimatedReach(count ?? 0);
        } else if (
          audience.type === 'tags' &&
          audience.tagIds &&
          audience.tagIds.length > 0
        ) {
          const { data: contactTags } = await supabase
            .from('contact_tags')
            .select('contact_id')
            .in('tag_id', audience.tagIds);

          const uniqueIds = new Set(
            (contactTags ?? []).map((ct) => ct.contact_id)
          );
          setEstimatedReach(uniqueIds.size);
        } else if (audience.type === 'csv' && audience.csvContacts) {
          setEstimatedReach(audience.csvContacts.length);
        } else {
          setEstimatedReach(0);
        }
      } finally {
        setLoadingReach(false);
      }
    }

    calculateReach();
  }, [audience]);

  const audienceLabel =
    audience.type === 'all'
      ? t('scheduleSend.audienceAll')
      : audience.type === 'tags'
        ? t('scheduleSend.audienceTags')
        : audience.type === 'csv'
          ? t('scheduleSend.audienceCsv')
          : t('scheduleSend.audienceField');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-foreground text-lg font-semibold">
          {t('scheduleSend.title')}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('scheduleSend.subtitle')}
        </p>
      </div>

      {/* Broadcast Name */}
      <div>
        <label className="text-foreground mb-1.5 block text-sm font-medium">
          {t('scheduleSend.broadcastName')}
        </label>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t('scheduleSend.broadcastNamePlaceholder')}
          className="border-border bg-muted text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Summary Card */}
      <div className="border-border bg-card/50 space-y-3 rounded-xl border p-4">
        <p className="text-foreground text-sm font-medium">
          {t('scheduleSend.summary')}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">
              {t('scheduleSend.template')}
            </p>
            <p className="text-foreground font-medium truncate">{template.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">
              {t('scheduleSend.audience')}
            </p>
            <p className="text-foreground font-medium">{audienceLabel}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">
              {t('scheduleSend.estimatedReach')}
            </p>
            <div className="flex items-center gap-1.5">
              {loadingReach ? (
                <Loader2 className="text-primary h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Users className="text-primary h-3.5 w-3.5" />
                  <p className="text-foreground font-medium">
                    {estimatedReach.toLocaleString()}
                  </p>
                </>
              )}
            </div>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">
              {t('scheduleSend.language')}
            </p>
            <p className="text-foreground font-medium">{template.language ?? 'en_US'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Category</p>
            <p className="text-foreground font-medium">{template.category}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Estimated Cost</p>
            <p className="text-foreground font-medium">
              ₹{estimatedCost}{' '}
              <span className="text-muted-foreground text-[10px] font-normal">
                (~₹{costPerMessage}/msg)
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Delivery Schedule Section (Segmented Radio Cards) */}
      <div className="space-y-3">
        <div>
          <label className="text-foreground block text-sm font-semibold">
            Delivery Schedule
          </label>
          <p className="text-muted-foreground text-xs mt-0.5">
            Select when this broadcast campaign should be dispatched.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Card 1: Send Immediately */}
          <button
            type="button"
            onClick={() => setSendLater(false)}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer ${
              !sendLater
                ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                : 'border-border bg-card/60 hover:bg-card hover:border-border'
            }`}
          >
            <div
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                !sendLater
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-muted-foreground/40 bg-muted/30'
              }`}
            >
              {!sendLater && <Check className="h-3 w-3 stroke-[3]" />}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Zap
                  className={`h-4 w-4 ${
                    !sendLater ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
                <span className="text-foreground text-sm font-semibold">
                  Send Immediately
                </span>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Dispatch messages to recipients right now upon confirmation.
              </p>
            </div>
          </button>

          {/* Card 2: Schedule for Later */}
          <button
            type="button"
            onClick={() => {
              setSendLater(true);
              if (!scheduledTime) {
                const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
                inOneHour.setMinutes(0, 0, 0);
                const localISO = new Date(
                  inOneHour.getTime() - inOneHour.getTimezoneOffset() * 60000
                )
                  .toISOString()
                  .slice(0, 16);
                setScheduledTime(localISO);
              }
            }}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer ${
              sendLater
                ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                : 'border-border bg-card/60 hover:bg-card hover:border-border'
            }`}
          >
            <div
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                sendLater
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-muted-foreground/40 bg-muted/30'
              }`}
            >
              {sendLater && <Check className="h-3 w-3 stroke-[3]" />}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <CalendarClock
                  className={`h-4 w-4 ${
                    sendLater ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
                <span className="text-foreground text-sm font-semibold">
                  Schedule for Later
                </span>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Set a future date and time for automatic background sending.
              </p>
            </div>
          </button>
        </div>

        {/* Date Time Picker Drawer when Schedule for Later is active */}
        {sendLater && (
          <div className="border-border bg-card/60 space-y-2 rounded-xl border p-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="text-primary h-4 w-4" />
              <label className="text-foreground text-sm font-medium">
                Choose Broadcast Date & Time
              </label>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Input
                type="datetime-local"
                value={scheduledTime}
                min={new Date(
                  Date.now() - new Date().getTimezoneOffset() * 60000
                )
                  .toISOString()
                  .slice(0, 16)}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="border-border bg-muted text-foreground max-w-xs font-mono text-xs"
              />
              <span className="text-muted-foreground text-xs">
                Local Timezone (
                {Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'}
                )
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Processing overlay */}
      {isProcessing && (
        <div className="border-primary/20 bg-primary/5 rounded-xl border p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="text-primary h-4 w-4 animate-spin" />
              <p className="text-foreground text-sm font-medium">
                {t('scheduleSend.sending')}
              </p>
            </div>
            <span className="text-primary text-xs font-medium">
              {progress}%
            </span>
          </div>
          <div className="bg-muted h-1.5 w-full rounded-full">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="border-border flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isProcessing}
          className="border-border text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Button>

        <div className="flex items-center gap-2">
          {onSaveDraft && (
            <Button
              variant="outline"
              onClick={onSaveDraft}
              disabled={!name.trim() || isProcessing}
              className="border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {t('scheduleSend.saveDraft')}
            </Button>
          )}

          <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
            <DialogTrigger
              render={
                <Button
                  disabled={
                    !name.trim() ||
                    isProcessing ||
                    (sendLater && !scheduledTime)
                  }
                  className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                />
              }
            >
              {sendLater ? (
                <>
                  <CalendarClock className="h-4 w-4" />
                  Schedule Broadcast
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {t('scheduleSend.sendNow')}
                </>
              )}
            </DialogTrigger>
            <DialogContent className="border-border bg-popover sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-popover-foreground">
                  {sendLater
                    ? 'Schedule Broadcast?'
                    : t('scheduleSend.confirmTitle')}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {sendLater ? (
                    <>
                      This broadcast will be queued to send to{' '}
                      <span className="text-popover-foreground font-medium">
                        {estimatedReach.toLocaleString()}
                      </span>{' '}
                      contacts on{' '}
                      <span className="text-popover-foreground font-medium">
                        {scheduledTime
                          ? new Date(scheduledTime).toLocaleString()
                          : 'the selected time'}
                      </span>
                      .
                    </>
                  ) : (
                    t.rich('scheduleSend.confirmDesc', {
                      count: estimatedReach,
                      template: template.name,
                      b: (chunks) => (
                        <span className="text-popover-foreground font-medium">
                          {chunks}
                        </span>
                      ),
                    })
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowConfirm(false)}
                  className="border-border text-muted-foreground"
                >
                  {t('cancel')}
                </Button>
                <Button
                  onClick={() => {
                    setShowConfirm(false);
                    onSend();
                  }}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {sendLater ? (
                    <>
                      <CalendarClock className="h-4 w-4" />
                      Confirm Schedule
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      {t('scheduleSend.sendNow')}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
