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

export function TeamDashboardClient() {
  const [performance, setPerformance] = useState<AgentPerformance[] | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const isAdmin = useCan('edit-settings');

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
      <div>
        <h1 className="text-foreground text-2xl font-bold">Manager Command Center</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Monitor response times, agent capacity, and pipeline funnel across your team.
        </p>
      </div>

      {isAdmin && <UnassignedPool />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {loading || !performance
          ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          : performance.map((agent) => (
              <AgentCard 
                key={agent.agentId} 
                agent={agent} 
                onUpdate={loadAll} 
              />
            ))}
      </div>

      {isAdmin && (
        <div className="mt-8">
          <PipelineFunnelChart />
        </div>
      )}
    </div>
  );
}
