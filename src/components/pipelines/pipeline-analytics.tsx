'use client';

/**
 * PipelineAnalytics
 *
 * Situational awareness KPI stat cards at the top of the Pipelines page.
 * Displays real estate sales funnel velocity:
 *  - Active Deals & Pipeline Value in ₹ INR
 *  - Average Deal Size & Stage-Weighted Value Forecast
 *  - Monthly Won Closures and Win Conversion Rate %
 * Supports 1-click filter switching by clicking on the metric cards.
 */

import React, { useMemo } from 'react';
import type { Deal, PipelineStage } from '@/types';
import {
  IndianRupee,
  TrendingUp,
  Target,
  BarChart3,
  Trophy,
  Percent,
  Info,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/use-auth';
import { formatCurrency, formatINR } from '@/lib/currency';
import { useTranslations } from 'next-intl';

interface PipelineAnalyticsProps {
  stages: PipelineStage[];
  deals: Deal[];
  activeFilter?: 'open' | 'won' | 'lost' | 'all';
  onFilterChange?: (filter: 'open' | 'won' | 'lost' | 'all') => void;
}

/**
 * Weighted pipeline value: value × per-stage probability.
 * First stage ≈ 10%, stages interpolate up to 90% before the final stage,
 * final stage (Won) = 100%. Lost deals excluded.
 */
function computeStageProbability(
  stage: PipelineStage,
  sortedStages: PipelineStage[]
): number {
  const n = sortedStages.length;
  if (n <= 1) return 1;
  const index = sortedStages.findIndex((s) => s.id === stage.id);
  if (index < 0) return 0;
  if (index === n - 1) return 1;
  const slots = n - 1;
  if (slots <= 1) return 0.1;
  const t = index / (slots - 1);
  return 0.1 + t * (0.9 - 0.1);
}

export function PipelineAnalytics({
  stages,
  deals,
  activeFilter,
  onFilterChange,
}: PipelineAnalyticsProps) {
  const t = useTranslations('Pipelines.analytics');
  const { defaultCurrency } = useAuth();
  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages]
  );

  const stats = useMemo(() => {
    const active = deals.filter((d) => d.status !== 'lost');
    const openDeals = active.filter((d) => d.status !== 'won');
    const wonDeals = deals.filter((d) => d.status === 'won');
    const lostDeals = deals.filter((d) => d.status === 'lost');

    const totalCount = active.length;
    const totalValue = active.reduce((sum, d) => sum + Number(d.value || 0), 0);
    const avgValue = totalCount > 0 ? totalValue / totalCount : 0;

    const stageById = new Map(sortedStages.map((s) => [s.id, s]));
    const weightedValue = openDeals.reduce((sum, d) => {
      const stage = stageById.get(d.stage_id);
      if (!stage) return sum;
      const prob = computeStageProbability(stage, sortedStages);
      return sum + Number(d.value || 0) * prob;
    }, 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const closedThisMonth = (d: Deal) => {
      const ts = d.closed_at ?? d.updated_at ?? d.created_at;
      return ts ? new Date(ts) >= monthStart : false;
    };

    const wonThisMonth = wonDeals.filter(closedThisMonth).length;
    const totalClosed = wonDeals.length + lostDeals.length;
    const winRate =
      totalClosed > 0 ? Math.round((wonDeals.length / totalClosed) * 100) : 0;

    return {
      totalCount,
      openCount: openDeals.length,
      totalValue,
      avgValue,
      weightedValue,
      wonThisMonth,
      wonTotal: wonDeals.length,
      lostTotal: lostDeals.length,
      winRate,
    };
  }, [deals, sortedStages]);

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {/* Total / Active Deals */}
        <MetricCard
          icon={<BarChart3 className="text-muted-foreground size-4" />}
          label={t('totalDeals')}
          value={String(stats.totalCount)}
          subtext={`${stats.openCount} open`}
          tooltip={t('totalDealsTooltip')}
          t={t}
          isActive={activeFilter === 'open'}
          onClick={() => onFilterChange?.('open')}
          accent="hover:border-primary/50"
        />

        {/* Pipeline Value */}
        <MetricCard
          icon={<IndianRupee className="text-primary size-4" />}
          label={t('pipelineValue')}
          value={
            defaultCurrency === 'INR'
              ? formatINR(stats.totalValue)
              : formatCurrency(stats.totalValue, defaultCurrency)
          }
          tooltip={t('pipelineValueTooltip')}
          t={t}
          isActive={activeFilter === 'open'}
          onClick={() => onFilterChange?.('open')}
          accent="hover:border-primary/50"
        />

        {/* Average Deal Size */}
        <MetricCard
          icon={<Target className="size-4 text-blue-500" />}
          label={t('avgDealSize')}
          value={
            defaultCurrency === 'INR'
              ? formatINR(stats.avgValue)
              : formatCurrency(stats.avgValue, defaultCurrency)
          }
          tooltip={t('avgDealSizeTooltip')}
          t={t}
          accent="hover:border-blue-500/50"
        />

        {/* Weighted Pipeline Value */}
        <MetricCard
          icon={<TrendingUp className="size-4 text-purple-500" />}
          label={t('weightedValue')}
          value={
            defaultCurrency === 'INR'
              ? formatINR(stats.weightedValue)
              : formatCurrency(stats.weightedValue, defaultCurrency)
          }
          tooltip={t('weightedValueTooltip')}
          t={t}
          accent="hover:border-purple-500/50"
        />

        {/* Won Closures */}
        <MetricCard
          icon={<Trophy className="size-4 text-emerald-500" />}
          label={t('wonThisMonth')}
          value={String(stats.wonThisMonth)}
          subtext={`${stats.wonTotal} all-time`}
          tooltip={t('wonThisMonthTooltip')}
          t={t}
          isActive={activeFilter === 'won'}
          onClick={() => onFilterChange?.('won')}
          accent="hover:border-emerald-500/50"
        />

        {/* Win Rate % */}
        <MetricCard
          icon={<Percent className="size-4 text-amber-500" />}
          label={t('winRate')}
          value={`${stats.winRate}%`}
          subtext={`${stats.wonTotal}W / ${stats.lostTotal}L`}
          tooltip={t('winRateTooltip')}
          t={t}
          isActive={activeFilter === 'lost'}
          onClick={() => onFilterChange?.('lost')}
          accent="hover:border-amber-500/50"
        />
      </div>
    </TooltipProvider>
  );
}

function MetricCard({
  icon,
  label,
  value,
  subtext,
  tooltip,
  t,
  isActive,
  onClick,
  accent = '',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  tooltip: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
  isActive?: boolean;
  onClick?: () => void;
  accent?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={`border-border/80 bg-card/80 flex flex-col justify-between rounded-xl border p-3.5 shadow-xs transition-all ${
        onClick ? 'cursor-pointer ' + accent : ''
      } ${isActive ? 'ring-primary/40 border-primary ring-2' : ''}`}
    >
      <div className="text-muted-foreground flex items-center justify-between gap-1 text-[11px] font-medium tracking-wide uppercase">
        <div className="flex items-center gap-1.5 truncate">
          {icon}
          <span className="truncate">{label}</span>
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                aria-label={t('howCalculated', { label })}
                className="text-muted-foreground hover:text-foreground shrink-0 focus:outline-none"
              />
            }
          >
            <Info className="size-3" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-left">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-1">
        <p className="text-foreground text-xl font-bold tracking-tight">
          {value}
        </p>
        {subtext && (
          <span className="text-muted-foreground truncate text-[10px] font-medium">
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
}
