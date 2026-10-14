'use client';

/**
 * DealCard
 *
 * Rich Real Estate Deal Card for the Kanban Board and Mobile Views.
 * Features:
 *  - Stage indicator strip
 *  - Deal title with won/lost outcomes
 *  - Contact name, location preference & source badge
 *  - Value in ₹ INR / currency + BrokerageBadge
 *  - Expected close date (with overdue indication)
 *  - Assignee avatar with initial
 *  - 1-click / 1-tap quick actions:
 *      * WhatsApp chat (deep-link into /inbox)
 *      * Click-to-call (tel:)
 *      * Schedule Site Visit (opens ScheduleVisitSheet)
 *      * Move Stage (opens bottom sheet / modal)
 */

import Link from 'next/link';
import type { Deal, PipelineStage, Contact } from '@/types';
import {
  Calendar,
  Check,
  X,
  ArrowRightLeft,
  Phone,
  MessageCircle,
  CalendarPlus,
  AlertCircle,
} from 'lucide-react';
import { formatCurrency, formatINR } from '@/lib/currency';
import { useTranslations } from 'next-intl';
import { BrokerageBadge } from '@/components/pipelines/brokerage-badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SourceBadge } from '@/components/ui/source-badge';
import { avatarColorForName, initialsForName } from '@/lib/avatar-color';

interface DealCardProps {
  deal: Deal;
  stage: PipelineStage | null;
  onEdit: (deal: Deal) => void;
  onMove?: (deal: Deal) => void;
  onScheduleVisit?: (deal: Deal) => void;
  isOverlay?: boolean;
  brokeragePct?: number | null;
}

type ExtendedContact = Contact & {
  lead_details?: { location_preference?: string; source?: string } | null;
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DealCard({
  deal,
  stage,
  onEdit,
  onMove,
  onScheduleVisit,
  isOverlay,
  brokeragePct,
}: DealCardProps) {
  const t = useTranslations('Pipelines.card');
  const contactLabel =
    deal.contact?.name || deal.contact?.phone || t('noContact');
  const assigneeLabel = deal.assignee?.full_name || null;
  const today = new Date().toISOString().split('T')[0];
  const isOverdue =
    deal.expected_close_date &&
    deal.expected_close_date < today &&
    deal.status === 'open';

  return (
    <div
      onClick={(e) => {
        if (isOverlay) return;
        e.stopPropagation();
        onEdit(deal);
      }}
      className={`group border-border/60 bg-card hover:bg-muted/40 relative w-full cursor-pointer rounded-xl border py-3 pr-3 pl-4 text-left shadow-xs transition-all ${
        isOverlay
          ? 'ring-primary/80 bg-card shadow-2xl ring-2'
          : 'hover:border-border hover:shadow-md'
      }`}
    >
      {/* Stage color strip */}
      <span
        aria-hidden
        className="absolute top-0 left-0 h-full w-1.5 rounded-l-xl"
        style={{ backgroundColor: stage?.color ?? '#94a3b8' }}
      />

      {/* Header: Title and Status Chips */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-foreground flex-1 text-sm leading-snug font-semibold break-words">
          {deal.title}
        </h4>
        <div className="flex shrink-0 items-center gap-1.5">
          {deal.status === 'won' && (
            <span className="bg-primary/15 text-primary inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
              <Check className="h-3 w-3" />
              {t('won')}
            </span>
          )}
          {deal.status === 'lost' && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400">
              <X className="h-3 w-3" />
              {t('lost')}
            </span>
          )}
        </div>
      </div>

      {/* Contact row */}
      <div className="mt-2 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Avatar className="h-5 w-5 shrink-0">
            <AvatarFallback
              className="text-[10px] font-semibold text-white"
              style={{ background: avatarColorForName(contactLabel) }}
            >
              {initialsForName(contactLabel)}
            </AvatarFallback>
          </Avatar>
          <span className="text-foreground truncate text-xs font-medium">
            {contactLabel}
          </span>
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          {(deal.contact as ExtendedContact)?.lead_details
            ?.location_preference && (
            <span className="max-w-[140px] truncate">
              📍{' '}
              {
                (deal.contact as ExtendedContact).lead_details
                  ?.location_preference
              }
            </span>
          )}
          <SourceBadge
            source={
              (deal.contact as ExtendedContact)?.lead_details?.source ||
              'Manual Entry'
            }
            className="origin-left scale-75"
          />
        </div>
      </div>

      {/* Financials & Expected Date */}
      <div className="mt-2.5 flex items-start justify-between">
        <div className="flex flex-col items-start gap-1">
          <span className="text-primary text-sm font-bold tracking-tight">
            {deal.currency === 'INR'
              ? formatINR(deal.value)
              : formatCurrency(deal.value, deal.currency)}
          </span>
          <BrokerageBadge dealValue={deal.value} brokeragePct={brokeragePct} />
        </div>
        {deal.expected_close_date && (
          <span
            className={`flex items-center gap-1 text-[11px] ${
              isOverdue ? 'font-semibold text-red-500' : 'text-muted-foreground'
            }`}
          >
            {isOverdue ? (
              <AlertCircle className="h-3 w-3 text-red-500" />
            ) : (
              <Calendar className="h-3 w-3" />
            )}
            {formatDate(deal.expected_close_date)}
          </span>
        )}
      </div>

      {/* Footer: Assignee & 1-Click Action Buttons */}
      <div className="border-border/40 mt-3 flex items-center justify-between border-t pt-2">
        <div className="flex items-center gap-1.5">
          {assigneeLabel ? (
            <div className="flex items-center gap-1" title={assigneeLabel}>
              <Avatar className="h-5 w-5 shrink-0">
                <AvatarFallback
                  className="text-[9px] font-bold text-white"
                  style={{ background: avatarColorForName(assigneeLabel) }}
                >
                  {initialsForName(assigneeLabel)}
                </AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground max-w-[75px] truncate text-[11px]">
                {assigneeLabel.split(' ')[0]}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground text-[10px] italic">
              Unassigned
            </span>
          )}
        </div>

        {/* 1-click action buttons */}
        {!isOverlay && (
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {deal.contact?.id && (
              <Link
                href={`/inbox?contactId=${deal.contact.id}`}
                title={t('chatWhatsAppTooltip')}
                className="text-muted-foreground rounded-md p-1 transition-colors hover:bg-emerald-500/10 hover:text-emerald-500"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </Link>
            )}

            {deal.contact?.phone && (
              <a
                href={`tel:${deal.contact.phone}`}
                title={t('callTooltip')}
                className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md p-1 transition-colors"
              >
                <Phone className="h-3.5 w-3.5" />
              </a>
            )}

            {deal.contact_id && onScheduleVisit && (
              <button
                type="button"
                onClick={() => onScheduleVisit(deal)}
                title={t('scheduleVisitTooltip')}
                className="text-muted-foreground rounded-md p-1 transition-colors hover:bg-blue-500/10 hover:text-blue-500"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
              </button>
            )}

            {onMove && deal.status === 'open' && (
              <button
                type="button"
                onClick={() => onMove(deal)}
                title={t('moveStageTooltip')}
                className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1 transition-colors"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
