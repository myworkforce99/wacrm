'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { UserPlus, ChevronRight, Inbox, ArrowRight } from 'lucide-react';
import { SourceBadge } from '@/components/ui/source-badge';
import Link from 'next/link';
import { vibrate } from '@/lib/utils/vibrate';
import { formatPhoneDisplay } from '@/lib/whatsapp/phone-utils';
import { useQueryClient } from '@tanstack/react-query';

type UnassignedLead = {
  id: string;
  name: string | null;
  phone: string | null;
  created_at: string;
  lead_details?: { source?: string } | null;
};

export function UnassignedPool() {
  const t = useTranslations('Team.unassignedPool');
  const queryClient = useQueryClient();
  const [leads, setLeads] = useState<UnassignedLead[]>([]);
  const [agents, setAgents] = useState<
    { id: string; name: string; openCount: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const supabase = createClient();

  const fetchPool = useCallback(async () => {
    try {
      const res = await fetch('/api/contacts?unassigned=true');
      if (res.ok) {
        const data = await res.json();
        setLeads(data.contacts || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, is_available')
      .eq('account_role', 'agent');

    if (profiles) {
      const agentIds = profiles.map((p) => p.user_id);
      const { data: convs } = await supabase
        .from('conversations')
        .select('assigned_agent_id')
        .in('assigned_agent_id', agentIds)
        .eq('status', 'open');

      const counts = new Map<string, number>();
      convs?.forEach((c) => {
        if (c.assigned_agent_id) {
          counts.set(
            c.assigned_agent_id,
            (counts.get(c.assigned_agent_id) || 0) + 1
          );
        }
      });

      const enriched = profiles
        .filter((p) => p.is_available)
        .map((p) => ({
          id: p.user_id,
          name: p.full_name || 'Agent',
          openCount: counts.get(p.user_id) || 0,
        }))
        .sort((a, b) => a.openCount - b.openCount);

      setAgents(enriched);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchPool();
      void fetchAgents();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchPool, fetchAgents]);

  // Realtime subscription: auto-refresh pool and agent counts when any conversation is claimed or reassigned
  useEffect(() => {
    const channel = supabase
      .channel('team-unassigned-pool')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => {
          void fetchPool();
          void fetchAgents();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, fetchPool, fetchAgents]);

  const openAssignSheet = (leadId: string) => {
    setSelectedLead(leadId);
    setSheetOpen(true);
  };

  const assignLead = async (agentId: string) => {
    if (!selectedLead) return;
    setAssigning(true);
    vibrate(50);
    try {
      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reassign',
          target_agent_id: agentId,
          contact_ids: [selectedLead],
        }),
      });

      if (!res.ok) throw new Error('Failed to assign');

      toast.success(t('toastSuccess'));
      setSheetOpen(false);
      setSelectedLead(null);
      void fetchPool();
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
    } catch {
      toast.error(t('toastError'));
    } finally {
      setAssigning(false);
    }
  };

  if (loading) return null;
  if (leads.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-amber-200/80 bg-amber-50/60 p-4 shadow-xs dark:border-amber-900/50 dark:bg-amber-950/25">
      <div className="mb-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
            <Inbox className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300">
              {t('title')}
            </h3>
            <p className="text-xs text-amber-700/90 dark:text-amber-400/90">
              {t('badge', { count: leads.length })}
            </p>
          </div>
        </div>

        <Link
          href="/contacts?unassigned=true"
          className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-950 hover:underline dark:text-amber-400 dark:hover:text-amber-300"
        >
          {t('viewAll')}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="flex snap-x snap-mandatory scrollbar-thin gap-3 overflow-x-auto pb-2">
        {leads.slice(0, 10).map((lead) => (
          <div
            key={lead.id}
            className="border-border bg-card flex min-w-[270px] snap-start flex-col justify-between rounded-lg border p-3 shadow-xs transition-shadow hover:shadow-md"
          >
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-foreground truncate text-sm font-semibold">
                  {lead.name || lead.phone || t('sourceUnknown')}
                </p>
                {lead.lead_details?.source && (
                  <SourceBadge source={lead.lead_details.source} />
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                {lead.phone && (
                  <span className="mr-2 font-mono">
                    {formatPhoneDisplay(lead.phone)}
                  </span>
                )}
                <span>{new Date(lead.created_at).toLocaleDateString()}</span>
              </p>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="mt-3 w-full gap-1.5 text-xs font-medium"
              onClick={() => openAssignSheet(lead.id)}
            >
              <UserPlus className="text-primary size-3.5" />
              {t('assignBtn')}
            </Button>
          </div>
        ))}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="sm:side-right h-[80vh] sm:h-auto sm:max-w-md"
        >
          <SheetHeader>
            <SheetTitle>{t('sheetTitle')}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-2 overflow-y-auto pb-8">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => assignLead(agent.id)}
                disabled={assigning}
                className="hover:bg-muted/60 border-border flex items-center justify-between rounded-lg border p-3 text-left transition-colors disabled:opacity-50"
              >
                <div className="flex flex-col">
                  <span className="text-foreground text-sm font-semibold">
                    {agent.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {t('openLeads', { count: agent.openCount })}
                  </span>
                </div>
                <ChevronRight className="text-muted-foreground size-4" />
              </button>
            ))}
            {agents.length === 0 && (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {t('noAgents')}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
