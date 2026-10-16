'use client';

/**
 * DealTable
 *
 * High-density desktop table view for Real Estate Pipeline Deals.
 * Provides clear typography, robust columns, live ₹ INR and brokerage
 * fee calculation, overdue flags, contact details, and 1-click inline actions:
 *  - 1-click WhatsApp inbox / chat
 *  - 1-click Call (tel:)
 *  - 1-click Schedule Site Visit
 *  - Move stage
 *  - Edit deal details
 */

import Link from 'next/link';
import type { Deal, PipelineStage, Contact } from '@/types';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BrokerageBadge } from '@/components/pipelines/brokerage-badge';
import { SourceBadge } from '@/components/ui/source-badge';
import { avatarColorForName, initialsForName } from '@/lib/avatar-color';
import { formatCurrency, formatINR } from '@/lib/currency';
import {
  Calendar,
  Phone,
  MessageCircle,
  Pencil,
  ArrowRightLeft,
  CalendarPlus,
  AlertCircle,
  Check,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

type ExtendedContact = Contact & {
  lead_details?: {
    location_preference?: string;
    source?: string;
    property_type?: string;
    bhk_preference?: string[];
  } | null;
};

interface DealTableProps {
  deals: Deal[];
  stages: PipelineStage[];
  brokeragePct?: number | null;
  defaultCurrency: string;
  onEditDeal: (deal: Deal) => void;
  onMoveDeal: (deal: Deal) => void;
  onScheduleVisit: (deal: Deal) => void;
}

export function DealTable({
  deals,
  stages,
  brokeragePct,
  defaultCurrency,
  onEditDeal,
  onMoveDeal,
  onScheduleVisit,
}: DealTableProps) {
  const t = useTranslations('Pipelines.table');
  const tCard = useTranslations('Pipelines.card');
  const tForm = useTranslations('Pipelines.form');

  const stageById = new Map<string, PipelineStage>(
    stages.map((s) => [s.id, s])
  );

  const today = new Date().toISOString().split('T')[0];

  if (deals.length === 0) {
    return (
      <div className="border-border text-muted-foreground flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
        <p className="text-foreground text-sm font-medium">
          {t('noDealsMatch')}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {t('clearFiltersToSee')}
        </p>
      </div>
    );
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border shadow-xs">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground w-[260px] text-xs font-semibold">
                {t('deal')}
              </TableHead>
              <TableHead className="text-muted-foreground w-[220px] text-xs font-semibold">
                {t('contact')}
              </TableHead>
              <TableHead className="text-muted-foreground w-[160px] text-xs font-semibold">
                {t('stage')}
              </TableHead>
              <TableHead className="text-muted-foreground w-[160px] text-xs font-semibold">
                {t('value')}
              </TableHead>
              <TableHead className="text-muted-foreground w-[140px] text-xs font-semibold">
                {t('expectedClose')}
              </TableHead>
              <TableHead className="text-muted-foreground w-[140px] text-xs font-semibold">
                {t('assignee')}
              </TableHead>
              <TableHead className="text-muted-foreground w-[160px] text-right text-xs font-semibold">
                {t('actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.map((deal) => {
              const stage = stageById.get(deal.stage_id);
              const contact = deal.contact as ExtendedContact | undefined;
              const contactName =
                contact?.name || contact?.phone || tCard('noContact');
              const assigneeName = deal.assignee?.full_name || null;
              const isOverdue =
                deal.expected_close_date &&
                deal.expected_close_date < today &&
                deal.status === 'open';

              return (
                <TableRow
                  key={deal.id}
                  className="border-border/60 hover:bg-muted/50 group cursor-pointer transition-colors"
                  onClick={() => onEditDeal(deal)}
                >
                  {/* Deal Title & Details */}
                  <TableCell className="py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground text-sm font-semibold hover:underline">
                          {deal.title}
                        </span>
                        {deal.status === 'won' && (
                          <span className="bg-primary/15 text-primary py-0.2 inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 text-[10px] font-semibold">
                            <Check className="size-2.5" />
                            {tCard('won')}
                          </span>
                        )}
                        {deal.status === 'lost' && (
                          <span className="py-0.2 inline-flex shrink-0 items-center gap-0.5 rounded-full bg-red-500/15 px-1.5 text-[10px] font-semibold text-red-400">
                            <X className="size-2.5" />
                            {tCard('lost')}
                          </span>
                        )}
                      </div>
                      <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                        {contact?.lead_details?.bhk_preference &&
                          contact.lead_details.bhk_preference.length > 0 && (
                            <span className="bg-primary/10 text-primary border-primary/20 rounded border px-1.5 py-0.5 text-[10px] font-semibold">
                              {contact.lead_details.bhk_preference.join(', ')}
                            </span>
                          )}
                        {contact?.lead_details?.location_preference && (
                          <span className="max-w-[160px] truncate">
                            📍 {contact.lead_details.location_preference}
                          </span>
                        )}
                        {deal.status === 'lost' && deal.lost_reason && (
                          <span className="max-w-[140px] truncate text-red-400">
                            · {deal.lost_reason.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Contact / Buyer */}
                  <TableCell
                    className="py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-5 shrink-0">
                          <AvatarFallback
                            className="text-[10px] font-semibold text-white"
                            style={{
                              background: avatarColorForName(contactName),
                            }}
                          >
                            {initialsForName(contactName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-foreground max-w-[130px] truncate text-xs font-medium">
                          {contactName}
                        </span>
                      </div>
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        {contact?.phone && (
                          <span className="truncate font-mono text-[11px]">
                            {contact.phone}
                          </span>
                        )}
                        {contact?.lead_details?.source && (
                          <SourceBadge
                            source={contact.lead_details.source}
                            className="origin-left scale-75"
                          />
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Stage */}
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: stage?.color ?? '#94a3b8' }}
                      />
                      <span className="text-foreground max-w-[120px] truncate text-xs font-medium">
                        {stage?.name ?? '—'}
                      </span>
                    </div>
                  </TableCell>

                  {/* Value & Brokerage */}
                  <TableCell className="py-3">
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="text-primary text-sm font-bold tracking-tight">
                        {defaultCurrency === 'INR'
                          ? formatINR(deal.value)
                          : formatCurrency(deal.value, defaultCurrency)}
                      </span>
                      <BrokerageBadge
                        dealValue={deal.value}
                        brokeragePct={brokeragePct}
                      />
                    </div>
                  </TableCell>

                  {/* Expected Close */}
                  <TableCell className="py-3">
                    {deal.expected_close_date ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar className="text-muted-foreground size-3.5 shrink-0" />
                        <span
                          className={
                            isOverdue
                              ? 'font-medium text-red-500'
                              : 'text-foreground'
                          }
                        >
                          {new Date(
                            deal.expected_close_date
                          ).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        {isOverdue && (
                          <span title={t('overdue')}>
                            <AlertCircle className="size-3 shrink-0 text-red-500" />
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Assignee */}
                  <TableCell className="py-3">
                    {assigneeName ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar className="size-5 shrink-0">
                          <AvatarFallback
                            className="text-[10px] font-semibold text-white"
                            style={{
                              background: avatarColorForName(assigneeName),
                            }}
                          >
                            {initialsForName(assigneeName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-foreground max-w-[100px] truncate text-xs">
                          {assigneeName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs italic">
                        Unassigned
                      </span>
                    )}
                  </TableCell>

                  {/* Quick Inline Actions */}
                  <TableCell
                    className="py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {/* WhatsApp Chat */}
                      {contact && (
                        <Link
                          href={`/inbox?contactId=${contact.id}`}
                          title={tCard('chatWhatsAppTooltip')}
                          className="text-muted-foreground rounded-md p-1.5 transition-colors hover:bg-emerald-500/10 hover:text-emerald-500"
                        >
                          <MessageCircle className="size-3.5" />
                        </Link>
                      )}

                      {/* Phone Call */}
                      {contact?.phone && (
                        <a
                          href={`tel:${contact.phone}`}
                          title={tCard('callTooltip')}
                          className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md p-1.5 transition-colors"
                        >
                          <Phone className="size-3.5" />
                        </a>
                      )}

                      {/* Schedule Visit */}
                      {deal.contact_id && (
                        <button
                          type="button"
                          onClick={() => onScheduleVisit(deal)}
                          title={tCard('scheduleVisitTooltip')}
                          className="text-muted-foreground rounded-md p-1.5 transition-colors hover:bg-blue-500/10 hover:text-blue-500"
                        >
                          <CalendarPlus className="size-3.5" />
                        </button>
                      )}

                      {/* Move Stage (for open deals) */}
                      {deal.status === 'open' && (
                        <button
                          type="button"
                          onClick={() => onMoveDeal(deal)}
                          title={tCard('moveStageTooltip')}
                          className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5 transition-colors"
                        >
                          <ArrowRightLeft className="size-3.5" />
                        </button>
                      )}

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => onEditDeal(deal)}
                        title={tForm('editDeal')}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5 transition-colors"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
