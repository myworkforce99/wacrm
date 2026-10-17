'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { ExternalLink, Target, Clock, AlertTriangle } from 'lucide-react';
import type { AgentPerformance } from '@/lib/dashboard/types';
import { vibrate } from '@/lib/utils/vibrate';

export function AgentCard({
  agent,
  onUpdate,
  onEditTarget,
  isAdmin,
}: {
  agent: AgentPerformance;
  onUpdate: () => void;
  onEditTarget?: (agent: AgentPerformance) => void;
  isAdmin?: boolean;
}) {
  const t = useTranslations('Team.agentCard');

  const toggleAvailability = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    vibrate(50);
    try {
      const res = await fetch(`/api/account/members/${agent.agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: !agent.isAvailable }),
      });
      if (res.ok) {
        toast.success(t('toastAvailabilityUpdated', { name: agent.name }));
        onUpdate();
      } else {
        toast.error(t('toastAvailabilityFailed'));
      }
    } catch {
      toast.error(t('toastAvailabilityFailed'));
    }
  };

  // 20 leads = 100% nominal capacity
  const maxNominalLeads = 20;
  const leadsPct = Math.min(
    100,
    Math.round((agent.openLeadsCount / maxNominalLeads) * 100)
  );

  let leadsColorClass = 'bg-emerald-500';
  if (agent.openLeadsCount >= 10 && agent.openLeadsCount <= 18) {
    leadsColorClass = 'bg-amber-500';
  } else if (agent.openLeadsCount > 18) {
    leadsColorClass = 'bg-rose-500';
  }

  const targetVisits = agent.targetVisits ?? 0;
  const targetPct =
    targetVisits > 0
      ? Math.min(
          100,
          Math.round((agent.actualVisitsThisMonth / targetVisits) * 100)
        )
      : 0;

  const responseMin = agent.avgResponseTimeMin;
  let responseColor = 'text-emerald-600 dark:text-emerald-400';
  let responseBg = 'bg-emerald-500/10 dark:bg-emerald-500/20';
  if (responseMin !== null && responseMin >= 30) {
    responseColor = 'text-rose-600 dark:text-rose-400';
    responseBg = 'bg-rose-500/10 dark:bg-rose-500/20';
  } else if (responseMin !== null && responseMin >= 15) {
    responseColor = 'text-amber-600 dark:text-amber-400';
    responseBg = 'bg-amber-500/10 dark:bg-amber-500/20';
  }

  return (
    <Card className="border-border bg-card flex flex-col overflow-hidden shadow-xs transition-shadow hover:shadow-md print:break-inside-avoid">
      <CardHeader className="border-border/50 bg-muted/20 flex flex-row items-center gap-3 border-b pb-3">
        <Avatar className="ring-border size-11 ring-1">
          <AvatarImage src={agent.avatarUrl ?? undefined} />
          <AvatarFallback className="text-sm font-semibold">
            {agent.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/contacts?assigned_to=${agent.agentId}`}
              className="text-foreground hover:text-primary truncate text-base font-bold hover:underline"
              title={agent.name}
            >
              {agent.name}
            </Link>
            {isAdmin ? (
              <button
                type="button"
                onClick={toggleAvailability}
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center -my-2.5 -mr-2 transition-transform active:scale-95"
                title={agent.isAvailable ? t('available') : t('onLeave')}
                aria-label={agent.isAvailable ? t('available') : t('onLeave')}
              >
                <span
                  className={`flex h-3 w-3 rounded-full transition-colors ${
                    agent.isAvailable
                      ? 'bg-emerald-500 ring-4 ring-emerald-500/20'
                      : 'bg-muted-foreground/40 ring-muted-foreground/10 ring-4'
                  }`}
                />
              </button>
            ) : (
              <span
                className={`flex h-2.5 w-2.5 shrink-0 rounded-full ${
                  agent.isAvailable
                    ? 'bg-emerald-500'
                    : 'bg-muted-foreground/40'
                }`}
              />
            )}
          </div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {agent.role} {!agent.isAvailable && `• ${t('onLeave')}`}
          </p>
        </div>

        {agent.staleLeadCount > 0 && (
          <Badge
            variant="outline"
            className="shrink-0 border-amber-300 bg-amber-50 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
          >
            <AlertTriangle className="mr-1 size-3" />
            {t('staleBadge', { count: agent.staleLeadCount })}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between pt-4">
        <div className="space-y-4">
          {/* Workload / Capacity Bar */}
          <div>
            <div className="mb-1.5 flex justify-between text-xs font-semibold">
              <span className="text-foreground">
                {t('openLeads', { count: agent.openLeadsCount })}
              </span>
              <span className="text-muted-foreground">
                {t('capacity')} ({leadsPct}%)
              </span>
            </div>
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div
                className={`h-full ${leadsColorClass} transition-all duration-300`}
                style={{ width: `${leadsPct}%` }}
              />
            </div>
          </div>

          {/* Visits Target Progress */}
          <div>
            <div className="mb-1.5 flex justify-between text-xs font-semibold">
              <span className="text-foreground">{t('visitsThisMonth')}</span>
              <span className="text-muted-foreground">
                {agent.targetVisits !== null ? (
                  t('targetProgress', {
                    actual: agent.actualVisitsThisMonth,
                    target: agent.targetVisits,
                  })
                ) : (
                  <span>{agent.actualVisitsThisMonth}</span>
                )}
              </span>
            </div>
            <Progress value={targetPct} className="h-1.5" />
          </div>

          {/* Metrics Grid */}
          <dl className="border-border/60 bg-muted/30 grid grid-cols-2 gap-3 rounded-lg border p-2.5">
            <div>
              <dt className="text-muted-foreground flex items-center gap-1 text-[11px] font-medium">
                <Clock className="size-3" />
                {t('avgResponse')}
              </dt>
              <dd className="mt-0.5">
                <span
                  className={`inline-flex rounded-md px-1.5 py-0.5 text-sm font-bold ${responseBg} ${responseColor}`}
                >
                  {responseMin !== null ? `${Math.round(responseMin)}m` : '--'}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[11px] font-medium">
                {t('leadsWorked')}
              </dt>
              <dd className="text-foreground mt-0.5 text-sm font-bold">
                {agent.leadsWorked}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[11px] font-medium">
                {t('visitsNoShow')}
              </dt>
              <dd className="text-foreground mt-0.5 text-sm font-bold">
                {agent.visitsCompleted}{' '}
                <span className="text-muted-foreground text-xs font-normal">
                  (
                  {agent.noShowRate !== null ? Math.round(agent.noShowRate) : 0}
                  %)
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[11px] font-medium">
                {t('conversion')}
              </dt>
              <dd className="text-foreground mt-0.5 text-sm font-bold">
                {agent.conversionRate !== null
                  ? `${Math.round(agent.conversionRate)}%`
                  : '--'}
              </dd>
            </div>
          </dl>
        </div>

        {/* 1-Tap Quick Action Buttons */}
        <div className="border-border/60 mt-4 flex items-center gap-2 border-t pt-3 print:hidden">
          <Link
            href={`/contacts?assigned_to=${agent.agentId}`}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'flex-1 gap-1.5 text-xs font-medium'
            )}
          >
            <ExternalLink className="size-3.5" />
            {t('viewLeadsBtn')}
          </Link>

          {isAdmin && onEditTarget && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditTarget(agent)}
              className="flex-1 gap-1.5 text-xs font-medium"
            >
              <Target className="text-primary size-3.5" />
              {t('setTargetBtn')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
