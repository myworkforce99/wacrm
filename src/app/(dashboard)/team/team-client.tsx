'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { loadTeamPerformance } from '@/lib/dashboard/queries';
import type { AgentPerformance } from '@/lib/dashboard/types';
import { SkeletonCard } from '@/components/dashboard/skeleton';
import { AgentCard } from '@/components/team/agent-card';
import { AgentTable } from '@/components/team/agent-table';
import { AgentTargetModal } from '@/components/team/agent-target-modal';
import { UnassignedPool } from '@/components/team/unassigned-pool';
import { PipelineFunnelChart } from '@/components/team/pipeline-funnel';
import { useCan } from '@/hooks/use-can';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/page-header';
import { PullToRefresh } from '@/components/layout/pull-to-refresh';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Printer,
  Search,
  Users,
  Clock,
  CalendarCheck,
  TrendingUp,
  LayoutGrid,
  TableProperties,
  AlertTriangle,
  X,
} from 'lucide-react';

export function TeamDashboardClient() {
  const t = useTranslations('Team.dashboard');
  const tKpis = useTranslations('Team.kpis');
  const tFilters = useTranslations('Team.filters');

  const [performance, setPerformance] = useState<AgentPerformance[] | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  // Filters & Search state
  const [search, setSearch] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [workloadFilter, setWorkloadFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  // Modal state
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [selectedAgentForTarget, setSelectedAgentForTarget] =
    useState<AgentPerformance | null>(null);

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
    return loadTeamPerformance(db, 30)
      .then((data) => setPerformance(data))
      .catch((err) => console.error('[team-dashboard] failed:', err))
      .finally(() => setLoading(false));
  }, []);

  // React 19 safe deferred fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAll();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadAll]);

  const handleEditTarget = (agent: AgentPerformance) => {
    setSelectedAgentForTarget(agent);
    setTargetModalOpen(true);
  };

  // KPI Calculations
  const kpis = useMemo(() => {
    if (!performance) {
      return {
        totalAgents: 0,
        availableAgents: 0,
        onLeaveAgents: 0,
        totalOpenLeads: 0,
        avgCapacityPct: 0,
        totalVisitsActual: 0,
        totalVisitsTarget: 0,
        visitsTargetAttainedPct: 0,
        avgResponseMinutes: null as number | null,
        totalStaleLeads: 0,
      };
    }

    const totalAgents = performance.length;
    const availableAgents = performance.filter((a) => a.isAvailable).length;
    const onLeaveAgents = totalAgents - availableAgents;

    const totalOpenLeads = performance.reduce(
      (sum, a) => sum + (a.openLeadsCount || 0),
      0
    );

    // 20 nominal leads per agent benchmark
    const maxNominalCapacity = totalAgents * 20;
    const avgCapacityPct =
      maxNominalCapacity > 0
        ? Math.min(100, Math.round((totalOpenLeads / maxNominalCapacity) * 100))
        : 0;

    const totalVisitsActual = performance.reduce(
      (sum, a) => sum + (a.actualVisitsThisMonth || 0),
      0
    );
    const totalVisitsTarget = performance.reduce(
      (sum, a) => sum + (a.targetVisits || 0),
      0
    );
    const visitsTargetAttainedPct =
      totalVisitsTarget > 0
        ? Math.min(
            100,
            Math.round((totalVisitsActual / totalVisitsTarget) * 100)
          )
        : 0;

    const responseTimes = performance
      .map((a) => a.avgResponseTimeMin)
      .filter((r): r is number => r !== null && !isNaN(r));

    const avgResponseMinutes =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : null;

    const totalStaleLeads = performance.reduce(
      (sum, a) => sum + (a.staleLeadCount || 0),
      0
    );

    return {
      totalAgents,
      availableAgents,
      onLeaveAgents,
      totalOpenLeads,
      avgCapacityPct,
      totalVisitsActual,
      totalVisitsTarget,
      visitsTargetAttainedPct,
      avgResponseMinutes,
      totalStaleLeads,
    };
  }, [performance]);

  // Multi-dimensional filtered agents
  const filteredAgents = useMemo(() => {
    if (!performance) return [];

    return performance.filter((agent) => {
      // 1. Omni-search filter
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = agent.name.toLowerCase().includes(query);
        const matchesRole = agent.role.toLowerCase().includes(query);
        if (!matchesName && !matchesRole) return false;
      }

      // 2. Availability filter
      if (availabilityFilter === 'available' && !agent.isAvailable)
        return false;
      if (availabilityFilter === 'on_leave' && agent.isAvailable) return false;

      // 3. Role filter
      if (roleFilter !== 'all') {
        if (agent.role.toLowerCase() !== roleFilter.toLowerCase()) return false;
      }

      // 4. Workload & Status filter
      if (workloadFilter === 'overloaded') {
        // >= 16 leads (80% capacity)
        if (agent.openLeadsCount < 16) return false;
      } else if (workloadFilter === 'stale') {
        if (agent.staleLeadCount <= 0) return false;
      } else if (workloadFilter === 'target_met') {
        if (
          agent.targetVisits === null ||
          agent.actualVisitsThisMonth < agent.targetVisits
        ) {
          return false;
        }
      }

      return true;
    });
  }, [performance, search, availabilityFilter, roleFilter, workloadFilter]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    availabilityFilter !== 'all' ||
    roleFilter !== 'all' ||
    workloadFilter !== 'all';

  const activeFiltersCount =
    (search.trim().length > 0 ? 1 : 0) +
    (availabilityFilter !== 'all' ? 1 : 0) +
    (roleFilter !== 'all' ? 1 : 0) +
    (workloadFilter !== 'all' ? 1 : 0);

  const clearAllFilters = () => {
    setSearch('');
    setAvailabilityFilter('all');
    setRoleFilter('all');
    setWorkloadFilter('all');
  };

  return (
    <PullToRefresh onRefresh={loadAll}>
      <div className="space-y-6 pb-8">
        {/* Page Header */}
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle')}
          action={
            isAdmin && (
              <Button
                variant="outline"
                className="border-border text-muted-foreground hover:bg-muted hidden rounded-full shadow-xs sm:flex print:hidden"
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('print', 'true');
                  window.open(url.toString(), '_blank');
                }}
              >
                <Printer className="text-primary mr-2 size-4" />
                {t('printReport')}
              </Button>
            )
          }
        />

        {/* Situational Awareness KPI Strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Card 1: Team Strength */}
          <div className="border-border bg-card relative overflow-hidden rounded-xl border p-4 shadow-xs transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                {tKpis('teamStrength')}
              </span>
              <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
                <Users className="size-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-foreground text-2xl font-bold tracking-tight">
                {kpis.availableAgents}
              </span>
              <span className="text-muted-foreground text-sm font-medium">
                / {kpis.totalAgents}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span>
                {tKpis('activeCount', { active: kpis.availableAgents })}
              </span>
              {kpis.onLeaveAgents > 0 && (
                <>
                  <span>•</span>
                  <span>
                    {tKpis('onLeaveCount', { onLeave: kpis.onLeaveAgents })}
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Card 2: Active Workload */}
          <div className="border-border bg-card relative overflow-hidden rounded-xl border p-4 shadow-xs transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                {tKpis('openLeads')}
              </span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="size-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-foreground text-2xl font-bold tracking-tight">
                {kpis.totalOpenLeads}
              </span>
              <span className="text-muted-foreground text-xs font-medium">
                ({tKpis('avgCapacity', { capacity: kpis.avgCapacityPct })})
              </span>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {tKpis('totalLeadsCount', { count: kpis.totalOpenLeads })}
            </p>
          </div>

          {/* Card 3: Monthly Site Visits */}
          <div className="border-border bg-card relative overflow-hidden rounded-xl border p-4 shadow-xs transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                {tKpis('monthlyVisits')}
              </span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <CalendarCheck className="size-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-foreground text-2xl font-bold tracking-tight">
                {kpis.totalVisitsActual}
              </span>
              {kpis.totalVisitsTarget > 0 && (
                <span className="text-muted-foreground text-sm font-medium">
                  / {kpis.totalVisitsTarget}
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {kpis.totalVisitsTarget > 0
                ? tKpis('targetProgress', {
                    actual: kpis.totalVisitsActual,
                    target: kpis.totalVisitsTarget,
                    percent: kpis.visitsTargetAttainedPct,
                  })
                : tKpis('noTarget', { actual: kpis.totalVisitsActual })}
            </p>
          </div>

          {/* Card 4: Team SLA / Stale Attention */}
          <div className="border-border bg-card relative overflow-hidden rounded-xl border p-4 shadow-xs transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                {tKpis('teamSla')}
              </span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Clock className="size-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-foreground text-2xl font-bold tracking-tight">
                {kpis.avgResponseMinutes !== null
                  ? `${Math.round(kpis.avgResponseMinutes)}m`
                  : tKpis('slaNotAvailable')}
              </span>
              {kpis.totalStaleLeads > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                  <AlertTriangle className="size-3" />
                  {kpis.totalStaleLeads}
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {kpis.totalStaleLeads > 0
                ? tKpis('staleAttention', { count: kpis.totalStaleLeads })
                : kpis.avgResponseMinutes !== null
                  ? tKpis('slaMinutes', {
                      minutes: Math.round(kpis.avgResponseMinutes),
                    })
                  : tKpis('slaNotAvailable')}
            </p>
          </div>
        </div>

        {/* Unassigned Leads Pool */}
        {isAdmin && !isPrint && <UnassignedPool />}

        {/* Multi-Dimensional Real Estate Filters Toolbar */}
        {!isPrint && (
          <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            {/* Filter Dropdowns Group (Left-aligned, stable positions) */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Search Input */}
              <div className="relative w-full sm:w-64">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  placeholder={tFilters('searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-9 text-xs"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Availability Filter */}
              <Select
                value={availabilityFilter}
                onValueChange={(val) => setAvailabilityFilter(val ?? 'all')}
              >
                <SelectTrigger
                  label={tFilters('availability')}
                  className="h-9 min-w-[155px] text-xs"
                >
                  <SelectValue placeholder={tFilters('availabilityAll')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectLabel>{tFilters('availability')}</SelectLabel>
                  <SelectSeparator />
                  <SelectItem value="all">
                    {tFilters('availabilityAll')}
                  </SelectItem>
                  <SelectItem value="available">
                    {tFilters('available')}
                  </SelectItem>
                  <SelectItem value="on_leave">
                    {tFilters('onLeave')}
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Role Filter */}
              <Select
                value={roleFilter}
                onValueChange={(val) => setRoleFilter(val ?? 'all')}
              >
                <SelectTrigger
                  label={tFilters('role')}
                  className="h-9 min-w-[140px] text-xs"
                >
                  <SelectValue placeholder={tFilters('roleAll')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectLabel>{tFilters('role')}</SelectLabel>
                  <SelectSeparator />
                  <SelectItem value="all">{tFilters('roleAll')}</SelectItem>
                  <SelectItem value="agent">{tFilters('roleAgent')}</SelectItem>
                  <SelectItem value="admin">{tFilters('roleAdmin')}</SelectItem>
                  <SelectItem value="owner">{tFilters('roleOwner')}</SelectItem>
                </SelectContent>
              </Select>

              {/* Workload / Status Filter */}
              <Select
                value={workloadFilter}
                onValueChange={(val) => setWorkloadFilter(val ?? 'all')}
              >
                <SelectTrigger
                  label={tFilters('workload')}
                  className="h-9 min-w-[175px] text-xs"
                >
                  <SelectValue placeholder={tFilters('workloadAll')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectLabel>{tFilters('workload')}</SelectLabel>
                  <SelectSeparator />
                  <SelectItem value="all">{tFilters('workloadAll')}</SelectItem>
                  <SelectItem value="overloaded">
                    {tFilters('workloadOverloaded')}
                  </SelectItem>
                  <SelectItem value="stale">
                    {tFilters('workloadStale')}
                  </SelectItem>
                  <SelectItem value="target_met">
                    {tFilters('workloadTargetMet')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions: Clear Filters & View Mode (Anchored right, zero layout shift on dropdowns) */}
            <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="bg-red-50 text-red-600 border border-red-200/60 hover:bg-red-100 hover:text-red-700 hover:border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40 dark:hover:bg-red-900/50 dark:hover:text-red-300 dark:hover:border-red-800 h-9 gap-1 px-2.5 text-xs font-medium transition-colors shadow-2xs"
                >
                  <X className="size-3.5" />
                  {tFilters('clearFilters')} ({activeFiltersCount})
                </Button>
              )}

              {/* View Mode Toggle (Table vs Grid) */}
              <div className="border-border bg-muted/40 hidden items-center rounded-lg border p-0.5 sm:flex">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-semibold transition-all ${
                    viewMode === 'table'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title={tFilters('viewTable')}
                >
                  <TableProperties className="size-3.5" />
                  <span>{tFilters('viewTable')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-semibold transition-all ${
                    viewMode === 'grid'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title={tFilters('viewGrid')}
                >
                  <LayoutGrid className="size-3.5" />
                  <span>{tFilters('viewGrid')}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Display: Grid vs High-Density Table */}
        {loading || !performance ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3 print:grid-cols-2 print:gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="border-border flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
            <div className="bg-muted flex size-12 items-center justify-center rounded-full">
              <Users className="text-muted-foreground size-6" />
            </div>
            <h3 className="text-foreground mt-3 text-base font-semibold">
              {t('emptySearchTitle')}
            </h3>
            <p className="text-muted-foreground mt-1 max-w-sm text-xs">
              {t('emptySearchDesc')}
            </p>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="bg-red-50 text-red-600 border border-red-200/60 hover:bg-red-100 hover:text-red-700 hover:border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40 dark:hover:bg-red-900/50 dark:hover:text-red-300 dark:hover:border-red-800 mt-4 gap-1 text-xs font-medium transition-colors shadow-2xs"
              >
                <X className="size-3.5" />
                {tFilters('clearFilters')} ({activeFiltersCount})
              </Button>
            )}
          </div>
        ) : viewMode === 'table' && !isPrint ? (
          <AgentTable
            agents={filteredAgents}
            onUpdate={loadAll}
            onEditTarget={handleEditTarget}
            isAdmin={isAdmin}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3 print:grid-cols-2 print:gap-2">
            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent.agentId}
                agent={agent}
                onUpdate={loadAll}
                onEditTarget={handleEditTarget}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}

        {/* Pipeline Funnel Section */}
        {isAdmin && (
          <div className="mt-8">
            <PipelineFunnelChart />
          </div>
        )}

        {/* Set Target Modal */}
        <AgentTargetModal
          open={targetModalOpen}
          onOpenChange={setTargetModalOpen}
          agent={selectedAgentForTarget}
          onSaved={loadAll}
        />

        {/* Print Stylesheet */}
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
    </PullToRefresh>
  );
}
