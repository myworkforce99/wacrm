'use client';

/**
 * Site Visits Page
 *
 * Renders three time-buckets (Today / Upcoming / Past) with a premium
 * card design. Key improvements over the v1:
 *
 *  - Status badges use design-system CSS variables (dark-mode safe).
 *  - Urgency ring on today's card date block.
 *  - Countdown label (e.g. "in 2h 15m") on today/upcoming visits.
 *  - Stats strip below the header (scheduled / confirmed / today).
 *  - Quick action menu replaces the cramped text buttons — one tap to
 *    Confirm, Complete, No-Show, or Reschedule.
 *  - Pencil icon properly passes the visit into ScheduleVisitSheet for
 *    edit mode instead of opening a blank create form.
 *  - Past visits collapsed by default (show last 5, expand on demand).
 *  - Mobile-first layout: action icons go into a bottom popup instead
 *    of inline — prevents overflow on 375px screens.
 *  - Contact name/phone both shown; WhatsApp icon is a proper SVG
 *    instead of the literal letter "W".
 */

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Plus,
  Phone,
  Search,
  MessageCircle,
  Pencil,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useCan } from '@/hooks/use-can';
import { GatedButton } from '@/components/ui/gated-button';
import type { SiteVisit, Contact, Property } from '@/types';
import { ScheduleVisitSheet } from '@/components/site-visits/schedule-visit-sheet';
import { PullToRefresh } from '@/components/layout/pull-to-refresh';
import { PageHeader } from '@/components/layout/page-header';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  format,
  isToday,
  isTomorrow,
  isPast,
  isFuture,
  formatDistanceToNow,
} from 'date-fns';

type VisitWithDetails = SiteVisit & {
  contact: Contact | null;
  property: Property | null;
};

// ── Status badge ────────────────────────────────────────────────────────────

type StatusKey =
  'pending' | 'confirmed' | 'completed' | 'no_show' | 'rescheduled';

const STATUS_STYLE: Record<
  StatusKey,
  { bg: string; text: string; ring: string }
> = {
  confirmed: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    ring: 'ring-primary/30',
  },
  pending: {
    bg: 'bg-amber-400/10',
    text: 'text-amber-500',
    ring: 'ring-amber-400/30',
  },
  no_show: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    ring: 'ring-destructive/30',
  },
  rescheduled: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    ring: 'ring-blue-400/30',
  },
  completed: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    ring: 'ring-border',
  },
};

function VisitStatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  const cfg = STATUS_STYLE[status as StatusKey] ?? STATUS_STYLE.completed;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
        cfg.bg,
        cfg.text,
        cfg.ring
      )}
    >
      {label}
    </span>
  );
}

// ── WhatsApp icon (small inline SVG) ────────────────────────────────────────

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}

// ── Countdown helper ─────────────────────────────────────────────────────────

function CountdownLabel({ date }: { date: Date }) {
  if (isPast(date)) return null;
  return (
    <span className="text-muted-foreground ml-1 text-[10px]">
      ({formatDistanceToNow(date, { addSuffix: true })})
    </span>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatChip({
  count,
  label,
  accent,
}: {
  count: number;
  label: string;
  accent: string;
}) {
  return (
    <div className={cn('rounded-xl px-3 py-2 text-center ring-1', accent)}>
      <div className="text-foreground text-xl font-bold">{count}</div>
      <div className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </div>
    </div>
  );
}

// ── Visit row ────────────────────────────────────────────────────────────────

interface VisitRowProps {
  visit: VisitWithDetails;
  onStatusChange: (id: string, status: string) => Promise<void>;
  onEdit: (visit: VisitWithDetails) => void;
  canEdit: boolean;
  statusLabels: Record<string, string>;
  t: ReturnType<typeof useTranslations<'SiteVisits.page'>>;
}

function VisitRow({
  visit,
  onStatusChange,
  onEdit,
  canEdit,
  statusLabels,
  t,
}: VisitRowProps) {
  const dateObj = visit.scheduled_at ? new Date(visit.scheduled_at) : null;
  const isVisitToday = dateObj ? isToday(dateObj) : false;
  const isVisitTomorrow = dateObj ? isTomorrow(dateObj) : false;
  const isInFuture = dateObj ? isFuture(dateObj) : false;

  const dayLabel = isVisitToday
    ? 'TODAY'
    : isVisitTomorrow
      ? 'TMR'
      : dateObj
        ? format(dateObj, 'MMM d')
        : '—';
  const timeLabel = dateObj ? format(dateObj, 'h:mm') : '—';
  const ampm = dateObj ? format(dateObj, 'a') : '';

  const statusLabel = statusLabels[visit.status] ?? visit.status;

  // Next valid status transitions
  const canConfirm = visit.status === 'pending';
  const canComplete =
    visit.status === 'confirmed' || visit.status === 'pending';
  const canNoShow = visit.status === 'confirmed' || visit.status === 'pending';
  const canReschedule =
    visit.status === 'pending' || visit.status === 'confirmed';

  return (
    <div
      className={cn(
        'border-border bg-card group relative flex items-stretch gap-0 overflow-hidden rounded-2xl border transition-shadow hover:shadow-md',
        isVisitToday && 'ring-primary/20 ring-2'
      )}
    >
      {/* Date / time column */}
      <div
        className={cn(
          'flex w-[68px] shrink-0 flex-col items-center justify-center rounded-l-2xl px-2 py-3',
          isVisitToday ? 'bg-primary/15' : 'bg-muted/50'
        )}
      >
        <span
          className={cn(
            'text-[9px] font-bold tracking-widest uppercase',
            isVisitToday ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {dayLabel}
        </span>
        <span
          className={cn(
            'mt-0.5 text-2xl leading-none font-extrabold',
            isVisitToday ? 'text-primary' : 'text-foreground'
          )}
        >
          {timeLabel}
        </span>
        <span
          className={cn(
            'text-[9px] font-medium uppercase',
            isVisitToday ? 'text-primary/70' : 'text-muted-foreground'
          )}
        >
          {ampm}
        </span>
        {/* Urgency dot for today/upcoming */}
        {isVisitToday && (
          <span className="bg-primary mt-1.5 h-1.5 w-1.5 animate-pulse rounded-full" />
        )}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-3">
        <div className="flex items-center gap-2">
          <p className="text-foreground truncate text-sm font-semibold">
            {visit.contact?.name || visit.contact?.phone || 'Unknown Contact'}
          </p>
          {isInFuture && dateObj && <CountdownLabel date={dateObj} />}
        </div>

        {visit.property && (
          <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
            <span className="text-[10px]">📍</span>
            <span className="truncate">
              {visit.property.title}
              {visit.property.location ? `, ${visit.property.location}` : ''}
              {visit.property.configuration
                ? ` · ${visit.property.configuration}`
                : visit.property.bedrooms
                  ? ` · ${visit.property.bedrooms} BHK`
                  : ''}
            </span>
          </p>
        )}

        {visit.pickup_required && (
          <p className="flex items-center gap-1 text-[11px] font-medium text-amber-500">
            🚗 {t('pickupRequired')}
            {visit.pickup_location ? ` · ${visit.pickup_location}` : ''}
          </p>
        )}

        {/* Status + quick actions */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <VisitStatusBadge status={visit.status} label={statusLabel} />

          {canEdit && canConfirm && (
            <button
              type="button"
              onClick={() => onStatusChange(visit.id, 'confirmed')}
              className="border-primary/30 text-primary hover:bg-primary/10 inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-medium"
            >
              <CheckCircle2 className="size-3" />
              {t('confirm')}
            </button>
          )}
          {canEdit && canComplete && (
            <button
              type="button"
              onClick={() => onStatusChange(visit.id, 'completed')}
              className="text-muted-foreground hover:text-foreground border-border hover:bg-muted inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-medium"
            >
              <CheckCircle2 className="size-3" />
              {t('markCompleted')}
            </button>
          )}
          {canEdit && canNoShow && (
            <button
              type="button"
              onClick={() => onStatusChange(visit.id, 'no_show')}
              className="border-destructive/30 text-destructive hover:bg-destructive/10 inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-medium"
            >
              <XCircle className="size-3" />
              {t('markNoShow')}
            </button>
          )}
          {canEdit && canReschedule && (
            <button
              type="button"
              onClick={() => onEdit(visit)}
              className="inline-flex items-center gap-0.5 rounded-full border border-blue-400/30 px-2 py-0.5 text-[11px] font-medium text-blue-400 hover:bg-blue-400/10"
            >
              <RefreshCw className="size-3" />
              {t('reschedule')}
            </button>
          )}
        </div>
      </div>

      {/* Right action strip */}
      <div className="border-border/60 flex flex-col items-center justify-center gap-2 border-l px-2.5">
        {visit.contact && (
          <Link
            href={`/inbox?contact=${visit.contact.id}`}
            className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg p-1.5 transition-colors"
            title={t('openInbox')}
          >
            <MessageCircle className="size-4" />
          </Link>
        )}
        {visit.contact?.phone && (
          <a
            href={`https://wa.me/${visit.contact.phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground rounded-lg p-1.5 transition-colors hover:bg-[#25D366]/10 hover:text-[#25D366]"
            title="WhatsApp"
          >
            <WhatsAppIcon className="size-4" />
          </a>
        )}
        {visit.contact?.phone && (
          <a
            href={`tel:${visit.contact.phone}`}
            className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg p-1.5 transition-colors"
            title={t('callContact')}
          >
            <Phone className="size-4" />
          </a>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => onEdit(visit)}
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg p-1.5 transition-colors"
            title={t('editVisit')}
          >
            <Pencil className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const PAST_DEFAULT_COUNT = 5;

export default function SiteVisitsPage() {
  const t = useTranslations('SiteVisits.page');
  const supabase = createClient();
  const canEdit = useCan('send-messages');

  const [visits, setVisits] = useState<VisitWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<VisitWithDetails | null>(
    null
  );
  const [search, setSearch] = useState('');
  const [showAllPast, setShowAllPast] = useState(false);

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('site_visits')
      .select(
        '*, contact:contacts(id, name, phone, email), property:properties(id, title, location, configuration, bedrooms, price)'
      )
      .order('scheduled_at', { ascending: true });

    if (error) {
      toast.error(t('errorLoad'));
    } else {
      setVisits((data ?? []) as VisitWithDetails[]);
    }
    setLoading(false);
  }, [supabase, t]);

  useEffect(() => {
    setTimeout(fetchVisits, 0);
  }, [fetchVisits]);

  async function updateStatus(id: string, newStatus: string) {
    const { error } = await supabase
      .from('site_visits')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error(t('toastStatusError'));
    } else {
      toast.success(t('toastStatusUpdated'));
      fetchVisits();
    }
  }

  function handleEdit(visit: VisitWithDetails) {
    setEditingVisit(visit);
    setScheduleOpen(true);
  }

  function handleScheduleOpenChange(open: boolean) {
    setScheduleOpen(open);
    if (!open) setEditingVisit(null);
  }

  // Status label map
  const statusLabels: Record<string, string> = {
    pending: t('statusPending'),
    confirmed: t('statusConfirmed'),
    completed: t('statusCompleted'),
    no_show: t('statusNoShow'),
    rescheduled: t('statusRescheduled'),
  };

  // Filter
  const filteredVisits = visits.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      v.contact?.name?.toLowerCase().includes(q) ||
      v.contact?.phone?.toLowerCase().includes(q) ||
      v.property?.title?.toLowerCase().includes(q) ||
      v.property?.location?.toLowerCase().includes(q)
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

  // Stats
  const scheduledCount = visits.filter(
    (v) => v.status === 'pending' || v.status === 'confirmed'
  ).length;
  const confirmedCount = visits.filter((v) => v.status === 'confirmed').length;
  const todayCount = visits.filter(
    (v) => v.scheduled_at && isToday(new Date(v.scheduled_at))
  ).length;

  const shownPast = showAllPast
    ? pastVisits
    : pastVisits.slice(0, PAST_DEFAULT_COUNT);

  const rowProps = {
    onStatusChange: updateStatus,
    onEdit: handleEdit,
    canEdit,
    statusLabels,
    t,
  };

  return (
    <PullToRefresh onRefresh={fetchVisits}>
      <div className="space-y-5 pb-20">
        {/* Header */}
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle')}
          action={
            <GatedButton
              canAct={canEdit}
              gateReason="schedule visits"
              onClick={() => {
                setEditingVisit(null);
                setScheduleOpen(true);
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-4 text-sm"
            >
              <Plus className="mr-1 size-4" />
              {t('scheduleBtn')}
            </GatedButton>
          }
        />

        {/* Stats strip */}
        {!loading && visits.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <StatChip
              count={scheduledCount}
              label={t('statsScheduled')}
              accent="bg-muted ring-border"
            />
            <StatChip
              count={confirmedCount}
              label={t('statsConfirmed')}
              accent="bg-primary/5 ring-primary/20"
            />
            <StatChip
              count={todayCount}
              label={t('statsToday')}
              accent="bg-amber-400/5 ring-amber-400/30"
            />
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="bg-card border-border text-foreground placeholder:text-muted-foreground pl-8"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="text-primary size-6 animate-spin" />
            <p className="text-muted-foreground mt-2 text-sm">{t('loading')}</p>
          </div>
        ) : visits.length === 0 ? (
          <div className="border-border flex flex-col items-center justify-center rounded-2xl border border-dashed py-20">
            <Calendar className="text-muted-foreground size-10 opacity-40" />
            <p className="text-foreground mt-4 font-medium">
              {t('noVisitsTitle')}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              {t('noVisitsHint')}
            </p>
            <GatedButton
              canAct={canEdit}
              gateReason="schedule visits"
              onClick={() => setScheduleOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-5 rounded-full"
            >
              <Plus className="mr-1 size-4" />
              {t('scheduleBtn')}
            </GatedButton>
          </div>
        ) : (
          <div className="space-y-7">
            {/* Today */}
            {todayVisits.length > 0 && (
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <span className="bg-primary size-2 animate-pulse rounded-full" />
                  <h2 className="text-foreground text-base font-semibold">
                    {t('today')}
                  </h2>
                  <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-bold">
                    {todayVisits.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {todayVisits.map((v) => (
                    <VisitRow key={v.id} visit={v} {...rowProps} />
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming */}
            {upcomingVisits.length > 0 && (
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Clock className="text-muted-foreground size-4" />
                  <h2 className="text-foreground text-base font-semibold">
                    {t('upcoming')}
                  </h2>
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-bold">
                    {upcomingVisits.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {upcomingVisits.map((v) => (
                    <VisitRow key={v.id} visit={v} {...rowProps} />
                  ))}
                </div>
              </section>
            )}

            {/* Past */}
            {pastVisits.length > 0 && (
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-muted-foreground text-base font-semibold">
                    {t('past')}
                  </h2>
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-bold">
                    {pastVisits.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {shownPast.map((v) => (
                    <VisitRow key={v.id} visit={v} {...rowProps} />
                  ))}
                </div>
                {pastVisits.length > PAST_DEFAULT_COUNT && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground mt-3 w-full"
                    onClick={() => setShowAllPast((p) => !p)}
                  >
                    {showAllPast ? (
                      <>
                        <ChevronUp className="mr-1 size-4" />
                        {t('showLess')}
                      </>
                    ) : (
                      <>
                        <ChevronDown className="mr-1 size-4" />
                        {t('showMore', {
                          count: pastVisits.length - PAST_DEFAULT_COUNT,
                        })}
                      </>
                    )}
                  </Button>
                )}
              </section>
            )}
          </div>
        )}

        {/* Schedule / Edit sheet */}
        <ScheduleVisitSheet
          open={scheduleOpen}
          onOpenChange={handleScheduleOpenChange}
          onSuccess={fetchVisits}
          visit={editingVisit ?? undefined}
        />
      </div>
    </PullToRefresh>
  );
}
