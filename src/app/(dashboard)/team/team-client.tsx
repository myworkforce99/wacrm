'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { loadTeamPerformance } from '@/lib/dashboard/queries';
import type { AgentPerformance } from '@/lib/dashboard/types';
import { SkeletonCard } from '@/components/dashboard/skeleton';
import { AgentCard } from '@/components/team/agent-card';
import { UnassignedPool } from '@/components/team/unassigned-pool';
import { PipelineFunnelChart } from '@/components/team/pipeline-funnel';
import { useCan } from '@/hooks/use-can';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TeamDashboardClient() {
  const [performance, setPerformance] = useState<AgentPerformance[] | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const isAdmin = useCan('edit-settings');
  const searchParams = useSearchParams();
  const isPrint = searchParams.get('print') === 'true';

  useEffect(() => {
    if (isPrint && !loading) {
      document.documentElement.classList.add('print-mode');
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => {
        document.documentElement.classList.remove('print-mode');
        clearTimeout(timer);
      };
    }
  }, [isPrint, loading]);

  const loadAll = useCallback(() => {
    const db = createClient();
    loadTeamPerformance(db, 30)
      .then((data) => setPerformance(data))
      .catch((err) => console.error('[team-dashboard] failed:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-foreground text-2xl font-bold">
            Manager Command Center
          </h1>
          <p className="text-muted-foreground mt-1 text-sm print:hidden">
            Monitor response times, agent capacity, and pipeline funnel across
            your team.
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            className="border-border text-muted-foreground hover:bg-muted print:hidden"
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set('print', 'true');
              window.open(url.toString(), '_blank');
            }}
          >
            <Printer className="mr-2 size-4" />
            Print Report
          </Button>
        )}
      </div>

      {isAdmin && !isPrint && <UnassignedPool />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3 print:grid-cols-2 print:gap-2">
        {loading || !performance
          ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          : performance.map((agent) => (
              <AgentCard key={agent.agentId} agent={agent} onUpdate={loadAll} />
            ))}
      </div>

      {isAdmin && (
        <div className="mt-8">
          <PipelineFunnelChart />
        </div>
      )}

      {isPrint && (
        <style>{`
          @media print {
            @page { size: A4 portrait; margin: 15mm; }
            body { background: white !important; color: black !important; }
            nav, aside, [data-sidebar], .no-print { display: none !important; }
            .print\\:break-inside-avoid { break-inside: avoid; }
          }
        `}</style>
      )}
    </div>
  );
}
