'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { UserPlus, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

type UnassignedLead = {
  id: string;
  name: string | null;
  phone: string | null;
  created_at: string;
  lead_details?: { source?: string }[];
};

export function UnassignedPool() {
  const [leads, setLeads] = useState<UnassignedLead[]>([]);
  const [agents, setAgents] = useState<
    { id: string; name: string; openCount: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const supabase = createClient();

  const fetchPool = async () => {
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
  };

  const fetchAgents = async () => {
    // Fetch agents and their open lead counts
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
  };

  useEffect(() => {
    fetchPool();
    fetchAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAssignSheet = (leadId: string) => {
    setSelectedLead(leadId);
    setSheetOpen(true);
  };

  const assignLead = async (agentId: string) => {
    if (!selectedLead) return;
    setAssigning(true);
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

      toast.success('Lead assigned successfully');
      setSheetOpen(false);
      setSelectedLead(null);
      fetchPool(); // refresh pool
    } catch {
      toast.error('Failed to assign lead');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) return null; // Or a skeleton
  if (leads.length === 0) return null; // Don't show if empty

  return (
    <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-900/10">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-500">
          <span className="flex size-6 items-center justify-center rounded-full bg-amber-100 text-xs dark:bg-amber-900/50">
            {leads.length}
          </span>
          unassigned leads
        </h3>
        <Link
          href="/contacts?unassigned=true"
          className="text-sm font-medium text-amber-700 hover:underline dark:text-amber-400"
        >
          View All &rarr;
        </Link>
      </div>

      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
        {leads.slice(0, 10).map((lead) => (
          <div
            key={lead.id}
            className="bg-card flex min-w-[280px] snap-start flex-col gap-3 rounded-md border p-3 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-foreground font-medium">
                  {lead.name || lead.phone}
                </p>
                <p className="text-muted-foreground text-xs">
                  {new Date(lead.created_at).toLocaleDateString()}
                </p>
              </div>
              {(() => {
                const source = lead.lead_details?.[0]?.source;
                return source ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {source}
                  </Badge>
                ) : null;
              })()}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-2"
              onClick={() => openAssignSheet(lead.id)}
            >
              <UserPlus className="size-4" />
              Assign
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
            <SheetTitle>Assign Lead</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-2 overflow-y-auto pb-8">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => assignLead(agent.id)}
                disabled={assigning}
                className="hover:bg-muted/50 flex items-center justify-between rounded-md border p-3 text-left transition-colors disabled:opacity-50"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{agent.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {agent.openCount} open leads
                  </span>
                </div>
                <ChevronRight className="text-muted-foreground size-4" />
              </button>
            ))}
            {agents.length === 0 && (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No available agents.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
