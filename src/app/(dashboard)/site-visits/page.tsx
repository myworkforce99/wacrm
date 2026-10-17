'use client';

/**
 * Site Visits Page
 *
 * Real Estate Vertical CRM Field Visit Scheduling & Logistics:
 *  - Situational awareness KPI stat cards (Total, Today's Attention, Upcoming, Completed & Show Rate)
 *  - Multi-dimensional filters (Omni-search, Status, Timeframe, BHK/Configuration, Pickup Logistics, Agent)
 *  - View toggle: High-Density Desktop Table vs Timeline Cards (Today / Upcoming / Past)
 *  - Dedicated Native Mobile Layout (< 768px) with 1-tap Call, WhatsApp, Chat, and Status actions
 *  - Rich real-estate data points: ₹ INR formatted pricing, property specs, pickup logistics, and agent avatars
 *  - Full integration with ScheduleVisitSheet and VisitDeleteDialog
 *  - Full 4-locale i18n parity, dark & light mode styling, and React 19 safety
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { avatarColorForName, initialsForName } from '@/lib/avatar-color';
import { formatINR } from '@/lib/currency';
import { useCan } from '@/hooks/use-can';
import { useAuth } from '@/hooks/use-auth';
import { canManageMembers } from '@/lib/auth/roles';
import { GatedButton } from '@/components/ui/gated-button';
import { SourceBadge } from '@/components/ui/source-badge';
import type { SiteVisit, Contact, Property, Profile } from '@/types';
import { PROPERTY_CONFIGURATIONS } from '@/types';
import {
  ScheduleVisitSheet,
  formatConfiguration,
} from '@/components/site-visits/schedule-visit-sheet';
import { VisitDeleteDialog } from '@/components/site-visits/visit-delete-dialog';
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
import {
  Loader2,
  Plus,
  Phone,
  Search,
  MessageCircle,
  Pencil,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  X,
  TableProperties,
  LayoutGrid,
  MapPin,
  Building2,
  Car,
  MoreVertical,
  Trash2,
  User,
} from 'lucide-react';

export type VisitWithDetails = SiteVisit & {
  contact:
    | (Contact & {
        lead_details?: {
          source?: string | null;
          budget_min?: number | null;
          budget_max?: number | null;
          location_preference?: string | null;
          configuration_preference?: string[] | null;
        } | null;
      })
    | null;
  property: Property | null;
  tasks?:
    | Array<{
        id: string;
        assigned_to: string | null;
        due_at: string | null;
        done: boolean;
      }>
    | {
        id: string;
        assigned_to: string | null;
        due_at: string | null;
        done: boolean;
      }
    | null;
};

// ── Status badge ────────────────────────────────────────────────────────────

type StatusKey =
  'pending' | 'confirmed' | 'completed' | 'no_show' | 'rescheduled';

const STATUS_STYLE: Record<
  StatusKey,
  { bg: string; text: string; ring: string }
> = {
  confirmed: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    ring: 'ring-emerald-500/30',
  },
  pending: {
    bg: 'bg-amber-400/10 dark:bg-amber-400/20',
    text: 'text-amber-700 dark:text-amber-400',
    ring: 'ring-amber-400/30',
  },
  no_show: {
    bg: 'bg-destructive/10 dark:bg-destructive/20',
    text: 'text-destructive dark:text-destructive',
    ring: 'ring-destructive/30',
  },
  rescheduled: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    text: 'text-blue-700 dark:text-blue-400',
    ring: 'ring-blue-400/30',
  },
  completed: {
    bg: 'bg-muted dark:bg-muted/80',
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
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1',
        cfg.bg,
        cfg.text,
        cfg.ring
      )}
    >
      {label}
    </span>
  );
}

// ── WhatsApp Icon ────────────────────────────────────────────────────────────

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

// ── Countdown Helper ────────────────────────────────────────────────────────

function CountdownLabel({ date }: { date: Date }) {
  if (isPast(date)) return null;
  return (
    <span className="text-muted-foreground ml-1 text-[10px] whitespace-nowrap">
      ({formatDistanceToNow(date, { addSuffix: true })})
    </span>
  );
}

// ── Timeline Card Row Component ─────────────────────────────────────────────

interface VisitCardProps {
  visit: VisitWithDetails;
  agent: Profile | null;
  onStatusChange: (id: string, status: string) => Promise<void>;
  onEdit: (visit: VisitWithDetails) => void;
  onDelete: (visit: VisitWithDetails) => void;
  canEdit: boolean;
  statusLabels: Record<string, string>;
  t: ReturnType<typeof useTranslations<'SiteVisits.page'>>;
}

function VisitCard({
  visit,
  agent,
  onStatusChange,
  onEdit,
  onDelete,
  canEdit,
  statusLabels,
  t,
}: VisitCardProps) {
  const dateObj = visit.scheduled_at ? new Date(visit.scheduled_at) : null;
  const isVisitToday = dateObj ? isToday(dateObj) : false;
  const isVisitTomorrow = dateObj ? isTomorrow(dateObj) : false;
  const isInFuture = dateObj ? isFuture(dateObj) : false;

  const dayLabel = isVisitToday
    ? t('today').toUpperCase()
    : isVisitTomorrow
      ? 'TMR'
      : dateObj
        ? format(dateObj, 'MMM d')
        : '—';
  const timeLabel = dateObj ? format(dateObj, 'h:mm') : '—';
  const ampm = dateObj ? format(dateObj, 'a') : '';

  const statusLabel = statusLabels[visit.status] ?? visit.status;

  const canConfirm = visit.status === 'pending';
  const canComplete =
    visit.status === 'confirmed' || visit.status === 'pending';
  const canNoShow = visit.status === 'confirmed' || visit.status === 'pending';
  const canReschedule =
    visit.status === 'pending' || visit.status === 'confirmed';

  const leadName =
    visit.contact?.name || visit.contact?.phone || 'Unknown Lead';
  const leadSource = visit.contact?.lead_details?.source;

  return (
    <div
      onClick={() => onEdit(visit)}
      className={cn(
        'border-border bg-card group relative flex items-stretch overflow-hidden rounded-2xl border transition-shadow hover:shadow-md cursor-pointer hover:border-primary/40',
        isVisitToday && 'ring-primary/20 ring-2'
      )}
    >
      {/* Date / time block */}
      <div
        className={cn(
          'flex w-[72px] shrink-0 flex-col items-center justify-center rounded-l-2xl px-2 py-3',
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
        {isVisitToday && (
          <span className="bg-primary mt-1.5 h-1.5 w-1.5 animate-pulse rounded-full" />
        )}
      </div>

      {/* Main Details */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/inbox?contact=${visit.contact?.id ?? ''}`}
            onClick={(e) => e.stopPropagation()}
            className="text-foreground hover:text-primary truncate text-sm font-semibold transition-colors"
          >
            {leadName}
          </Link>
          {leadSource && <SourceBadge source={leadSource} />}
          {isInFuture && dateObj && <CountdownLabel date={dateObj} />}
        </div>

        {/* Property Specs */}
        {visit.property ? (
          <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
            <Building2 className="size-3.5 shrink-0" />
            <span className="truncate">
              {visit.property.title}
              {visit.property.location ? `, ${visit.property.location}` : ''}
              {formatConfiguration(
                visit.property.configuration,
                visit.property.bedrooms
              )
                ? ` · ${formatConfiguration(
                    visit.property.configuration,
                    visit.property.bedrooms
                  )}`
                : ''}
              {visit.property.price
                ? ` · ${formatINR(visit.property.price)}`
                : ''}
            </span>
          </p>
        ) : (
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <Building2 className="size-3.5 shrink-0" />
            <span>{t('generalShowing')}</span>
          </p>
        )}

        {/* Pickup and Agent Row */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {visit.pickup_required && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              <Car className="size-3" />
              <span>
                {t('pickupRequired')}
                {visit.pickup_location ? `: ${visit.pickup_location}` : ''}
              </span>
            </span>
          )}

          {agent && (
            <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <Avatar className="size-4 shrink-0">
                <AvatarFallback
                  className="text-[9px] font-medium text-white"
                  style={{
                    background: avatarColorForName(agent.full_name),
                  }}
                >
                  {initialsForName(agent.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{agent.full_name}</span>
            </div>
          )}
        </div>

        {/* Status + Actions */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <VisitStatusBadge status={visit.status} label={statusLabel} />

          {canEdit && canConfirm && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(visit.id, 'confirmed');
              }}
              className="border-primary/30 text-primary hover:bg-primary/10 inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors"
            >
              <CheckCircle2 className="size-3" />
              {t('confirm')}
            </button>
          )}
          {canEdit && canComplete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(visit.id, 'completed');
              }}
              className="text-muted-foreground hover:text-foreground border-border hover:bg-muted inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors"
            >
              <CheckCircle2 className="size-3" />
              {t('markCompleted')}
            </button>
          )}
          {canEdit && canNoShow && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(visit.id, 'no_show');
              }}
              className="border-destructive/30 text-destructive hover:bg-destructive/10 inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors"
            >
              <XCircle className="size-3" />
              {t('markNoShow')}
            </button>
          )}
          {canEdit && canReschedule && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(visit);
              }}
              className="inline-flex items-center gap-0.5 rounded-full border border-blue-400/30 px-2 py-0.5 text-[11px] font-medium text-blue-500 transition-colors hover:bg-blue-500/10"
            >
              <RefreshCw className="size-3" />
              {t('reschedule')}
            </button>
          )}
        </div>
      </div>

      {/* Right action strip */}
      <div
        className="border-border/60 flex flex-col items-center justify-center gap-1.5 border-l px-2.5"
        onClick={(e) => e.stopPropagation()}
      >
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
            className="text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg p-1.5 transition-colors"
            title={t('chatWhatsApp')}
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
          <DropdownMenu>
            <DropdownMenuTrigger
              className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg p-1.5 transition-colors"
              title={t('moreActions')}
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() => onEdit(visit)}
                className="gap-2 text-xs"
              >
                <Pencil className="size-3.5" />
                {t('editVisit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(visit)}
                className="gap-2 text-xs"
              >
                <Trash2 className="size-3.5" />
                {t('deleteVisit')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

// ── Native Mobile Card (< 768px) ────────────────────────────────────────────

function MobileVisitCard({
  visit,
  agent,
  onStatusChange,
  onEdit,
  onDelete,
  canEdit,
  statusLabels,
  t,
}: VisitCardProps) {
  const dateObj = visit.scheduled_at ? new Date(visit.scheduled_at) : null;
  const isVisitToday = dateObj ? isToday(dateObj) : false;
  const isVisitTomorrow = dateObj ? isTomorrow(dateObj) : false;
  const isInFuture = dateObj ? isFuture(dateObj) : false;

  const dayLabel = isVisitToday
    ? t('today').toUpperCase()
    : isVisitTomorrow
      ? 'TMR'
      : dateObj
        ? format(dateObj, 'MMM d')
        : '—';
  const timeLabel = dateObj ? format(dateObj, 'p') : '—';
  const statusLabel = statusLabels[visit.status] ?? visit.status;
  const leadName =
    visit.contact?.name || visit.contact?.phone || 'Unknown Lead';
  const leadSource = visit.contact?.lead_details?.source;

  return (
    <div
      onClick={() => onEdit(visit)}
      className={cn(
        'border-border bg-card space-y-3 overflow-hidden rounded-2xl border p-4 shadow-xs cursor-pointer hover:border-primary/40 transition-colors',
        isVisitToday && 'ring-primary/20 ring-2'
      )}
    >
      {/* Header: Date + Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-lg px-2 py-1 text-xs font-bold tracking-wider uppercase',
              isVisitToday
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {dayLabel}
          </span>
          <span className="text-foreground text-sm font-semibold">
            {timeLabel}
          </span>
          {isInFuture && dateObj && <CountdownLabel date={dateObj} />}
        </div>
        <VisitStatusBadge status={visit.status} label={statusLabel} />
      </div>

      {/* Lead details */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/inbox?contact=${visit.contact?.id ?? ''}`}
              onClick={(e) => e.stopPropagation()}
              className="text-foreground hover:text-primary truncate text-sm font-semibold"
            >
              {leadName}
            </Link>
            {leadSource && <SourceBadge source={leadSource} />}
          </div>
          {visit.contact?.phone && (
            <p className="text-muted-foreground text-xs">
              {visit.contact.phone}
            </p>
          )}
        </div>

        {agent && (
          <div className="bg-muted/60 text-muted-foreground flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px]">
            <Avatar className="size-3.5">
              <AvatarFallback
                className="text-[8px] font-medium text-white"
                style={{
                  background: avatarColorForName(agent.full_name),
                }}
              >
                {initialsForName(agent.full_name)}
              </AvatarFallback>
            </Avatar>
            <span className="max-w-[80px] truncate">{agent.full_name}</span>
          </div>
        )}
      </div>

      {/* Property & Specs */}
      {visit.property && (
        <div className="bg-muted/40 border-border/60 space-y-0.5 rounded-xl border p-2.5 text-xs">
          <p className="text-foreground truncate font-medium">
            {visit.property.title}
          </p>
          <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-[11px]">
            {visit.property.location && (
              <span className="flex items-center gap-0.5">
                <MapPin className="size-3" />
                {visit.property.location}
              </span>
            )}
            {formatConfiguration(
              visit.property.configuration,
              visit.property.bedrooms
            ) && (
              <span>
                ·{' '}
                {formatConfiguration(
                  visit.property.configuration,
                  visit.property.bedrooms
                )}
              </span>
            )}
            {visit.property.price && (
              <span className="text-foreground font-semibold">
                · {formatINR(visit.property.price)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Pickup logistics */}
      {visit.pickup_required && (
        <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
          <Car className="size-3.5 shrink-0" />
          <span className="truncate">
            {t('pickupRequired')}
            {visit.pickup_location ? `: ${visit.pickup_location}` : ''}
          </span>
        </div>
      )}

      {/* 1-Tap Action Bar */}
      <div
        className="border-border/60 grid grid-cols-4 gap-1.5 border-t pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        {visit.contact?.phone ? (
          <a
            href={`tel:${visit.contact.phone}`}
            className="bg-muted/60 text-foreground hover:bg-muted flex flex-col items-center justify-center rounded-xl py-2 text-xs font-medium"
          >
            <Phone className="text-primary mb-0.5 size-4" />
            <span>{t('call')}</span>
          </a>
        ) : (
          <div className="bg-muted/30 flex flex-col items-center justify-center rounded-xl py-2 text-xs opacity-40">
            <Phone className="mb-0.5 size-4" />
            <span>{t('call')}</span>
          </div>
        )}

        {visit.contact?.phone ? (
          <a
            href={`https://wa.me/${visit.contact.phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center justify-center rounded-xl bg-emerald-500/10 py-2 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
          >
            <WhatsAppIcon className="mb-0.5 size-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t('whatsapp')}</span>
          </a>
        ) : (
          <div className="bg-muted/30 flex flex-col items-center justify-center rounded-xl py-2 text-xs opacity-40">
            <WhatsAppIcon className="mb-0.5 size-4" />
            <span>{t('whatsapp')}</span>
          </div>
        )}

        {visit.contact ? (
          <Link
            href={`/inbox?contact=${visit.contact.id}`}
            className="bg-muted/60 text-foreground hover:bg-muted flex flex-col items-center justify-center rounded-xl py-2 text-xs font-medium"
          >
            <MessageCircle className="mb-0.5 size-4 text-blue-500" />
            <span>Chat</span>
          </Link>
        ) : (
          <div className="bg-muted/30 flex flex-col items-center justify-center rounded-xl py-2 text-xs opacity-40">
            <MessageCircle className="mb-0.5 size-4" />
            <span>Chat</span>
          </div>
        )}

        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="bg-muted/60 text-foreground hover:bg-muted flex flex-col items-center justify-center rounded-xl py-2 text-xs font-medium">
              <MoreVertical className="mb-0.5 size-4" />
              <span>{t('moreActions')}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs">
                  {t('changeStatus')}
                </DropdownMenuLabel>
                {visit.status === 'pending' && (
                  <DropdownMenuItem
                    onClick={() => onStatusChange(visit.id, 'confirmed')}
                    className="text-primary gap-2 text-xs"
                  >
                    <CheckCircle2 className="size-3.5" />
                    {t('confirm')}
                  </DropdownMenuItem>
                )}
                {(visit.status === 'confirmed' ||
                  visit.status === 'pending') && (
                  <DropdownMenuItem
                    onClick={() => onStatusChange(visit.id, 'completed')}
                    className="gap-2 text-xs"
                  >
                    <CheckCircle2 className="size-3.5" />
                    {t('markCompleted')}
                  </DropdownMenuItem>
                )}
                {(visit.status === 'confirmed' ||
                  visit.status === 'pending') && (
                  <DropdownMenuItem
                    onClick={() => onStatusChange(visit.id, 'no_show')}
                    className="text-destructive gap-2 text-xs"
                  >
                    <XCircle className="size-3.5" />
                    {t('markNoShow')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onEdit(visit)}
                className="gap-2 text-xs"
              >
                <Pencil className="size-3.5" />
                {t('editVisit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(visit)}
                className="gap-2 text-xs"
              >
                <Trash2 className="size-3.5" />
                {t('deleteVisit')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="bg-muted/30 flex flex-col items-center justify-center rounded-xl py-2 text-xs opacity-40">
            <MoreVertical className="mb-0.5 size-4" />
            <span>—</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page Component ─────────────────────────────────────────────────────

const PAST_DEFAULT_COUNT = 5;

export default function SiteVisitsPage() {
  const t = useTranslations('SiteVisits.page');
  const supabase = createClient();
  const { user, accountRole } = useAuth();
  const isManager = accountRole ? canManageMembers(accountRole) : false;
  const isViewOnly = useCan('view-only');
  const canEdit = !isViewOnly;

  // Data states
  const [visits, setVisits] = useState<VisitWithDetails[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeframeFilter, setTimeframeFilter] = useState('all');
  const [configFilter, setConfigFilter] = useState('all');
  const [pickupFilter, setPickupFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showAllPast, setShowAllPast] = useState(false);

  // Modals state
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<VisitWithDetails | null>(
    null
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingVisit, setDeletingVisit] = useState<VisitWithDetails | null>(
    null
  );

  // Dual lookup maps for Profiles
  const profilesById = useMemo(() => {
    const map: Record<string, Profile> = {};
    for (const p of profiles) {
      map[p.id] = p;
    }
    return map;
  }, [profiles]);

  const profilesByUserId = useMemo(() => {
    const map: Record<string, Profile> = {};
    for (const p of profiles) {
      map[p.user_id] = p;
    }
    return map;
  }, [profiles]);

  const getAgentForVisit = useCallback(
    (visit: VisitWithDetails): Profile | null => {
      const task = Array.isArray(visit.tasks) ? visit.tasks[0] : visit.tasks;
      if (task?.assigned_to) {
        return (
          profilesByUserId[task.assigned_to] ||
          profilesById[task.assigned_to] ||
          null
        );
      }
      // Fallback: check contact's assigned agent / creator
      const contactUserId = (visit.contact as { user_id?: string } | null)?.user_id;
      if (
        contactUserId &&
        (profilesByUserId[contactUserId] || profilesById[contactUserId])
      ) {
        return (
          profilesByUserId[contactUserId] ||
          profilesById[contactUserId] ||
          null
        );
      }
      return null;
    },
    [profilesById, profilesByUserId]
  );

  // Fetch visits and profiles
  const fetchVisits = useCallback(async () => {
    setLoading(true);
    const [{ data: visitData, error: visitError }, { data: profileData }] =
      await Promise.all([
        supabase
          .from('site_visits')
          .select(
            `
            *,
            contact:contacts(
              id,
              name,
              phone,
              email,
              lead_details:lead_details(
                source,
                budget_min,
                budget_max,
                location_preference,
                configuration_preference
              )
            ),
            property:properties(
              id,
              title,
              project_name,
              builder_name,
              location,
              configuration,
              bedrooms,
              price
            ),
            tasks:tasks(
              id,
              assigned_to,
              due_at,
              done
            )
          `
          )
          .order('scheduled_at', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, user_id, full_name, email, avatar_url')
          .order('full_name'),
      ]);

    if (visitError) {
      console.error('Error fetching site visits:', visitError);
      toast.error(t('errorLoad'));
    } else {
      const rawVisits = (visitData ?? []) as unknown as Array<
        SiteVisit & {
          contact?:
            | (Contact & {
                lead_details?:
                  | VisitWithDetails['contact'] extends { lead_details?: infer L }
                    ? L
                    : unknown;
              })
            | null;
          property?: Property | null;
          tasks?: VisitWithDetails['tasks'];
        }
      >;
      const normalizedVisits: VisitWithDetails[] = rawVisits.map((v) => {
        const contact = v.contact
          ? {
              ...v.contact,
              lead_details: Array.isArray(v.contact.lead_details)
                ? (v.contact.lead_details[0] ?? null)
                : (v.contact.lead_details ?? null),
            }
          : null;
        return {
          ...v,
          contact,
          property: v.property ?? null,
        };
      });
      setVisits(normalizedVisits);
    }

    if (profileData) {
      setProfiles(profileData as Profile[]);
    }

    setLoading(false);
  }, [supabase, t]);

  // React 19 safe deferred fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchVisits();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchVisits]);

  // Status transition handler
  async function updateStatus(id: string, newStatus: string) {
    const { error } = await supabase
      .from('site_visits')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error(t('toastStatusError'));
      return;
    }

    // Synchronize linked task in `tasks` table
    try {
      const isCompleted = newStatus === 'completed';
      await supabase
        .from('tasks')
        .update({
          done: isCompleted,
          done_at: isCompleted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('site_visit_id', id);
    } catch (taskErr) {
      console.error('Failed to sync linked site visit task:', taskErr);
    }

    toast.success(t('toastStatusUpdated'));
    void fetchVisits();
  }

  function handleEdit(visit: VisitWithDetails) {
    setEditingVisit(visit);
    setScheduleOpen(true);
  }

  function handleDelete(visit: VisitWithDetails) {
    setDeletingVisit(visit);
    setDeleteOpen(true);
  }

  function handleScheduleOpenChange(open: boolean) {
    setScheduleOpen(open);
    if (!open) setEditingVisit(null);
  }

  // Clear all filters
  function handleClearFilters() {
    setSearch('');
    setStatusFilter('all');
    setTimeframeFilter('all');
    setConfigFilter('all');
    setPickupFilter('all');
    setAgentFilter('all');
  }

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count++;
    if (statusFilter !== 'all') count++;
    if (timeframeFilter !== 'all') count++;
    if (configFilter !== 'all') count++;
    if (pickupFilter !== 'all') count++;
    if (isManager && agentFilter !== 'all') count++;
    return count;
  }, [
    search,
    statusFilter,
    timeframeFilter,
    configFilter,
    pickupFilter,
    agentFilter,
    isManager,
  ]);

  // Status label dictionary
  const statusLabels: Record<string, string> = {
    pending: t('statusPending'),
    confirmed: t('statusConfirmed'),
    completed: t('statusCompleted'),
    no_show: t('statusNoShow'),
    rescheduled: t('statusRescheduled'),
  };

  // KPI calculations
  const stats = useMemo(() => {
    const total = visits.length;
    let todayCount = 0;
    let todayConfirmed = 0;
    let todayPending = 0;
    let upcomingCount = 0;
    let completedCount = 0;
    let noShowCount = 0;

    for (const v of visits) {
      if (v.scheduled_at) {
        const d = new Date(v.scheduled_at);
        if (isToday(d)) {
          todayCount++;
          if (v.status === 'confirmed') todayConfirmed++;
          if (v.status === 'pending') todayPending++;
        } else if (isFuture(d)) {
          upcomingCount++;
        }
      }
      if (v.status === 'completed') {
        completedCount++;
      }
      if (v.status === 'no_show') {
        noShowCount++;
      }
    }

    const concluded = completedCount + noShowCount;
    const completionRate =
      concluded > 0 ? Math.round((completedCount / concluded) * 100) : 100;

    return {
      total,
      todayCount,
      todayConfirmed,
      todayPending,
      upcomingCount,
      completedCount,
      completionRate,
    };
  }, [visits]);

  // Multi-dimensional filtering
  const filteredVisits = useMemo(() => {
    return visits.filter((v) => {
      // 1. Omni Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const contactMatch =
          v.contact?.name?.toLowerCase().includes(q) ||
          v.contact?.phone?.toLowerCase().includes(q) ||
          v.contact?.email?.toLowerCase().includes(q);
        const formattedConfig = formatConfiguration(
          v.property?.configuration,
          v.property?.bedrooms
        );
        const propertyMatch =
          v.property?.title?.toLowerCase().includes(q) ||
          v.property?.location?.toLowerCase().includes(q) ||
          formattedConfig?.toLowerCase().includes(q) ||
          v.property?.project_name?.toLowerCase().includes(q) ||
          v.property?.builder_name?.toLowerCase().includes(q);
        const notesMatch = v.notes?.toLowerCase().includes(q);
        const agent = getAgentForVisit(v);
        const agentMatch = agent?.full_name?.toLowerCase().includes(q);

        if (!contactMatch && !propertyMatch && !notesMatch && !agentMatch) {
          return false;
        }
      }

      // 2. Status
      if (statusFilter !== 'all' && v.status !== statusFilter) {
        return false;
      }

      // 3. Timeframe
      if (timeframeFilter !== 'all') {
        if (!v.scheduled_at) return false;
        const d = new Date(v.scheduled_at);
        if (timeframeFilter === 'today' && !isToday(d)) return false;
        if (timeframeFilter === 'upcoming' && (!isFuture(d) || isToday(d)))
          return false;
        if (timeframeFilter === 'past' && (!isPast(d) || isToday(d)))
          return false;
      }

      // 4. Configuration
      if (configFilter !== 'all') {
        const propConfig =
          formatConfiguration(
            v.property?.configuration,
            v.property?.bedrooms
          ) || '';
        const normalizedPropConfig = propConfig
          .replace(/\s+/g, '')
          .toLowerCase();
        const normalizedFilter = configFilter.replace(/\s+/g, '').toLowerCase();
        if (normalizedPropConfig !== normalizedFilter) {
          return false;
        }
      }

      // 5. Pickup
      if (pickupFilter !== 'all') {
        if (pickupFilter === 'needed' && !v.pickup_required) return false;
        if (pickupFilter === 'self' && v.pickup_required) return false;
      }

      // 6. Agent Scoping & Filter (Role-based: agents only see their own visits; managers can filter by agent)
      if (!isManager && user) {
        const agent = getAgentForVisit(v);
        const isAssigned =
          agent?.user_id === user.id ||
          agent?.id === user.id ||
          (v.contact as { user_id?: string } | null)?.user_id === user.id;
        if (!isAssigned) return false;
      } else if (isManager && agentFilter !== 'all') {
        const agent = getAgentForVisit(v);
        if (agentFilter === 'unassigned') {
          if (agent) return false;
        } else {
          if (!agent) return false;
          if (agent.id !== agentFilter && agent.user_id !== agentFilter) {
            return false;
          }
        }
      }

      return true;
    });
  }, [
    visits,
    search,
    statusFilter,
    timeframeFilter,
    configFilter,
    pickupFilter,
    agentFilter,
    isManager,
    user,
    getAgentForVisit,
  ]);

  // Timeline buckets
  const todayVisits = useMemo(
    () =>
      filteredVisits.filter(
        (v) => v.scheduled_at && isToday(new Date(v.scheduled_at))
      ),
    [filteredVisits]
  );

  const upcomingVisits = useMemo(
    () =>
      filteredVisits.filter(
        (v) =>
          v.scheduled_at &&
          isFuture(new Date(v.scheduled_at)) &&
          !isToday(new Date(v.scheduled_at))
      ),
    [filteredVisits]
  );

  const pastVisits = useMemo(
    () =>
      filteredVisits
        .filter(
          (v) =>
            v.scheduled_at &&
            isPast(new Date(v.scheduled_at)) &&
            !isToday(new Date(v.scheduled_at))
        )
        .reverse(),
    [filteredVisits]
  );

  const shownPast = showAllPast
    ? pastVisits
    : pastVisits.slice(0, PAST_DEFAULT_COUNT);

  return (
    <PullToRefresh onRefresh={fetchVisits}>
      <div className="space-y-6 pb-20">
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
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-4 text-sm shadow-xs"
            >
              <Plus className="mr-1.5 size-4" />
              {t('scheduleBtn')}
            </GatedButton>
          }
        />

        {/* 1. Situational Awareness KPI Strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Card 1: Total Visits */}
          <Card className="border-border/60 bg-card/60 shadow-xs">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  {t('statsTotal')}
                </span>
                <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Calendar className="size-4" />
                </div>
              </div>
              <div className="text-foreground mt-2 text-2xl font-bold tracking-tight">
                {stats.total}
              </div>
              <p className="text-muted-foreground mt-1 text-[11px]">
                {t('statsTotalSub')}
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Today's Visits (Urgent / Active Attention) */}
          <Card className="border-border/60 bg-card/60 shadow-xs">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    {t('statsToday')}
                  </span>
                  {stats.todayCount > 0 && (
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
                    </span>
                  )}
                </div>
                <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <CalendarCheck className="size-4" />
                </div>
              </div>
              <div className="text-foreground mt-2 text-2xl font-bold tracking-tight">
                {stats.todayCount}
              </div>
              <p className="text-muted-foreground mt-1 text-[11px]">
                {t('statsTodaySub', {
                  confirmed: stats.todayConfirmed,
                  pending: stats.todayPending,
                })}
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Upcoming */}
          <Card className="border-border/60 bg-card/60 shadow-xs">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  {t('statsUpcoming')}
                </span>
                <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
                  <Clock className="size-4" />
                </div>
              </div>
              <div className="text-foreground mt-2 text-2xl font-bold tracking-tight">
                {stats.upcomingCount}
              </div>
              <p className="text-muted-foreground mt-1 text-[11px]">
                {t('statsUpcomingSub')}
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Completed & Completion Rate */}
          <Card className="border-border/60 bg-card/60 shadow-xs">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  {t('statsCompleted')}
                </span>
                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" />
                </div>
              </div>
              <div className="text-foreground mt-2 text-2xl font-bold tracking-tight">
                {stats.completedCount}
              </div>
              <p className="text-muted-foreground mt-1 text-[11px]">
                {t('statsCompletedSub', { rate: stats.completionRate })}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 2. Omni-Search Toolbar & Multi-Dimensional Filters */}
        <div className="border-border/70 bg-card/40 space-y-3 rounded-xl border p-3 shadow-xs">
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
            {/* Search */}
            <div className="relative max-w-md flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="bg-card border-border text-foreground placeholder:text-muted-foreground h-9 pr-8 pl-8.5 text-xs"
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

            {/* View Switcher & Clear Filters */}
            <div className="flex shrink-0 items-center gap-2 self-end md:self-auto">
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-8 gap-1 border border-red-200/60 bg-red-50 px-2.5 text-xs font-medium text-red-600 shadow-2xs transition-colors hover:border-red-300 hover:bg-red-100 hover:text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400 dark:hover:border-red-800 dark:hover:bg-red-900/50 dark:hover:text-red-300"
                >
                  <X className="size-3.5" />
                  {t('clearFilters')} ({activeFiltersCount})
                </Button>
              )}
              {/* View Mode Toggle (Table vs Cards) */}
              <div className="border-border bg-muted/40 hidden items-center rounded-lg border p-0.5 md:flex">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-all select-none',
                    viewMode === 'table'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title={t('viewTable')}
                >
                  <TableProperties className="size-3.5" />
                  <span>{t('viewTable')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={cn(
                    'flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-all select-none',
                    viewMode === 'cards'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title={t('viewCards')}
                >
                  <LayoutGrid className="size-3.5" />
                  <span>{t('viewCards')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filter Dropdowns Row */}
          <div className="border-border/50 flex flex-wrap items-center gap-2 border-t pt-2">
            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(val) => setStatusFilter(val || 'all')}
            >
              <SelectTrigger
                label={t('filterStatus')}
                className="bg-card h-9 min-w-[130px] text-xs"
              >
                <SelectValue placeholder={t('allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectLabel>{t('filterStatus')}</SelectLabel>
                <SelectSeparator />
                <SelectItem value="all">
                  {t('allStatuses')}
                </SelectItem>
                <SelectItem value="pending">
                  {t('statusPending')}
                </SelectItem>
                <SelectItem value="confirmed">
                  {t('statusConfirmed')}
                </SelectItem>
                <SelectItem value="completed">
                  {t('statusCompleted')}
                </SelectItem>
                <SelectItem value="no_show">
                  {t('statusNoShow')}
                </SelectItem>
                <SelectItem value="rescheduled">
                  {t('statusRescheduled')}
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Timeframe Filter */}
            <Select
              value={timeframeFilter}
              onValueChange={(val) => setTimeframeFilter(val || 'all')}
            >
              <SelectTrigger
                label={t('filterTimeframe')}
                className="bg-card h-9 min-w-[130px] text-xs"
              >
                <SelectValue placeholder={t('allTimeframes')} />
              </SelectTrigger>
              <SelectContent>
                <SelectLabel>{t('filterTimeframe')}</SelectLabel>
                <SelectSeparator />
                <SelectItem value="all">
                  {t('allTimeframes')}
                </SelectItem>
                <SelectItem value="today">
                  {t('timeframeToday')}
                </SelectItem>
                <SelectItem value="upcoming">
                  {t('timeframeUpcoming')}
                </SelectItem>
                <SelectItem value="past">
                  {t('timeframePast')}
                </SelectItem>
              </SelectContent>
            </Select>

            {/* BHK / Configuration */}
            <Select
              value={configFilter}
              onValueChange={(val) => setConfigFilter(val || 'all')}
            >
              <SelectTrigger
                label={t('filterConfig')}
                className="bg-card h-9 min-w-[130px] text-xs"
              >
                <SelectValue placeholder={t('allConfigs')} />
              </SelectTrigger>
              <SelectContent>
                <SelectLabel>{t('filterConfig')}</SelectLabel>
                <SelectSeparator />
                <SelectItem value="all">
                  {t('allConfigs')}
                </SelectItem>
                {PROPERTY_CONFIGURATIONS.map((cfg) => (
                  <SelectItem key={cfg} value={cfg}>
                    {cfg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Pickup Logistics */}
            <Select
              value={pickupFilter}
              onValueChange={(val) => setPickupFilter(val || 'all')}
            >
              <SelectTrigger
                label={t('filterPickup')}
                className="bg-card h-9 min-w-[130px] text-xs"
              >
                <SelectValue placeholder={t('allPickups')} />
              </SelectTrigger>
              <SelectContent>
                <SelectLabel>{t('filterPickup')}</SelectLabel>
                <SelectSeparator />
                <SelectItem value="all">
                  {t('allPickups')}
                </SelectItem>
                <SelectItem value="needed">
                  {t('pickupNeeded')}
                </SelectItem>
                <SelectItem value="self">
                  {t('pickupSelf')}
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Assigned Agent Filter (Only visible to managers/admins/owners) */}
            {isManager && profiles.length > 0 && (
              <Select
                value={agentFilter}
                onValueChange={(val) => setAgentFilter(val || 'all')}
              >
                <SelectTrigger
                  label={t('filterAgent')}
                  className="bg-card h-9 min-w-[130px] text-xs"
                >
                  <SelectValue placeholder={t('allAgents')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectLabel>{t('filterAgent')}</SelectLabel>
                  <SelectSeparator />
                  <SelectItem value="all">
                    {t('allAgents')}
                  </SelectItem>
                  <SelectItem value="unassigned">
                    {t('unassigned')}
                  </SelectItem>
                  {profiles.map((p) => (
                    <SelectItem
                      key={p.id}
                      value={p.user_id || p.id}
                    >
                      {p.full_name || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Agent Scoped Indicator (for individual sales agents) */}
            {!isManager && (
              <div
                className="bg-primary/10 border-primary/20 text-primary flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium shadow-2xs"
                title={t('filterMyVisits') || 'My Visits'}
              >
                <User className="size-3.5" />
                <span>{t('myVisits') || 'My Visits'}</span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Main Views (Desktop Table / Timeline Cards & Native Mobile Cards) */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="text-primary size-7 animate-spin" />
            <p className="text-muted-foreground mt-3 text-sm font-medium">
              {t('loading')}
            </p>
          </div>
        ) : visits.length === 0 ? (
          <div className="border-border flex flex-col items-center justify-center rounded-2xl border border-dashed py-20">
            <Calendar className="text-muted-foreground size-12 opacity-40" />
            <p className="text-foreground mt-4 text-base font-semibold">
              {t('noVisitsTitle')}
            </p>
            <p className="text-muted-foreground mt-1 max-w-sm text-center text-xs">
              {t('noVisitsHint')}
            </p>
            <GatedButton
              canAct={canEdit}
              gateReason="schedule visits"
              onClick={() => {
                setEditingVisit(null);
                setScheduleOpen(true);
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-5 rounded-full px-4 text-xs font-medium"
            >
              <Plus className="mr-1.5 size-4" />
              {t('scheduleBtn')}
            </GatedButton>
          </div>
        ) : filteredVisits.length === 0 ? (
          <div className="border-border flex flex-col items-center justify-center rounded-2xl border border-dashed py-16">
            <Search className="text-muted-foreground size-10 opacity-40" />
            <p className="text-foreground mt-3 text-sm font-semibold">
              {t('noResultsTitle')}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('noResultsSub')}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="mt-4 text-xs"
            >
              {t('clearFilters')}
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop Table View (visible on md:block when viewMode === 'table') */}
            {viewMode === 'table' && (
              <div className="border-border/70 bg-card hidden overflow-hidden rounded-xl border shadow-xs md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-[180px]">
                        {t('colDateTime')}
                      </TableHead>
                      <TableHead className="w-[220px]">
                        {t('colLead')}
                      </TableHead>
                      <TableHead>{t('colProperty')}</TableHead>
                      <TableHead className="w-[160px]">
                        {t('colPickup')}
                      </TableHead>
                      <TableHead className="w-[150px]">
                        {t('colAgent')}
                      </TableHead>
                      <TableHead className="w-[120px]">
                        {t('colStatus')}
                      </TableHead>
                      <TableHead className="w-[100px] text-right">
                        {t('colActions')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVisits.map((v) => {
                      const dateObj = v.scheduled_at
                        ? new Date(v.scheduled_at)
                        : null;
                      const isVisitToday = dateObj ? isToday(dateObj) : false;
                      const isVisitTomorrow = dateObj
                        ? isTomorrow(dateObj)
                        : false;
                      const isInFuture = dateObj ? isFuture(dateObj) : false;

                      const agent = getAgentForVisit(v);
                      const statusLabel = statusLabels[v.status] ?? v.status;
                      const leadName =
                        v.contact?.name || v.contact?.phone || 'Unknown Lead';
                      const leadSource = v.contact?.lead_details?.source;

                      return (
                        <TableRow
                          key={v.id}
                          onClick={() => handleEdit(v)}
                          className={cn(
                            'hover:bg-muted/40 cursor-pointer transition-colors',
                            isVisitToday && 'bg-primary/5 dark:bg-primary/10'
                          )}
                        >
                          {/* Date & Time */}
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-foreground text-xs font-semibold">
                                  {dateObj
                                    ? format(dateObj, 'MMM d, yyyy')
                                    : '—'}
                                </span>
                                {isVisitToday ? (
                                  <span className="bg-primary/15 text-primary py-0.2 rounded-md px-1.5 text-[10px] font-bold tracking-wider uppercase">
                                    {t('today')}
                                  </span>
                                ) : isVisitTomorrow ? (
                                  <span className="bg-muted text-muted-foreground py-0.2 rounded-md px-1.5 text-[10px] font-medium tracking-wider uppercase">
                                    TMR
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-muted-foreground flex items-center text-xs">
                                <span>
                                  {dateObj ? format(dateObj, 'p') : '—'}
                                </span>
                                {isInFuture && dateObj && (
                                  <CountdownLabel date={dateObj} />
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* Lead / Contact */}
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar className="size-8 shrink-0">
                                <AvatarFallback
                                  className="text-xs font-semibold text-white"
                                  style={{
                                    background: avatarColorForName(leadName),
                                  }}
                                >
                                  {initialsForName(leadName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <Link
                                    href={`/inbox?contact=${v.contact?.id ?? ''}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-foreground hover:text-primary truncate text-xs font-semibold transition-colors"
                                  >
                                    {leadName}
                                  </Link>
                                  {leadSource && (
                                    <SourceBadge source={leadSource} />
                                  )}
                                </div>
                                {v.contact?.phone && (
                                  <p className="text-muted-foreground text-[11px]">
                                    {v.contact.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* Property & Specs */}
                          <TableCell>
                            {v.property ? (
                              <div className="flex max-w-xs flex-col gap-0.5">
                                <div className="flex items-center gap-1">
                                  <Building2 className="text-muted-foreground size-3.5 shrink-0" />
                                  <span className="text-foreground truncate text-xs font-medium">
                                    {v.property.title}
                                  </span>
                                </div>
                                <div className="text-muted-foreground flex flex-wrap items-center gap-1 text-[11px]">
                                  {v.property.location && (
                                    <span className="flex items-center gap-0.5">
                                      <MapPin className="size-3" />
                                      {v.property.location}
                                    </span>
                                  )}
                                  {formatConfiguration(
                                    v.property.configuration,
                                    v.property.bedrooms
                                  ) && (
                                    <span>
                                      ·{' '}
                                      {formatConfiguration(
                                        v.property.configuration,
                                        v.property.bedrooms
                                      )}
                                    </span>
                                  )}
                                  {v.property.price && (
                                    <span className="text-foreground font-semibold">
                                      · {formatINR(v.property.price)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">
                                {t('generalShowing')}
                              </span>
                            )}
                          </TableCell>

                          {/* Pickup Logistics */}
                          <TableCell>
                            {v.pickup_required ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex w-fit items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                  <Car className="size-3" />
                                  {t('pickupRequired')}
                                </span>
                                {v.pickup_location && (
                                  <span className="text-muted-foreground max-w-[140px] truncate text-[11px]">
                                    {v.pickup_location}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                {t('selfVisit')}
                              </span>
                            )}
                          </TableCell>

                          {/* Assigned Agent */}
                          <TableCell>
                            {agent ? (
                              <div className="flex items-center gap-2">
                                <Avatar className="size-6 shrink-0">
                                  <AvatarFallback
                                    className="text-[10px] font-medium text-white"
                                    style={{
                                      background: avatarColorForName(
                                        agent.full_name
                                      ),
                                    }}
                                  >
                                    {initialsForName(agent.full_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-foreground truncate text-xs font-medium">
                                  {agent.full_name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                {t('unassigned')}
                              </span>
                            )}
                          </TableCell>

                          {/* Status Badge */}
                          <TableCell>
                            <VisitStatusBadge
                              status={v.status}
                              label={statusLabel}
                            />
                          </TableCell>

                          {/* Actions */}
                          <TableCell
                            className="text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1">
                              {v.contact?.phone && (
                                <a
                                  href={`https://wa.me/${v.contact.phone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-md p-1.5 transition-colors"
                                  title={t('chatWhatsApp')}
                                >
                                  <WhatsAppIcon className="size-3.5" />
                                </a>
                              )}
                              {v.contact?.phone && (
                                <a
                                  href={`tel:${v.contact.phone}`}
                                  className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md p-1.5 transition-colors"
                                  title={t('callContact')}
                                >
                                  <Phone className="size-3.5" />
                                </a>
                              )}
                              {v.contact && (
                                <Link
                                  href={`/inbox?contact=${v.contact.id}`}
                                  className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md p-1.5 transition-colors"
                                  title={t('openInbox')}
                                >
                                  <MessageCircle className="size-3.5" />
                                </Link>
                              )}

                              {canEdit && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5 transition-colors">
                                    <MoreVertical className="size-3.5" />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="w-44"
                                  >
                                    <DropdownMenuGroup>
                                      <DropdownMenuLabel className="text-xs">
                                        {t('changeStatus')}
                                      </DropdownMenuLabel>
                                      {v.status === 'pending' && (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            updateStatus(v.id, 'confirmed')
                                          }
                                          className="text-primary gap-2 text-xs"
                                        >
                                          <CheckCircle2 className="size-3.5" />
                                          {t('confirm')}
                                        </DropdownMenuItem>
                                      )}
                                      {(v.status === 'confirmed' ||
                                        v.status === 'pending') && (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            updateStatus(v.id, 'completed')
                                          }
                                          className="gap-2 text-xs"
                                        >
                                          <CheckCircle2 className="size-3.5" />
                                          {t('markCompleted')}
                                        </DropdownMenuItem>
                                      )}
                                      {(v.status === 'confirmed' ||
                                        v.status === 'pending') && (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            updateStatus(v.id, 'no_show')
                                          }
                                          className="text-destructive gap-2 text-xs"
                                        >
                                          <XCircle className="size-3.5" />
                                          {t('markNoShow')}
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuGroup>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleEdit(v)}
                                      className="gap-2 text-xs"
                                    >
                                      <Pencil className="size-3.5" />
                                      {t('editVisit')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={() => handleDelete(v)}
                                      className="gap-2 text-xs"
                                    >
                                      <Trash2 className="size-3.5" />
                                      {t('deleteVisit')}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Desktop Timeline Cards View (visible on md:block when viewMode === 'cards') */}
            {viewMode === 'cards' && (
              <div className="hidden space-y-7 md:block">
                {/* Today */}
                {todayVisits.length > 0 && (
                  <section>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="bg-primary size-2.5 animate-pulse rounded-full" />
                      <h2 className="text-foreground text-base font-semibold">
                        {t('today')}
                      </h2>
                      <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-bold">
                        {todayVisits.length}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {todayVisits.map((v) => (
                        <VisitCard
                          key={v.id}
                          visit={v}
                          agent={getAgentForVisit(v)}
                          onStatusChange={updateStatus}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          canEdit={canEdit}
                          statusLabels={statusLabels}
                          t={t}
                        />
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
                        <VisitCard
                          key={v.id}
                          visit={v}
                          agent={getAgentForVisit(v)}
                          onStatusChange={updateStatus}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          canEdit={canEdit}
                          statusLabels={statusLabels}
                          t={t}
                        />
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
                        <VisitCard
                          key={v.id}
                          visit={v}
                          agent={getAgentForVisit(v)}
                          onStatusChange={updateStatus}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          canEdit={canEdit}
                          statusLabels={statusLabels}
                          t={t}
                        />
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

            {/* Dedicated Native Mobile Cards View (visible on < 768px always) */}
            <div className="space-y-3 md:hidden">
              {filteredVisits.map((v) => (
                <MobileVisitCard
                  key={v.id}
                  visit={v}
                  agent={getAgentForVisit(v)}
                  onStatusChange={updateStatus}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  canEdit={canEdit}
                  statusLabels={statusLabels}
                  t={t}
                />
              ))}
            </div>
          </>
        )}

        {/* Schedule / Edit Sheet */}
        <ScheduleVisitSheet
          open={scheduleOpen}
          onOpenChange={handleScheduleOpenChange}
          onSuccess={fetchVisits}
          visit={editingVisit ?? undefined}
        />

        {/* Delete Confirmation Dialog */}
        <VisitDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          visit={deletingVisit}
          onDeleted={() => {
            void fetchVisits();
          }}
        />
      </div>
    </PullToRefresh>
  );
}
