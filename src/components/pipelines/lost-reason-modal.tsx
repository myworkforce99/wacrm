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
import { Loader2 } from 'lucide-react';
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

  const [reasons, setReasons] = useState<LostReason[]>([]);
  const [selectedReasonId, setSelectedReasonId] = useState('');
  const [note, setNote] = useState('');
  const [reEngageOn, setReEngageOn] = useState('');
  const [loadingReasons, setLoadingReasons] = useState(false);

  // Fetch account-specific reasons when modal opens.
  // Reset fields when the modal reopens — prop-driven sync, same
  // pattern as deal-form.tsx.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoadingReasons(true);
      const { data } = await supabase
        .from('lost_reasons')
        .select('*')
        .eq('is_active', true)
        .order('position');
      if (cancelled) return;
      setReasons((data ?? []) as LostReason[]);
      setLoadingReasons(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

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
      <DialogContent className="bg-popover border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            {t('title')}
          </DialogTitle>
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Reason dropdown — required */}
          <div className="grid gap-2">
            <Label className="text-muted-foreground">
              {t('reasonLabel')} <span className="text-destructive">*</span>
            </Label>
            {loadingReasons ? (
              <div className="text-muted-foreground flex h-9 items-center gap-2 text-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('loadingReasons')}
              </div>
            ) : (
              <select
                value={selectedReasonId}
                onChange={(e) => setSelectedReasonId(e.target.value)}
                className="border-border bg-muted text-foreground focus:border-primary focus:ring-primary h-9 w-full rounded-lg border px-2.5 text-sm outline-none focus:ring-1"
              >
                <option value="">{t('selectReason')}</option>
                {reasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Optional note */}
          <div className="grid gap-2">
            <Label className="text-muted-foreground">{t('noteLabel')}</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('notePlaceholder')}
              className="border-border bg-muted text-foreground min-h-[80px]"
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
              className="border-border bg-muted text-foreground"
            />
            <p className="text-muted-foreground text-xs">{t('reEngageHint')}</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
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
            className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t('confirm')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
