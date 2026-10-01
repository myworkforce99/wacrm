'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Phone, Search, MessageCircle, Pencil, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useCan } from '@/hooks/use-can';
import { GatedButton } from '@/components/ui/gated-button';
import type { SiteVisit, Contact, Property } from '@/types';
import { ScheduleVisitSheet } from '@/components/site-visits/schedule-visit-sheet';
import { PullToRefresh } from '@/components/layout/pull-to-refresh';
import { PageHeader } from '@/components/layout/page-header';
import Link from 'next/link';
import { cn } from '@/lib/utils';

import { format, isToday, isPast, isFuture, isTomorrow } from 'date-fns';

type VisitWithDetails = SiteVisit & {
  contact: Contact | null;
  property: Property | null;
};

const VISIT_STATUS_CONFIG: Record<string, { bg: string; text: string }> = {
  confirmed: { bg: 'bg-green-100', text: 'text-green-700' },
  pending: { bg: 'bg-amber-100', text: 'text-amber-700' },
  no_show: { bg: 'bg-red-100', text: 'text-red-700' },
  rescheduled: { bg: 'bg-blue-100', text: 'text-blue-700' },
  completed: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

function VisitStatusBadge({ status, label }: { status: string; label: string }) {
  const cfg = VISIT_STATUS_CONFIG[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', cfg.bg, cfg.text)}>
      {label}
    </span>
  );
}

export default function SiteVisitsPage() {
  const t = useTranslations('SiteVisits.page');
  const supabase = createClient();
  const canEdit = useCan('send-messages');

  const [visits, setVisits] = useState<VisitWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [search, setSearch] = useState('');

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('site_visits')
      .select('*, contact:contacts(*), property:properties(*)')
      .order('scheduled_at', { ascending: true });

    if (error) {
      toast.error(t('errorLoad'));
    } else {
      setVisits(data as VisitWithDetails[]);
    }
    setLoading(false);
  }, [supabase, t]);

  useEffect(() => {
    setTimeout(fetchVisits, 0);
  }, [fetchVisits]);

  async function updateStatus(id: string, newStatus: string) {
    const { error } = await supabase
      .from('site_visits')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      toast.error(t('toastStatusError'));
    } else {
      toast.success(t('toastStatusUpdated'));
      fetchVisits();
    }
  }

  const filteredVisits = visits.filter((v) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      v.contact?.name?.toLowerCase().includes(term) ||
      v.contact?.phone?.toLowerCase().includes(term) ||
      v.property?.title?.toLowerCase().includes(term)
    );
  });

  const todayVisits = filteredVisits.filter(
    (v) => v.scheduled_at && isToday(new Date(v.scheduled_at))
  );
  const upcomingVisits = filteredVisits.filter(
    (v) =>
      v.scheduled_at &&
      isFuture(new Date(v.scheduled_at)) &&
      !isToday(new Date(v.scheduled_at))
  );
  const pastVisits = filteredVisits
    .filter(
      (v) =>
        v.scheduled_at &&
        isPast(new Date(v.scheduled_at)) &&
        !isToday(new Date(v.scheduled_at))
    )
    .reverse();

  function VisitListRow({ visit }: { visit: VisitWithDetails }) {
    const statusLabelKey = `status${visit.status
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('')}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statusLabel = t(statusLabelKey as any) || visit.status;

    const dateObj = visit.scheduled_at ? new Date(visit.scheduled_at) : null;
    const isVisitToday = dateObj ? isToday(dateObj) : false;
    const isVisitTomorrow = dateObj ? isTomorrow(dateObj) : false;
    const formattedDate = dateObj ? format(dateObj, 'MMM d') : '-';
    const hour = dateObj ? format(dateObj, 'h') : '-';
    const minute = dateObj ? format(dateObj, 'mm') : '--';
    const ampm = dateObj ? format(dateObj, 'a') : '';

    return (
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4">
        {/* Date block */}
        <div className="shrink-0 rounded-xl bg-primary/10 p-3 text-center w-16">
          <div className="text-[9px] font-bold uppercase tracking-wide text-primary">
            {isVisitToday ? 'TODAY' : isVisitTomorrow ? 'TOMORROW' : formattedDate}
          </div>
          <div className="mt-0.5 text-xl font-bold text-primary">{hour}:{minute}</div>
          <div className="text-[9px] text-primary/70 uppercase">{ampm}</div>
        </div>

        {/* Name + Property */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">
            {visit.contact?.name || visit.contact?.phone || 'Unknown Contact'}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            📍 {visit.property?.title || 'No Property'}{visit.property?.location ? `, ${visit.property.location}` : ''}
          </p>
        </div>

        {/* Status badge */}
        <VisitStatusBadge status={visit.status} label={statusLabel} />

        {/* Actions */}
        <div className="flex items-center gap-2 text-muted-foreground ml-2">
          {visit.contact && (
            <Link href={`/inbox?contact=${visit.contact.id}`} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
              <MessageCircle className="size-4" />
            </Link>
          )}
          {visit.contact?.phone && (
            <a href={`tel:${visit.contact.phone}`} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
              <Phone className="size-4" />
            </a>
          )}
          {canEdit && (
            <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" onClick={() => setScheduleOpen(true)}>
              <Pencil className="size-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={fetchVisits}>
      <div className="space-y-6 pb-20">
        <PageHeader 
          title={t('title')} 
          subtitle={`${visits.length} visits scheduled`}
          action={
            <GatedButton
              canAct={canEdit}
              gateReason="schedule visits"
              onClick={() => setScheduleOpen(true)}
              className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground px-4 text-sm"
            >
              <Plus className="mr-1 size-4" />
              {t('scheduleBtn')}
            </GatedButton>
          }
        />

        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search visits..."
            className="bg-card border-border text-foreground placeholder:text-muted-foreground pl-8"
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="text-primary size-6 animate-spin" />
            <p className="text-muted-foreground mt-2 text-sm">{t('loading')}</p>
          </div>
        ) : visits.length === 0 ? (
          <div className="flex flex-col items-center py-12">
            <Calendar className="text-muted-foreground size-8" />
            <p className="text-muted-foreground mt-2 text-sm">
              {t('noVisits')}
            </p>
            <GatedButton
              canAct={canEdit}
              gateReason="schedule visits"
              variant="outline"
              size="sm"
              onClick={() => setScheduleOpen(true)}
              className="mt-4 rounded-full"
            >
              {t('scheduleBtn')}
            </GatedButton>
          </div>
        ) : (
          <div className="space-y-6">
            {todayVisits.length > 0 && (
              <div>
                <h2 className="text-foreground mb-3 text-lg font-semibold">
                  {t('today')}
                </h2>
                <div className="flex flex-col gap-3">
                  {todayVisits.map((v) => (
                    <VisitListRow key={v.id} visit={v} />
                  ))}
                </div>
              </div>
            )}
            {upcomingVisits.length > 0 && (
              <div>
                <h2 className="text-foreground mb-3 text-lg font-semibold">
                  {t('upcoming')}
                </h2>
                <div className="flex flex-col gap-3">
                  {upcomingVisits.map((v) => (
                    <VisitListRow key={v.id} visit={v} />
                  ))}
                </div>
              </div>
            )}
            {pastVisits.length > 0 && (
              <div>
                <h2 className="text-foreground mb-3 text-lg font-semibold">
                  {t('past')}
                </h2>
                <div className="flex flex-col gap-3">
                  {pastVisits.map((v) => (
                    <VisitListRow key={v.id} visit={v} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <ScheduleVisitSheet
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          onSuccess={fetchVisits}
        />
      </div>
    </PullToRefresh>
  );
}
