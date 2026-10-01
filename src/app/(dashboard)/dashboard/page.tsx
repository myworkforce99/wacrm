'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { formatCurrency, formatINR } from '@/lib/currency';
import { MessageCircle, Phone, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

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
import { TeamSetupChecklist } from '@/components/onboarding/team-setup-checklist';
import { SourceBadge } from '@/components/ui/source-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { avatarColorForName, initialsForName } from '@/lib/avatar-color';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

type RangeDays = 7 | 30 | 90;

export default function DashboardPage() {
  const t = useTranslations('Dashboard.page');
  const { defaultCurrency, profile } = useAuth();
  
  const [metrics, setMetrics] = useState<MetricsBundle | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  const [followups, setFollowups] = useState<{
    count: number;
    overdue: number;
  } | null>(null);
  const [followupsLoading, setFollowupsLoading] = useState(true);

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

  const [responseTime, setResponseTime] = useState<ResponseTimeSummary | null>(null);
  const [responseTimeLoading, setResponseTimeLoading] = useState(true);

  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);

  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [recentLeadsLoading, setRecentLeadsLoading] = useState(true);

  const [todayVisits, setTodayVisits] = useState<any[]>([]);
  const [todayVisitsLoading, setTodayVisitsLoading] = useState(true);

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
      .select('*, lead_details(*), deals(status, pipeline_stages(name)), contact_tags(tags(name))')
      .order('created_at', { ascending: false })
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
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const firstName = profile?.full_name?.split(' ')[0] || '';
  const hotLeadsCount = 3; // Mocked for UI, ideally from query

  return (
    <div className="space-y-6">
      <TeamSetupChecklist />
      
      <PageHeader
        title={t('greeting') + `, ${firstName} 👋`}
        subtitle={
          <span>
            Here&apos;s your pipeline today.{' '}
            <Link href="/contacts?tag=hot-lead" className="font-medium text-primary underline-offset-2 hover:underline">
              {t('hotLeadsNotice', { count: hotLeadsCount })}
            </Link>
          </span>
        }
        action={
          <button className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
            {t('addLead')}
          </button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metricsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 text-2xl">👥</div>
              <div className="text-3xl font-bold text-foreground">{metrics?.activeConversations.current ?? 0}</div>
              <div className="mt-1 text-sm text-muted-foreground">Active Leads</div>
              <div className="mt-2 text-xs font-medium text-green-600">
                +{(metrics?.activeConversations.current ?? 0) - (metrics?.activeConversations.previous ?? 0)} today
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 text-2xl">📅</div>
              <div className="text-3xl font-bold text-foreground">{todayVisits.length}</div>
              <div className="mt-1 text-sm text-muted-foreground">Site Visits Today</div>
              <div className="mt-2 text-xs font-medium text-green-600">
                All confirmed
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 text-2xl">⚡</div>
              <div className="text-3xl font-bold text-foreground">{followups?.count ?? 0}</div>
              <div className="mt-1 text-sm text-muted-foreground">Follow-ups Due</div>
              <div className={cn('mt-2 text-xs font-medium', (followups?.overdue ?? 0) > 0 ? 'text-red-500' : 'text-green-600')}>
                {(followups?.overdue ?? 0) > 0 ? `${followups?.overdue} overdue` : 'All caught up'}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 text-2xl">🏆</div>
              <div className="text-3xl font-bold text-foreground">{metrics?.openDealsCount ?? 0}</div>
              <div className="mt-1 text-sm text-muted-foreground">Deals Closed</div>
              <div className="mt-2 text-xs font-medium text-green-600">
                This week
              </div>
            </div>
          </>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <div className="rounded-xl border border-border bg-card flex-1 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">{t('recentLeads')}</h3>
              <Link href="/contacts" className="text-sm font-medium text-primary hover:underline">
                {t('viewAll')}
              </Link>
            </div>
            
            <div className="flex flex-col">
              {recentLeadsLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
              ) : recentLeads.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No recent leads.</div>
              ) : (
                recentLeads.map((lead) => {
                  const isHot = lead.contact_tags?.some((t: any) => t.tags?.name === 'hot-lead');
                  const location = lead.lead_details?.[0]?.location_preference || 'No location';
                  const budget = lead.lead_details?.[0]?.budget_max 
                    ? (defaultCurrency === 'INR' ? formatINR(lead.lead_details[0].budget_max) : formatCurrency(lead.lead_details[0].budget_max, defaultCurrency))
                    : 'No budget';
                  const source = lead.lead_details?.[0]?.source || 'manual';
                  const stageName = lead.deals?.[0]?.pipeline_stages?.name || 'New';

                  return (
                    <div key={lead.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="text-sm font-medium text-white" style={{ background: avatarColorForName(lead.name) }}>
                          {initialsForName(lead.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground truncate">{lead.name || 'Unknown'}</span>
                          {isHot && (
                            <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 uppercase">
                              HOT
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{location} · {budget}</p>
                      </div>
                      <div className="hidden sm:block shrink-0">
                        <SourceBadge source={source} />
                      </div>
                      <div className="hidden sm:block shrink-0 ml-2">
                        <StatusBadge status={stageName} />
                      </div>
                      <div className="flex items-center gap-1.5 ml-auto pl-2">
                        <Link href={`/inbox?contact=${lead.id}`} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                          <MessageCircle className="size-4" />
                        </Link>
                        <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                          <Phone className="size-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">{t('todayVisits')}</h3>
              <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                {todayVisits.length} {t('todayVisits').split(' ')[0].toLowerCase()}
              </span>
            </div>
            <div className="flex flex-col">
              {todayVisitsLoading ? (
                <div className="py-4 text-center text-sm text-muted-foreground">Loading...</div>
              ) : todayVisits.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">No visits scheduled today.</div>
              ) : (
                todayVisits.map((v) => {
                  const time = new Date(v.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={v.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                      <div className="shrink-0 rounded-lg bg-primary/10 px-2 py-1.5 text-center min-w-[56px]">
                        <div className="text-[9px] font-bold uppercase text-primary">TODAY</div>
                        <div className="text-xs font-bold text-primary">{time}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{v.contacts?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground truncate">📍 {v.properties?.title || 'No property'}</p>
                      </div>
                      <StatusBadge status={v.status} />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card flex flex-col shadow-sm flex-1 min-h-[300px]">
            <TasksWidget />
          </div>
        </div>
      </div>
    </div>
  );
}
