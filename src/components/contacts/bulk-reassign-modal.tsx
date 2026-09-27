'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useTranslations } from 'next-intl';

export function BulkReassignModal({
  open,
  onOpenChange,
  selectedIds,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onSuccess: () => void;
}) {
  const t = useTranslations('Contacts.bulkReassign');
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (open) {
      supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('account_role', 'agent') // Maybe we should allow admins too? Just 'agent' and 'admin'
        .in('account_role', ['admin', 'agent'])
        .then(({ data }) => {
          if (data) {
            setAgents(data.map((p) => ({ id: p.user_id, name: p.full_name })));
          }
        });
    }
  }, [open, supabase]);

  async function handleSave() {
    if (!selectedAgent) return;
    setLoading(true);
    try {
      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reassign',
          target_agent_id: selectedAgent,
          contact_ids: selectedIds,
        }),
      });
      if (!res.ok) throw new Error('Failed to reassign');
      toast.success(t('success', { count: selectedIds.length }));
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description', { count: selectedIds.length })}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <label className="mb-1 block text-sm font-medium">
            {t('selectAgent')}
          </label>
          <select
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
          >
            <option value="">{t('placeholder')}</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!selectedAgent || loading}>
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
