'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Loader2, Target, Calendar } from 'lucide-react';
import type { AgentPerformance } from '@/lib/dashboard/types';

interface AgentTargetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: AgentPerformance | null;
  onSaved: () => void;
}

export function AgentTargetModal({
  open,
  onOpenChange,
  agent,
  onSaved,
}: AgentTargetModalProps) {
  const t = useTranslations('Team.targetModal');
  const [visits, setVisits] = useState<number>(0);
  const [bookings, setBookings] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (agent) {
      setVisits(agent.targetVisits ?? 0);
      setBookings(agent.targetBookings ?? 0);
    }
  }, [agent]);

  if (!agent) return null;

  const currentMonthName = new Date().toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .split('T')[0];

      const res = await fetch('/api/account/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agent.agentId,
          period_start: firstDayOfMonth,
          target_visits: Math.max(0, visits || 0),
          target_bookings: Math.max(0, bookings || 0),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save targets');
      }

      toast.success(t('toastSuccess', { name: agent.name }));
      onOpenChange(false);
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error(t('toastFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] p-4 sm:max-w-md sm:p-6">
        <form onSubmit={handleSave}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                <Target className="size-5" />
              </div>
              <div>
                <DialogTitle>{t('title')}</DialogTitle>
                <DialogDescription>
                  {t('description', { name: agent.name })}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="border-border bg-muted/40 text-muted-foreground flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-2 font-medium">
                <Calendar className="text-primary size-4" />
                <span>{t('periodLabel')}</span>
              </div>
              <span className="text-foreground font-semibold">
                {currentMonthName}
              </span>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="target-visits-input"
                className="text-foreground text-xs font-semibold"
              >
                {t('visitsLabel')}
              </label>
              <Input
                id="target-visits-input"
                type="number"
                min="0"
                step="1"
                placeholder={t('visitsPlaceholder')}
                value={visits === 0 ? '' : visits}
                onChange={(e) => setVisits(parseInt(e.target.value, 10) || 0)}
                className="h-10"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="target-bookings-input"
                className="text-foreground text-xs font-semibold"
              >
                {t('bookingsLabel')}
              </label>
              <Input
                id="target-bookings-input"
                type="number"
                min="0"
                step="1"
                placeholder={t('bookingsPlaceholder')}
                value={bookings === 0 ? '' : bookings}
                onChange={(e) => setBookings(parseInt(e.target.value, 10) || 0)}
                className="h-10"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {saving ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
