'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { formatCurrency, formatINR } from '@/lib/currency';
import { MessageCircle, Phone } from 'lucide-react';
import Link from 'next/link';

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
    source?: string;
  } | null;
  deals?: { pipeline_stages?: { name?: string } }[];
}

interface DashboardVisit {
  id: string;
  scheduled_at: string;
  status: string;
  contacts?: { name?: string };
  properties?: { title?: string };
}

export default function DashboardPage() {
  const t = useTranslations('Dashboard.page');
  const { defaultCurrency, profile } = useAuth();

  const [metrics, setMetrics] = useState<MetricsBundle | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  const [followups, setFollowups] = useState<{
    count: number;
    overdue: number;
  } | null>(null);
  const [, setFollowupsLoading] = useState(true);

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

  const loadAll = useCallback(() => {
    const db = createClient();

    void loadMetrics(db)
      .then((m) => setMetrics(m))
      .catch((err) => console.error('[dashboard] metrics failed:', err))
      .finally(() => setMetricsLoading(false));

    void getFollowupsDueCount(db)
      .then((f) => setFollowups(f))
      .catch((err) => console.error('[dashboard] followups failed:', err))
      .finally(() => setFollowupsLoading(false));

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

    void db
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('contact_tags.tags.name', 'hot-lead')
      .not('contact_tags', 'is', null) // We would need a custom RPC or view for perfect tag filtering due to PostgREST inner join limitations, so we fallback to a simpler count if needed. Actually, a simpler way is fetching the contacts with tags.
      .then(({ count, error }) => {
        // Fallback: we'll just fetch hot leads in a separate simpler query if needed, or rely on a known query.
      });

    void db
      .from('contacts')
      .select('id, contact_tags!inner(tags!inner(name))')
      .eq('contact_tags.tags.name', 'hot-lead')
      .then(({ data, error }) => {
        if (!error && data) setHotLeadsCount(data.length);
      });

    void db
      .from('contacts')
      .select(
        '*, lead_details(*), deals(status, pipeline_stages!deals_stage_id_fkey(name)), contact_tags(tags(name))'
      )
      .order('created_at', { ascending: false })
      .order('created_at', { referencedTable: 'deals', ascending: false })
      .limit(5)
      .then(({ data, error }) => {
        if (error) console.error('[dashboard] recent leads failed:', error);
        else setRecentLeads(data || []);
        setRecentLeadsLoading(false);
      });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    void db
      .from('site_visits')
      .select('*, contacts(name), properties(title)')
      .gte('scheduled_at', todayStart.toISOString())
      .lte('scheduled_at', todayEnd.toISOString())
      .order('scheduled_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('[dashboard] today visits failed:', error);
        else setTodayVisits(data || []);
        setTodayVisitsLoading(false);
      });

    // We can fetch today's tasks via the API, or duplicate logic here.
    // Fetching via our API route is simpler to reuse the exact task formatting/filters.
    fetch('/api/tasks?due_today=true')
      .then((r) => r.json())
      .then((d) => {
        setTodayTasks(d.tasks || []);
      })
      .catch((e) => console.error('[dashboard] tasks failed:', e))
      .finally(() => setTodayTasksLoading(false));
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

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

  const firstName = profile?.full_name?.split(' ')[0] || '';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WhatsappSetupChecklist />
        <TeamSetupChecklist />
      </div>

      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <span>{t('greeting') + `, ${firstName} 👋`}</span>
            {(profile?.account_role === 'owner' ||
              profile?.account_role === 'admin') && (
              <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-semibold">
                Team View
              </span>
            )}
          </div>
        }
        subtitle={
          <span>
            Here&apos;s your pipeline today.{' '}
            <Link
              href="/contacts?tag=hot-lead"
              className="text-primary font-medium underline-offset-2 hover:underline"
            >
              {t('hotLeadsNotice', { count: hotLeadsCount })}
            </Link>
          </span>
        }
      />

      {/* Quick actions */}
      <QuickActions />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {metricsLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <div className="border-border bg-card rounded-xl border p-5 shadow-sm">
              <div className="mb-3 text-2xl">👥</div>
              <div className="text-foreground text-3xl font-bold">
                {metrics?.activeConversations.current ?? 0}
              </div>
              <div className="text-muted-foreground mt-1 text-sm">
                Active Leads
              </div>
              <div className="mt-2 text-xs font-medium text-green-600">
                +
                {(metrics?.activeConversations.current ?? 0) -
                  (metrics?.activeConversations.previous ?? 0)}{' '}
                today
              </div>
            </div>

            <div className="border-border bg-card rounded-xl border p-5 shadow-sm">
              <div className="mb-3 text-2xl">📅</div>
              <div className="text-foreground text-3xl font-bold">
                {todayVisits.length}
              </div>
              <div className="text-muted-foreground mt-1 text-sm">
                Site Visits Today
              </div>
              <div className="text-muted-foreground mt-2 text-xs font-medium">
                {todayVisits.filter((v) => v.status === 'completed').length}{' '}
                completed,{' '}
                {todayVisits.filter((v) => v.status === 'scheduled').length}{' '}
                scheduled
              </div>
            </div>

            <div className="border-border bg-card rounded-xl border p-5 shadow-sm">
              <div className="mb-3 text-2xl">⚡</div>
              <div className="text-foreground text-3xl font-bold">
                {followups?.count ?? 0}
              </div>
              <div className="text-muted-foreground mt-1 text-sm">
                Action Items
              </div>
              <div
                className={cn(
                  'mt-2 text-xs font-medium',
                  (followups?.overdue ?? 0) > 0
                    ? 'text-red-500'
                    : 'text-green-600'
                )}
              >
                {(followups?.overdue ?? 0) > 0
                  ? `${followups?.overdue} overdue`
                  : 'All caught up'}
              </div>
            </div>

            <div className="border-border bg-card rounded-xl border p-5 shadow-sm">
              <div className="mb-3 text-2xl">👤</div>
              <div className="text-foreground text-3xl font-bold">
                {metrics?.newContactsToday.current ?? 0}
              </div>
              <div className="text-muted-foreground mt-1 text-sm">
                {t('newContactsToday')}
              </div>
              <div
                className={cn(
                  'mt-2 text-xs font-medium',
                  (metrics?.newContactsToday.current ?? 0) -
                    (metrics?.newContactsToday.previous ?? 0) >=
                    0
                    ? 'text-green-600'
                    : 'text-red-500'
                )}
              >
                {(metrics?.newContactsToday.current ?? 0) -
                  (metrics?.newContactsToday.previous ?? 0) >=
                0
                  ? '+'
                  : ''}
                {(metrics?.newContactsToday.current ?? 0) -
                  (metrics?.newContactsToday.previous ?? 0)}{' '}
                vs yesterday
              </div>
            </div>

            <div className="border-border bg-card rounded-xl border p-5 shadow-sm">
              <div className="mb-3 text-2xl">💰</div>
              <div className="text-foreground text-3xl font-bold">
                {metrics?.openDealsValue
                  ? defaultCurrency === 'INR'
                    ? formatINR(metrics.openDealsValue)
                    : formatCurrency(metrics.openDealsValue, defaultCurrency)
                  : 0}
              </div>
              <div className="text-muted-foreground mt-1 text-sm">
                {t('openDealsValue')}
              </div>
              <div className="text-muted-foreground mt-2 text-xs font-medium">
                {t('openDeals', { count: metrics?.openDealsCount ?? 0 })}
              </div>
            </div>

            <div className="border-border bg-card rounded-xl border p-5 shadow-sm">
              <div className="mb-3 text-2xl">📤</div>
              <div className="text-foreground text-3xl font-bold">
                {metrics?.messagesSentToday.current ?? 0}
              </div>
              <div className="text-muted-foreground mt-1 text-sm">
                {t('messagesSentToday')}
              </div>
              <div
                className={cn(
                  'mt-2 text-xs font-medium',
                  (metrics?.messagesSentToday.current ?? 0) -
                    (metrics?.messagesSentToday.previous ?? 0) >=
                    0
                    ? 'text-green-600'
                    : 'text-red-500'
                )}
              >
                {(metrics?.messagesSentToday.current ?? 0) -
                  (metrics?.messagesSentToday.previous ?? 0) >=
                0
                  ? '+'
                  : ''}
                {(metrics?.messagesSentToday.current ?? 0) -
                  (metrics?.messagesSentToday.previous ?? 0)}{' '}
                vs yesterday
              </div>
            </div>
          </>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex min-h-0 flex-col lg:col-span-2">
          <div className="border-border bg-card flex-1 rounded-xl border p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-foreground text-lg font-semibold">
                {t('recentLeads')}
              </h3>
              <Link
                href="/contacts"
                className="text-primary text-sm font-medium hover:underline"
              >
                {t('viewAll')}
              </Link>
            </div>

            <div className="flex flex-col">
              {recentLeadsLoading ? (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  Loading...
                </div>
              ) : recentLeads.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  No recent leads.
                </div>
              ) : (
                recentLeads.map((lead) => {
                  const isHot = lead.contact_tags?.some(
                    (t) => t.tags?.name === 'hot-lead'
                  );
                  const location =
                    lead.lead_details?.location_preference || 'No location';

                  const min = lead.lead_details?.budget_min;
                  const max = lead.lead_details?.budget_max;
                  const format = (v: number) =>
                    defaultCurrency === 'INR'
                      ? formatINR(v)
                      : formatCurrency(v, defaultCurrency);
                  const budget =
                    !min && !max
                      ? 'No budget'
                      : min && !max
                        ? format(min)
                        : !min && max
                          ? format(max)
                          : `${format(min as number)} - ${format(max as number)}`;

                  const source = lead.lead_details?.source || 'manual';
                  const stageName =
                    lead.deals?.[0]?.pipeline_stages?.name || 'New';

                  return (
                    <div
                      key={lead.id}
                      className="border-border flex items-center gap-3 border-b py-3 last:border-0"
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback
                          className="text-sm font-medium text-white"
                          style={{ background: avatarColorForName(lead.name) }}
                        >
                          {initialsForName(lead.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-foreground truncate text-sm font-medium">
                            {lead.name || 'Unknown'}
                          </span>
                          {isHot && (
                            <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 uppercase">
                              HOT
                            </span>
                          )}
                        </div>
                        <p className="text-muted-foreground truncate text-xs">
                          {location} · {budget}
                        </p>
                      </div>
                      <div className="hidden shrink-0 sm:block">
                        <SourceBadge source={source} />
                      </div>
                      <div className="ml-2 hidden shrink-0 sm:block">
                        <StatusBadge status={stageName} />
                      </div>
                      <div className="ml-auto flex items-center gap-1.5 pl-2">
                        <Link
                          href={`/inbox?contact=${lead.id}`}
                          className="hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg p-1.5"
                        >
                          <MessageCircle className="size-4" />
                        </Link>
                        <a
                          href={`/contacts?contactId=${lead.id}`}
                          className="hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center rounded-lg p-1.5"
                          title="Edit Contact"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="lucide lucide-pencil"
                          >
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            <path d="m15 5 4 4" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-1">
          <div className="border-border bg-card rounded-xl border p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-foreground text-sm font-semibold">
                {t('todayVisits')}
              </h3>
              <span className="text-primary bg-primary/10 rounded-full px-2 py-0.5 text-xs font-medium">
                {todayVisits.length}{' '}
                {t('todayVisits').split(' ')[0].toLowerCase()}
              </span>
            </div>
            <div className="flex flex-col">
              {todayVisitsLoading ? (
                <div className="text-muted-foreground py-4 text-center text-sm">
                  Loading...
                </div>
              ) : todayVisits.length === 0 ? (
                <div className="text-muted-foreground py-4 text-center text-sm">
                  No visits scheduled today.
                </div>
              ) : (
                todayVisits.map((v) => {
                  const time = new Date(v.scheduled_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <div
                      key={v.id}
                      className="border-border flex items-center gap-3 border-b py-3 last:border-0"
                    >
                      <div className="bg-primary/10 min-w-[56px] shrink-0 rounded-lg px-2 py-1.5 text-center">
                        <div className="text-primary text-[9px] font-bold uppercase">
                          TODAY
                        </div>
                        <div className="text-primary text-xs font-bold">
                          {time}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground truncate text-sm font-medium">
                          {v.contacts?.name || 'Unknown'}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          📍 {v.properties?.title || 'No property'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={v.status} />
                        {v.status === 'scheduled' && (
                          <div className="mt-1 flex gap-1">
                            <button
                              onClick={() => {
                                // Optimistic update
                                setTodayVisits((prev) =>
                                  prev.map((visit) =>
                                    visit.id === v.id
                                      ? { ...visit, status: 'completed' }
                                      : visit
                                  )
                                );
                                const db = createClient();
                                db.from('site_visits')
                                  .update({ status: 'completed' })
                                  .eq('id', v.id)
                                  .then(({ error }) => {
                                    if (error) {
                                      console.error(
                                        'Failed to update site visit:',
                                        error
                                      );
                                      // Revert on error if needed
                                    }
                                  });
                              }}
                              className="rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] text-green-700 transition-colors hover:bg-green-100"
                            >
                              Complete
                            </button>
                            <button
                              onClick={() => {
                                setTodayVisits((prev) =>
                                  prev.map((visit) =>
                                    visit.id === v.id
                                      ? { ...visit, status: 'no_show' }
                                      : visit
                                  )
                                );
                                const db = createClient();
                                db.from('site_visits')
                                  .update({ status: 'no_show' })
                                  .eq('id', v.id)
                                  .then(({ error }) => {
                                    if (error) {
                                      console.error(
                                        'Failed to update site visit:',
                                        error
                                      );
                                    }
                                  });
                              }}
                              className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700 transition-colors hover:bg-red-100"
                            >
                              No-show
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="border-border bg-card flex min-h-[300px] flex-1 flex-col rounded-xl border shadow-sm">
            <TasksWidget
              initialTasks={todayTasks}
              initialLoading={todayTasksLoading}
            />
          </div>
        </div>
      </div>

      {/* Charts row */}
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

      {/* Response time */}
      <ResponseTimeChart data={responseTime} loading={responseTimeLoading} />

      {/* Activity feed */}
      <div className="grid grid-cols-1">
        <div className="flex min-h-0 flex-col">
          <ActivityFeed items={activity} loading={activityLoading} />
        </div>
      </div>
    </div>
  );
}
