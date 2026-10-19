'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { formatCurrency, formatINR, formatINRRange } from '@/lib/currency';
import {
  Users,
  Calendar,
  Zap,
  UserPlus,
  Coins,
  MessageSquare,
  MessageCircle,
  Phone,
  Pencil,
  RotateCw,
  Building2,
  CalendarCheck,
  Car,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Task } from '@/types';

import {
  loadActivity,
  loadConversationsSeries,
  loadMetrics,
  loadPipelineDonut,
  loadResponseTime,
  getFollowupsDueCount,
} from '@/lib/dashboard/queries';
import type {
  ActivityItem,
  ConversationsSeriesPoint,
  MetricsBundle,
  PipelineDonutData,
  ResponseTimeSummary,
} from '@/lib/dashboard/types';

import { PageHeader } from '@/components/layout/page-header';
import { SkeletonCard } from '@/components/dashboard/skeleton';
import { MetricCard } from '@/components/dashboard/metric-card';
import { TasksWidget } from '@/components/dashboard/tasks-widget';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { ConversationsChart } from '@/components/dashboard/conversations-chart';
import { PipelineDonut } from '@/components/dashboard/pipeline-donut';
import { ResponseTimeChart } from '@/components/dashboard/response-time-chart';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { WhatsappSetupChecklist } from '@/components/onboarding/whatsapp-setup-checklist';
import { TeamSetupChecklist } from '@/components/onboarding/team-setup-checklist';
import { SourceBadge } from '@/components/ui/source-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { avatarColorForName, initialsForName } from '@/lib/avatar-color';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import {
  getAgentAssignedContactIds,
  buildAgentContactFilter,
} from '@/lib/contacts/agent-scoping';

type RangeDays = 7 | 30 | 90;

interface DashboardLead {
  id: string;
  name?: string;
  phone?: string;
  contact_tags?: { tags?: { name?: string } }[];
  lead_details?: {
    location_preference?: string;
    budget_min?: number;
    budget_max?: number;
    configuration_preference?: string[];
    source?: string;
  } | null;
  deals?: { status?: string; pipeline_stages?: { name?: string } }[];
}

interface DashboardVisit {
  id: string;
  contact_id?: string | null;
  property_id?: string | null;
  scheduled_at: string;
  status: string;
  pickup_required?: boolean;
  pickup_location?: string | null;
  contacts?: { name?: string; phone?: string };
  properties?: { title?: string; location?: string };
}

export default function DashboardPage() {
  const t = useTranslations('Dashboard.page');
  const { defaultCurrency, profile, user, canManageMembers: isManager } =
    useAuth();

  const [metrics, setMetrics] = useState<MetricsBundle | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  const [followups, setFollowups] = useState<{
    count: number;
    overdue: number;
  } | null>(null);

  const [range, setRange] = useState<RangeDays>(30);
  const [series, setSeries] = useState<
    Record<RangeDays, ConversationsSeriesPoint[] | null>
  >({
    7: null,
    30: null,
    90: null,
  });
  const [seriesLoading, setSeriesLoading] = useState(true);

  const [pipeline, setPipeline] = useState<PipelineDonutData | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(true);

  const [responseTime, setResponseTime] = useState<ResponseTimeSummary | null>(
    null
  );
  const [responseTimeLoading, setResponseTimeLoading] = useState(true);

  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);

  const [recentLeads, setRecentLeads] = useState<DashboardLead[]>([]);
  const [recentLeadsLoading, setRecentLeadsLoading] = useState(true);

  const [todayVisits, setTodayVisits] = useState<DashboardVisit[]>([]);
  const [todayVisitsLoading, setTodayVisitsLoading] = useState(true);

  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [todayTasksLoading, setTodayTasksLoading] = useState(true);

  const [hotLeadsCount, setHotLeadsCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAll = useCallback(() => {
    const db = createClient();

    void loadMetrics(db)
      .then((m) => setMetrics(m))
      .catch((err) => console.error('[dashboard] metrics failed:', err))
      .finally(() => setMetricsLoading(false));

    void getFollowupsDueCount(db)
      .then((f) => setFollowups(f))
      .catch((err) => console.error('[dashboard] followups failed:', err));

    void loadConversationsSeries(db, 30)
      .then((s) => setSeries((prev) => ({ ...prev, 30: s })))
      .catch((err) => console.error('[dashboard] series failed:', err))
      .finally(() => setSeriesLoading(false));

    void loadPipelineDonut(db)
      .then((p) => setPipeline(p))
      .catch((err) => console.error('[dashboard] pipeline failed:', err))
      .finally(() => setPipelineLoading(false));

    void loadResponseTime(db)
      .then((r) => setResponseTime(r))
      .catch((err) => console.error('[dashboard] response time failed:', err))
      .finally(() => setResponseTimeLoading(false));

    void loadActivity(db, 50)
      .then((a) => setActivity(a))
      .catch((err) => console.error('[dashboard] activity failed:', err))
      .finally(() => setActivityLoading(false));

    // Hot leads count via tags lookup
    void (async () => {
      try {
        const { data: tag } = await db
          .from('tags')
          .select('id')
          .eq('name', 'hot-lead')
          .maybeSingle();

        if (tag?.id) {
          const { count, error } = await db
            .from('contact_tags')
            .select('contact_id', { count: 'exact', head: true })
            .eq('tag_id', tag.id);
          if (!error && count !== null) setHotLeadsCount(count);
        }
      } catch (err) {
        console.error('[dashboard] hot leads count error:', err);
      }
    })();

    // Recent leads
    void (async () => {
      let recentLeadsQuery = db
        .from('contacts')
        .select(
          '*, lead_details(*), deals(status, pipeline_stages!deals_stage_id_fkey(name)), contact_tags(tags(name))'
        )
        .order('created_at', { ascending: false })
        .order('created_at', { referencedTable: 'deals', ascending: false })
        .limit(6);

      if (!isManager && user?.id) {
        const assignedIds = await getAgentAssignedContactIds(
          db,
          user.id,
          profile?.id
        );
        const filter = buildAgentContactFilter(
          user.id,
          profile?.id,
          assignedIds
        );
        recentLeadsQuery = recentLeadsQuery.or(filter);
      }

      const { data, error } = await recentLeadsQuery;
      if (error) console.error('[dashboard] recent leads failed:', error);
      else setRecentLeads(data || []);
      setRecentLeadsLoading(false);
    })();

    // Today's site visits
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    void (async () => {
      const { data, error } = await db
        .from('site_visits')
        .select(
          '*, contacts(name, phone, user_id), properties(title, location), tasks(id, assigned_to)'
        )
        .gte('scheduled_at', todayStart.toISOString())
        .lte('scheduled_at', todayEnd.toISOString())
        .order('scheduled_at', { ascending: true });

      if (error) {
        console.error('[dashboard] today visits failed:', error);
      } else {
        let visits = (data as unknown as (DashboardVisit & {
          contacts?: { name?: string; phone?: string; user_id?: string };
          tasks?:
            | { id: string; assigned_to?: string }
            | { id: string; assigned_to?: string }[];
        })[]) || [];

        if (!isManager && user?.id) {
          const assignedIds = await getAgentAssignedContactIds(
            db,
            user.id,
            profile?.id
          );
          visits = visits.filter((v) => {
            const task = Array.isArray(v.tasks) ? v.tasks[0] : v.tasks;
            if (
              task?.assigned_to === user.id ||
              (profile?.id && task?.assigned_to === profile.id)
            ) {
              return true;
            }
            if (
              v.contacts?.user_id === user.id ||
              (profile?.id && v.contacts?.user_id === profile.id)
            ) {
              return true;
            }
            if (v.contact_id && assignedIds.includes(v.contact_id)) {
              return true;
            }
            return false;
          });
        }
        setTodayVisits(visits);
      }
      setTodayVisitsLoading(false);
    })();

    // Today's tasks
    const tasksUrl =
      !isManager && (profile?.id || user?.id)
        ? `/api/tasks?due_today=true&assigned_to=${profile?.id || user?.id}`
        : '/api/tasks?due_today=true';

    fetch(tasksUrl)
      .then((r) => r.json())
      .then((d) => {
        setTodayTasks(d.tasks || []);
      })
      .catch((e) => console.error('[dashboard] tasks failed:', e))
      .finally(() => setTodayTasksLoading(false));
  }, [isManager, user, profile]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    loadAll();
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success(t('refresh'));
    }, 600);
  };

  const handleRangeChange = useCallback(
    (r: RangeDays) => {
      setRange(r);
      if (series[r] !== null) return;
      setSeriesLoading(true);
      const db = createClient();
      loadConversationsSeries(db, r)
        .then((s) => setSeries((prev) => ({ ...prev, [r]: s })))
        .catch((err) => console.error('[dashboard] series failed:', err))
        .finally(() => setSeriesLoading(false));
    },
    [series]
  );

  const handleVisitStatusChange = async (
    visitId: string,
    newStatus: 'completed' | 'no_show'
  ) => {
    // Optimistic update
    setTodayVisits((prev) =>
      prev.map((v) => (v.id === visitId ? { ...v, status: newStatus } : v))
    );

    const db = createClient();
    const { error } = await db
      .from('site_visits')
      .update({ status: newStatus })
      .eq('id', visitId);

    if (error) {
      console.error('Failed to update site visit:', error);
      toast.error(t('visitUpdateFailed'));
      loadAll();
    } else {
      toast.success(t('visitUpdated'));
    }
  };

  const firstName = profile?.full_name?.split(' ')[0] || '';
  const currentHour = new Date().getHours();
  const greetingText =
    currentHour < 12
      ? t('greeting')
      : currentHour < 17
        ? t('greetingAfternoon')
        : t('greetingEvening');

  // Compute completed & upcoming visits count for today
  const completedVisitsCount = todayVisits.filter(
    (v) => v.status === 'completed'
  ).length;
  const upcomingVisitsCount = todayVisits.filter(
    (v) => v.status === 'pending' || v.status === 'confirmed'
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WhatsappSetupChecklist />
        <TeamSetupChecklist />
      </div>

      <PageHeader
        title={
          <div className="flex flex-wrap items-center gap-2.5">
            <span>{greetingText + (firstName ? `, ${firstName}` : '')} 👋</span>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase',
                isManager
                  ? 'border-primary/30 bg-primary/10 text-primary border'
                  : 'border-muted bg-muted/60 text-muted-foreground border'
              )}
            >
              {isManager ? t('teamView') : t('agentView')}
            </span>
          </div>
        }
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            Here&apos;s your property sales pipeline today.{' '}
            {hotLeadsCount > 0 ? (
              <Link
                href="/contacts?tag=hot-lead"
                className="text-primary hover:text-primary/80 inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>{t('hotLeadsNotice', { count: hotLeadsCount })}</span>
              </Link>
            ) : null}
          </span>
        }
        action={
          <button
            onClick={handleRefresh}
            title={t('refresh')}
            aria-label={t('refresh')}
            className="text-muted-foreground hover:bg-muted hover:text-foreground border-border bg-card inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
          >
            <RotateCw
              className={cn(
                'h-3.5 w-3.5',
                isRefreshing && 'text-primary animate-spin'
              )}
            />
            <span className="hidden sm:inline">{t('refresh')}</span>
          </button>
        }
      />

      {/* Quick actions bar */}
      <QuickActions />

      {/* Situational Awareness KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {metricsLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricCard
              title={t('activeLeads')}
              value={String(metrics?.activeConversations.current ?? 0)}
              icon={Users}
              iconBgClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
              href="/contacts"
              subtitle={t('activeConversationsSubtitle', {
                count: metrics?.activeConversations.current ?? 0,
              })}
            />

            <MetricCard
              title={t('siteVisitsToday')}
              value={String(todayVisits.length)}
              icon={Calendar}
              iconBgClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              href="/site-visits"
              subtitle={
                todayVisits.length > 0
                  ? t('siteVisitsSubtitle', {
                      completed: completedVisitsCount,
                      scheduled: upcomingVisitsCount,
                    })
                  : t('noVisitsToday')
              }
            />

            <MetricCard
              title={t('actionItems')}
              value={String(followups?.count ?? 0)}
              icon={Zap}
              iconBgClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
              href="/contacts"
              subtitle={
                (followups?.overdue ?? 0) > 0
                  ? t('overdueCount', { count: followups?.overdue ?? 0 })
                  : t('allCaughtUp')
              }
              subtitleClassName={
                (followups?.overdue ?? 0) > 0
                  ? 'text-red-500 font-medium'
                  : 'text-emerald-600 dark:text-emerald-400 font-medium'
              }
            />

            <MetricCard
              title={t('newContactsToday')}
              value={String(metrics?.newContactsToday.current ?? 0)}
              icon={UserPlus}
              iconBgClassName="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
              href="/contacts"
              delta={{
                sign:
                  (metrics?.newContactsToday.current ?? 0) -
                  (metrics?.newContactsToday.previous ?? 0),
                label: `${
                  (metrics?.newContactsToday.current ?? 0) -
                    (metrics?.newContactsToday.previous ?? 0) >=
                  0
                    ? '+'
                    : ''
                }${(metrics?.newContactsToday.current ?? 0) - (metrics?.newContactsToday.previous ?? 0)} ${t('vsYesterday')}`,
              }}
            />

            <MetricCard
              title={t('openDealsValue')}
              value={
                defaultCurrency === 'INR'
                  ? formatINR(metrics?.openDealsValue ?? 0)
                  : formatCurrency(
                      metrics?.openDealsValue ?? 0,
                      defaultCurrency
                    )
              }
              icon={Coins}
              iconBgClassName="bg-purple-500/10 text-purple-600 dark:text-purple-400"
              href="/pipelines"
              subtitle={t('openDeals', { count: metrics?.openDealsCount ?? 0 })}
            />

            <MetricCard
              title={t('messagesSentToday')}
              value={String(metrics?.messagesSentToday.current ?? 0)}
              icon={MessageSquare}
              iconBgClassName="bg-teal-500/10 text-teal-600 dark:text-teal-400"
              href="/inbox"
              delta={{
                sign:
                  (metrics?.messagesSentToday.current ?? 0) -
                  (metrics?.messagesSentToday.previous ?? 0),
                label: `${
                  (metrics?.messagesSentToday.current ?? 0) -
                    (metrics?.messagesSentToday.previous ?? 0) >=
                  0
                    ? '+'
                    : ''
                }${(metrics?.messagesSentToday.current ?? 0) - (metrics?.messagesSentToday.previous ?? 0)} ${t('vsYesterday')}`,
              }}
            />
          </>
        )}
      </div>

      {/* Main operational view: Recent Leads & Visits/Tasks */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Leads Widget */}
        <div className="flex min-h-0 flex-col lg:col-span-2">
          <div className="border-border bg-card flex-1 rounded-xl border p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="text-primary h-4 w-4" />
                <h3 className="text-foreground text-sm font-semibold sm:text-base">
                  {t('recentLeads')}
                </h3>
              </div>
              <Link
                href="/contacts"
                className="text-primary hover:text-primary/80 text-xs font-medium hover:underline sm:text-sm"
              >
                {t('viewAll')}
              </Link>
            </div>

            <div className="flex flex-col">
              {recentLeadsLoading ? (
                <div className="space-y-3 py-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="border-border flex items-center gap-3 border-b py-3 last:border-0"
                    >
                      <div className="bg-muted h-9 w-9 animate-pulse rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <div className="bg-muted h-4 w-1/3 animate-pulse rounded" />
                        <div className="bg-muted h-3 w-1/2 animate-pulse rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentLeads.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center justify-center py-10 text-center">
                  <Users className="text-muted-foreground/40 mb-2 h-8 w-8" />
                  <p className="text-sm font-medium">{t('noRecentLeads')}</p>
                  <p className="text-muted-foreground/80 mt-1 max-w-sm text-xs">
                    {t('noRecentLeadsHint')}
                  </p>
                  <Link
                    href="/contacts"
                    className="text-primary mt-3 text-xs font-semibold hover:underline"
                  >
                    {t('addLead')}
                  </Link>
                </div>
              ) : (
                recentLeads.map((lead) => {
                  const isHot = lead.contact_tags?.some(
                    (tagItem) => tagItem.tags?.name === 'hot-lead'
                  );
                  const location =
                    lead.lead_details?.location_preference || t('noLocation');

                  const min = lead.lead_details?.budget_min;
                  const max = lead.lead_details?.budget_max;
                  const budgetFormatted =
                    defaultCurrency === 'INR'
                      ? formatINRRange(min, max)
                      : !min && !max
                        ? t('noBudget')
                        : min && !max
                          ? formatCurrency(min, defaultCurrency)
                          : !min && max
                            ? formatCurrency(max, defaultCurrency)
                            : `${formatCurrency(min as number, defaultCurrency)} - ${formatCurrency(max as number, defaultCurrency)}`;

                  const source = lead.lead_details?.source || 'manual';
                  const stageName =
                    lead.deals?.[0]?.pipeline_stages?.name || 'New';
                  const configs = lead.lead_details?.configuration_preference;

                  return (
                    <div
                      key={lead.id}
                      className="border-border hover:bg-muted/30 -mx-2 flex flex-col gap-3 rounded-lg border-b p-3 transition-colors last:border-0 sm:mx-0 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarFallback
                            className="text-sm font-medium text-white"
                            style={{
                              background: avatarColorForName(lead.name),
                            }}
                          >
                            {initialsForName(lead.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link
                              href={`/contacts?contactId=${lead.id}`}
                              className="text-foreground hover:text-primary truncate text-sm font-semibold hover:underline"
                            >
                              {lead.name || 'Unknown'}
                            </Link>
                            {isHot && (
                              <span className="rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-600 uppercase dark:text-red-400">
                                {t('hotBadge')}
                              </span>
                            )}
                            {configs && configs.length > 0 && (
                              <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
                                {configs.join(', ')}
                              </span>
                            )}
                          </div>
                          <p className="text-muted-foreground mt-0.5 truncate text-xs">
                            {location} · {budgetFormatted}
                          </p>
                        </div>
                      </div>

                      <div className="border-border/40 flex shrink-0 items-center justify-between gap-2 border-t pt-1 sm:justify-end sm:border-t-0 sm:pt-0">
                        <div className="flex items-center gap-1.5">
                          <SourceBadge source={source} />
                          <StatusBadge status={stageName} />
                        </div>

                        <div className="flex items-center gap-1 pl-2">
                          {lead.phone && (
                            <a
                              href={`tel:${lead.phone}`}
                              title={t('call')}
                              className="hover:bg-muted text-muted-foreground rounded-lg p-1.5 transition-colors hover:text-emerald-600"
                            >
                              <Phone className="h-4 w-4" />
                            </a>
                          )}
                          <Link
                            href={`/inbox?contact=${lead.id}`}
                            title={t('chat')}
                            className="hover:bg-muted text-muted-foreground hover:text-primary rounded-lg p-1.5 transition-colors"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Link>
                          <Link
                            href={`/contacts?contactId=${lead.id}`}
                            title="Edit Contact"
                            className="hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right column: Today's Visits & Tasks */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* Today's Visits Widget */}
          <div className="border-border bg-card rounded-xl border p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-emerald-500" />
                <h3 className="text-foreground text-sm font-semibold">
                  {t('todayVisits')}
                </h3>
              </div>
              <Link
                href="/site-visits"
                className="text-primary hover:text-primary/80 text-xs font-medium hover:underline"
              >
                {t('viewAll')}
              </Link>
            </div>

            <div className="flex flex-col space-y-3">
              {todayVisitsLoading ? (
                <div className="text-muted-foreground py-6 text-center text-xs">
                  Loading visits...
                </div>
              ) : todayVisits.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center justify-center py-6 text-center">
                  <Calendar className="text-muted-foreground/40 mb-1.5 h-6 w-6" />
                  <p className="text-xs font-medium">{t('noVisitsToday')}</p>
                  <Link
                    href="/site-visits"
                    className="text-primary mt-2 text-xs font-semibold hover:underline"
                  >
                    + {t('scheduleVisit')}
                  </Link>
                </div>
              ) : (
                todayVisits.map((v) => {
                  const time = new Date(v.scheduled_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const isActionable =
                    v.status === 'pending' || v.status === 'confirmed';

                  return (
                    <div
                      key={v.id}
                      className="border-border hover:bg-muted/30 -mx-1 flex flex-col gap-2 rounded-lg border-b p-2.5 transition-colors last:border-0 sm:mx-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 border-primary/20 min-w-[54px] shrink-0 rounded-lg border px-2 py-1 text-center">
                          <div className="text-primary text-[8px] font-bold tracking-wider uppercase">
                            {t('today')}
                          </div>
                          <div className="text-primary text-xs font-bold tabular-nums">
                            {time}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <Link
                            href={
                              v.contact_id
                                ? `/contacts?contactId=${v.contact_id}`
                                : '/site-visits'
                            }
                            className="text-foreground hover:text-primary block truncate text-xs font-semibold hover:underline sm:text-sm"
                          >
                            {v.contacts?.name || 'Client'}
                          </Link>
                          <p className="text-muted-foreground mt-0.5 flex items-center gap-1 truncate text-xs">
                            <Building2 className="text-muted-foreground h-3 w-3 shrink-0" />
                            <span>
                              {v.properties?.title || 'Property visit'}
                            </span>
                          </p>
                        </div>

                        <div className="shrink-0">
                          <StatusBadge status={v.status} />
                        </div>
                      </div>

                      {v.pickup_required && (
                        <div className="flex items-center gap-1.5 rounded bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                          <Car className="h-3 w-3" />
                          <span className="truncate">
                            {t('pickup', {
                              location: v.pickup_location || 'Requested',
                            })}
                          </span>
                        </div>
                      )}

                      {isActionable && (
                        <div className="mt-1 flex items-center justify-end gap-1.5">
                          <button
                            onClick={() =>
                              handleVisitStatusChange(v.id, 'completed')
                            }
                            className="cursor-pointer rounded border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[11px] font-semibold text-green-700 transition-colors hover:bg-green-500/20 dark:text-green-300"
                          >
                            {t('completeVisit')}
                          </button>
                          <button
                            onClick={() =>
                              handleVisitStatusChange(v.id, 'no_show')
                            }
                            className="cursor-pointer rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-500/20 dark:text-red-300"
                          >
                            {t('noShowVisit')}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Today's Tasks Widget */}
          <div
            id="tasks"
            className="border-border bg-card flex min-h-[300px] flex-1 flex-col rounded-xl border shadow-sm"
          >
            <TasksWidget
              initialTasks={todayTasks}
              initialLoading={todayTasksLoading}
            />
          </div>
        </div>
      </div>

      {/* Analytics & Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="h-full lg:col-span-3">
          <ConversationsChart
            series={series}
            loading={seriesLoading}
            range={range}
            onRangeChange={handleRangeChange}
          />
        </div>
        <div className="h-full lg:col-span-2">
          <PipelineDonut
            data={pipeline}
            loading={pipelineLoading}
            currency={defaultCurrency}
          />
        </div>
      </div>

      {/* Response time SLA overview */}
      <ResponseTimeChart data={responseTime} loading={responseTimeLoading} />

      {/* Recent activity feed */}
      <div className="grid grid-cols-1">
        <div className="flex min-h-0 flex-col">
          <ActivityFeed items={activity} loading={activityLoading} />
        </div>
      </div>
    </div>
  );
}
