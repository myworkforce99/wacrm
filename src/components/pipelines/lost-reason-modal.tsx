'use client';

/**
 * LostReasonModal
 *
 * Intercepts "Mark as Lost" and forces the agent to select a reason
 * before the deal is closed.  Having a reason is the single most
 * valuable data point for funnel analytics and conversion improvement.
 *
 * Design decisions:
 *  - Reason dropdown is required; Save button stays disabled until chosen.
 *  - Note field is optional.
 *  - Re-engage date is optional — sets deals.re_engage_on so a future
 *    automation cron can send a WhatsApp nudge.
 *  - Reasons are fetched once per open and cached locally; the list is
 *    small (≤20 rows) so no pagination needed.
 */

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type { LostReason } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, Circle } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface LostReasonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the selected reason + optional metadata when agent confirms. */
  onConfirm: (payload: {
    lost_reason_id: string;
    lost_note?: string;
    re_engage_on?: string;
  }) => void;
  loading?: boolean;
}

export function LostReasonModal({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: LostReasonModalProps) {
  const t = useTranslations('Pipelines.lostModal');
  const supabase = createClient();
  const { accountId } = useAuth();

  const [reasons, setReasons] = useState<LostReason[]>([]);
  const [selectedReasonId, setSelectedReasonId] = useState('');
  const [note, setNote] = useState('');
  const [reEngageOn, setReEngageOn] = useState('');
  const [loadingReasons, setLoadingReasons] = useState(false);

  // Fetch account-specific reasons when modal opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoadingReasons(true);
      let query = supabase
        .from('lost_reasons')
        .select('*')
        .eq('is_active', true);

      if (accountId) {
        query = query.eq('account_id', accountId);
      }

      const { data } = await query.order('position');
      if (cancelled) return;
      setReasons((data ?? []) as LostReason[]);
      setLoadingReasons(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, supabase, accountId]);

  function handleConfirm() {
    if (!selectedReasonId) return;
    onConfirm({
      lost_reason_id: selectedReasonId,
      lost_note: note.trim() || undefined,
      re_engage_on: reEngageOn || undefined,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val);
        if (!val) {
          setSelectedReasonId('');
          setNote('');
          setReEngageOn('');
        }
      }}
    >
      <DialogContent className="bg-popover border-border flex max-h-[90vh] flex-col p-0 sm:max-w-md">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-popover-foreground">
            {t('title')}
          </DialogTitle>
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-2">
          {/* Reason options — required with touch-friendly targets */}
          <div className="grid gap-2">
            <Label className="text-muted-foreground">
              {t('reasonLabel')} <span className="text-destructive">*</span>
            </Label>
            {loadingReasons ? (
              <div className="text-muted-foreground flex h-12 items-center justify-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                {t('loadingReasons')}
              </div>
            ) : (
              <div className="grid max-h-52 gap-1.5 overflow-y-auto pr-1">
                {reasons.map((r) => {
                  const isSelected = selectedReasonId === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedReasonId(r.id)}
                      className={`flex min-h-[40px] w-full cursor-pointer items-center justify-between rounded-lg border p-2.5 text-left text-xs transition-colors ${
                        isSelected
                          ? 'border-primary/50 bg-primary/10 text-primary font-semibold shadow-2xs'
                          : 'border-border/70 bg-card hover:bg-muted text-foreground'
                      }`}
                    >
                      <span className="truncate">{r.label}</span>
                      {isSelected ? (
                        <CheckCircle2 className="text-primary ml-2 size-4 shrink-0" />
                      ) : (
                        <Circle className="text-muted-foreground/40 ml-2 size-4 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Optional note */}
          <div className="grid gap-2">
            <Label className="text-muted-foreground">{t('noteLabel')}</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('notePlaceholder')}
              className="border-border bg-muted text-foreground min-h-[72px] text-xs"
            />
          </div>

          {/* Optional re-engagement date */}
          <div className="grid gap-2">
            <Label className="text-muted-foreground">
              {t('reEngageLabel')}
            </Label>
            <Input
              type="date"
              value={reEngageOn}
              onChange={(e) => setReEngageOn(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="border-border bg-muted text-foreground h-9 text-xs"
            />
            <p className="text-muted-foreground text-[11px]">
              {t('reEngageHint')}
            </p>
          </div>
        </div>

        <DialogFooter className="border-border/50 gap-2 border-t p-6 pt-3 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            {t('cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedReasonId || loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t('confirm')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
