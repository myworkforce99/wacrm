'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  Target,
  ExternalLink,
  Clock,
  AlertTriangle,
  UserCheck,
  UserX,
} from 'lucide-react';
import Link from 'next/link';
import type { AgentPerformance } from '@/lib/dashboard/types';
import { vibrate } from '@/lib/utils/vibrate';

interface AgentTableProps {
  agents: AgentPerformance[];
  onUpdate: () => void;
  onEditTarget: (agent: AgentPerformance) => void;
  isAdmin: boolean;
}

export function AgentTable({
  agents,
  onUpdate,
  onEditTarget,
  isAdmin,
}: AgentTableProps) {
  const t = useTranslations('Team.table');
  const tCard = useTranslations('Team.agentCard');

  const toggleAvailability = async (agent: AgentPerformance) => {
    vibrate(50);
    try {
      const res = await fetch(`/api/account/members/${agent.agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: !agent.isAvailable }),
      });
      if (res.ok) {
        toast.success(tCard('toastAvailabilityUpdated', { name: agent.name }));
        onUpdate();
      } else {
        toast.error(tCard('toastAvailabilityFailed'));
      }
    } catch {
      toast.error(tCard('toastAvailabilityFailed'));
    }
  };

  const maxNominalLeads = 20;

  return (
    <div className="border-border bg-card overflow-x-auto rounded-xl border shadow-xs">
      <Table className="min-w-[800px]">
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[240px] font-semibold">
              {t('colAgent')}
            </TableHead>
            <TableHead className="w-[100px] text-center font-semibold">
              {t('colAvailability')}
            </TableHead>
            <TableHead className="w-[180px] font-semibold">
              {t('colCapacity')}
            </TableHead>
            <TableHead className="w-[180px] font-semibold">
              {t('colVisitsTarget')}
            </TableHead>
            <TableHead className="w-[120px] font-semibold">
              {t('colResponseTime')}
            </TableHead>
            <TableHead className="w-[130px] font-semibold">
              {t('colVisitsStats')}
            </TableHead>
            <TableHead className="w-[110px] font-semibold">
              {t('colConversion')}
            </TableHead>
            <TableHead className="w-[140px] text-right font-semibold">
              {t('colActions')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent) => {
            const leadsPct = Math.min(
              100,
              Math.round((agent.openLeadsCount / maxNominalLeads) * 100)
            );
            let capacityColor = 'bg-emerald-500';
            if (agent.openLeadsCount >= 10 && agent.openLeadsCount <= 18) {
              capacityColor = 'bg-amber-500';
            } else if (agent.openLeadsCount > 18) {
              capacityColor = 'bg-rose-500';
            }

            const targetVisits = agent.targetVisits ?? 0;
            const targetPct =
              targetVisits > 0
                ? Math.min(
                    100,
                    Math.round(
                      (agent.actualVisitsThisMonth / targetVisits) * 100
                    )
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
              <TableRow
                key={agent.agentId}
                className="hover:bg-muted/40 transition-colors"
              >
                {/* Agent Profile & Role */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="ring-border size-9 ring-1">
                      <AvatarImage src={agent.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-xs font-semibold">
                        {agent.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/contacts?assigned_to=${agent.agentId}`}
                          className="text-foreground hover:text-primary truncate text-sm font-semibold hover:underline"
                          title={agent.name}
                        >
                          {agent.name}
                        </Link>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                          {agent.role}
                        </span>
                        {agent.staleLeadCount > 0 && (
                          <Badge
                            variant="outline"
                            className="h-4.5 border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-400"
                          >
                            <AlertTriangle className="mr-0.5 size-2.5" />
                            {t('staleBadge', { count: agent.staleLeadCount })}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>

                {/* Inline Availability Switch */}
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    {isAdmin ? (
                      <Switch
                        checked={agent.isAvailable}
                        onCheckedChange={() => toggleAvailability(agent)}
                        aria-label={t('availableToggle')}
                        title={
                          agent.isAvailable
                            ? tCard('available')
                            : tCard('onLeave')
                        }
                      />
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          agent.isAvailable
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {agent.isAvailable ? (
                          <UserCheck className="size-3" />
                        ) : (
                          <UserX className="size-3" />
                        )}
                        {agent.isAvailable
                          ? tCard('available')
                          : tCard('onLeave')}
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* Capacity & Open Leads */}
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground font-semibold">
                        {t('openLeadsCount', { count: agent.openLeadsCount })}
                      </span>
                      <span className="text-muted-foreground font-medium">
                        {leadsPct}%
                      </span>
                    </div>
                    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                      <div
                        className={`h-full ${capacityColor} transition-all duration-300`}
                        style={{ width: `${leadsPct}%` }}
                      />
                    </div>
                  </div>
                </TableCell>

                {/* Monthly Visits Target Progress */}
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground font-semibold">
                        {agent.targetVisits !== null ? (
                          `${agent.actualVisitsThisMonth} / ${agent.targetVisits}`
                        ) : (
                          <span className="text-muted-foreground">
                            {agent.actualVisitsThisMonth} ({t('noTargetSet')})
                          </span>
                        )}
                      </span>
                      {agent.targetVisits !== null && (
                        <span className="text-muted-foreground font-medium">
                          {targetPct}%
                        </span>
                      )}
                    </div>
                    <Progress value={targetPct} className="h-1.5" />
                  </div>
                </TableCell>

                {/* Response Time SLA */}
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${responseBg} ${responseColor}`}
                    >
                      <Clock className="size-3" />
                      {responseMin !== null
                        ? `${Math.round(responseMin)}m`
                        : '--'}
                    </span>
                  </div>
                </TableCell>

                {/* Visits & No-Show Rate */}
                <TableCell>
                  <div className="text-xs">
                    <span className="text-foreground font-semibold">
                      {agent.visitsCompleted}
                    </span>
                    <span className="text-muted-foreground ml-1">
                      (
                      {agent.noShowRate !== null
                        ? Math.round(agent.noShowRate)
                        : 0}
                      %)
                    </span>
                  </div>
                </TableCell>

                {/* Conversion Rate */}
                <TableCell>
                  <span className="text-foreground text-xs font-semibold">
                    {agent.conversionRate !== null
                      ? `${Math.round(agent.conversionRate)}%`
                      : '--'}
                  </span>
                </TableCell>

                {/* Quick Inline Actions */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/contacts?assigned_to=${agent.agentId}`}
                      className={cn(
                        buttonVariants({ variant: 'ghost', size: 'sm' }),
                        'text-muted-foreground hover:text-foreground h-8 gap-1 px-2 text-xs'
                      )}
                    >
                      <ExternalLink className="size-3.5" />
                      <span className="hidden xl:inline">{t('viewLeads')}</span>
                    </Link>
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditTarget(agent)}
                        className="h-8 gap-1 px-2 text-xs"
                      >
                        <Target className="size-3.5" />
                        <span className="hidden xl:inline">
                          {t('setTarget')}
                        </span>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
