'use client';

/**
 * DealForm
 *
 * Side Sheet for creating and editing deals.
 * Real estate enhancements:
 *  - Contact card showing buyer phone and location preference
 *  - 1-click Schedule Site Visit for the selected buyer
 *  - Live ₹ INR formatting preview and brokerage commission preview
 *  - Supports text budget parsing via parseBudget()
 *  - Status actions: Mark as Won (with 6s undo), Mark as Lost (via LostReasonModal), Reopen
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { canManageMembers } from '@/lib/auth/roles';
import { CURRENCIES, formatCurrency, formatINR } from '@/lib/currency';
import { parseBudget } from '@/lib/contacts/parse-budget';
import {
  getAgentAssignedContactIds,
  buildAgentContactFilter,
} from '@/lib/contacts/agent-scoping';
import { DealFormSchema, type DealFormValues } from '@/lib/schemas/deal';
import type {
  Contact,
  Conversation,
  Deal,
  DealStatus,
  PipelineStage,
  Profile,
} from '@/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Check,
  X,
  Trash2,
  MessageCircle,
  IndianRupee,
  Loader2,
  RotateCcw,
  CalendarPlus,
  Phone,
  Sparkles,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { LostReasonModal } from '@/components/pipelines/lost-reason-modal';

type ExtendedContact = Contact & {
  lead_details?: { location_preference?: string; source?: string } | null;
};

interface DealFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal | null;
  pipelineId: string;
  stages: PipelineStage[];
  defaultStageId?: string;
  onSaved: () => void;
  onScheduleVisit?: (contactId: string) => void;
}

export function DealForm({
  open,
  onOpenChange,
  deal,
  pipelineId,
  stages,
  defaultStageId,
  onSaved,
  onScheduleVisit,
}: DealFormProps) {
  const t = useTranslations('Pipelines.form');
  const supabase = createClient();
  const { accountId, accountRole, profile, user, defaultCurrency } = useAuth();
  const isManager = accountRole ? canManageMembers(accountRole) : false;
  const queryClient = useQueryClient();

  const [brokeragePct, setBrokeragePct] = useState<number | null>(null);
  const [contacts, setContacts] = useState<ExtendedContact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [linkedConversation, setLinkedConversation] =
    useState<Conversation | null>(null);

  const [saving, setSaving] = useState(false);
  const [statusAction, setStatusAction] = useState<DealStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Lost-reason modal state
  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [lostLoading, setLostLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<DealFormValues>({
    resolver: zodResolver(DealFormSchema),
    defaultValues: {
      title: '',
      value: '',
      currency: defaultCurrency,
      contact_id: '',
      stage_id: defaultStageId || stages[0]?.id || '',
      assigned_to: !isManager && profile?.id ? profile.id : '',
      expected_close_date: '',
      notes: '',
    },
  });

  const contactId = useWatch({ control, name: 'contact_id' });
  const rawValue = useWatch({ control, name: 'value' });
  const currencyWatch = useWatch({ control, name: 'currency' });
  const currency = currencyWatch || defaultCurrency;
  const title = useWatch({ control, name: 'title' });
  const stageId = useWatch({ control, name: 'stage_id' });

  // Reset the form fields every time the sheet opens or its input props change
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setConfirmDelete(false);
    }, 0);
    if (deal) {
      reset({
        title: deal.title,
        value: deal.value != null ? String(deal.value) : '',
        currency: deal.currency || defaultCurrency,
        contact_id: deal.contact_id ?? '',
        stage_id: deal.stage_id,
        assigned_to: deal.assigned_to ?? '',
        expected_close_date: deal.expected_close_date ?? '',
        notes: deal.notes ?? '',
      });
    } else {
      reset({
        title: '',
        value: '',
        currency: defaultCurrency,
        contact_id: '',
        stage_id: defaultStageId || stages[0]?.id || '',
        assigned_to: !isManager && profile?.id ? profile.id : '',
        expected_close_date: '',
        notes: '',
      });
    }
    return () => clearTimeout(timer);
  }, [
    open,
    deal,
    defaultStageId,
    stages,
    defaultCurrency,
    isManager,
    profile?.id,
    reset,
  ]);

  // Load account settings (brokerage %)
  useEffect(() => {
    if (!accountId) return;
    const timer = setTimeout(() => {
      void (async () => {
        const { data: accountRow } = await supabase
          .from('accounts')
          .select('settings')
          .eq('id', accountId)
          .single();
        const pct =
          ((accountRow?.settings as Record<string, unknown> | null)
            ?.brokerage_pct as number | null) ?? 2;
        setBrokeragePct(pct);
      })();
    }, 0);
    return () => clearTimeout(timer);
  }, [accountId, supabase]);

  // Load supporting data once the sheet is open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        let contactsPromise;
        if (!isManager && user?.id) {
          const assignedContactIds = await getAgentAssignedContactIds(
            supabase,
            user.id,
            profile?.id
          );
          const targetContactIds = Array.from(
            new Set([
              ...assignedContactIds,
              ...(deal?.contact_id ? [deal.contact_id] : []),
            ])
          );
          const filter = buildAgentContactFilter(
            user.id,
            profile?.id,
            targetContactIds
          );
          contactsPromise = supabase
            .from('contacts')
            .select('*, lead_details(*)')
            .or(filter)
            .order('name');
        } else {
          contactsPromise = supabase
            .from('contacts')
            .select('*, lead_details(*)')
            .order('name');
        }

        const [c, p] = await Promise.all([
          contactsPromise,
          supabase.from('profiles').select('*').order('full_name'),
        ]);
        if (cancelled) return;
        setContacts((c.data ?? []) as ExtendedContact[]);
        setProfiles((p.data ?? []) as Profile[]);
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, supabase, isManager, user, profile, deal?.contact_id]);

  // Fetch linked conversation for the selected contact
  useEffect(() => {
    if (!open || !contactId) {
      const timer = setTimeout(() => {
        setLinkedConversation(null);
      }, 0);
      return () => clearTimeout(timer);
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const { data } = await supabase
          .from('conversations')
          .select('*')
          .eq('contact_id', contactId)
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        setLinkedConversation((data as Conversation | null) ?? null);
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, contactId, supabase]);

  const selectedContact = contacts.find((c) => c.id === contactId);

  // Parse budget / value for live preview
  const parsedNumericVal = (() => {
    const strVal = rawValue != null ? String(rawValue).trim() : '';
    if (!strVal) return 0;
    const b = parseBudget(strVal);
    if (b !== null && !isNaN(b)) return b;
    const f = parseFloat(strVal);
    return isNaN(f) ? 0 : f;
  })();

  const estimatedBrokerage =
    parsedNumericVal > 0 && brokeragePct && brokeragePct > 0
      ? Math.round((parsedNumericVal * brokeragePct) / 100)
      : null;

  function handleSuccessSaved() {
    onOpenChange(false);
    onSaved();
    void queryClient.invalidateQueries({ queryKey: ['contacts'] });
  }

  async function onFormSubmit(data: DealFormValues) {
    // Anti-poaching guard: agents can only create/update deals for their assigned leads
    if (!isManager && !contacts.some((c) => c.id === data.contact_id)) {
      toast.error(t('toastFailedSave'));
      return;
    }
    setSaving(true);

    const strVal = data.value != null ? String(data.value).trim() : '';
    let numericVal = 0;
    if (strVal) {
      const b = parseBudget(strVal);
      if (b !== null && !isNaN(b)) {
        numericVal = b;
      } else {
        const f = parseFloat(strVal);
        numericVal = isNaN(f) ? 0 : f;
      }
    }

    const payload = {
      title: data.title.trim(),
      value: numericVal,
      currency: data.currency,
      contact_id: data.contact_id,
      pipeline_id: pipelineId,
      stage_id: data.stage_id,
      assigned_to: data.assigned_to || null,
      notes: data.notes?.trim() || null,
      expected_close_date: data.expected_close_date || null,
    };

    if (deal) {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.error === 'DEAL_NOT_YOURS') {
          toast.error(body.message);
        } else {
          toast.error(t('toastFailedSave'));
        }
        setSaving(false);
        return;
      }
    } else {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userObj = session?.user;
      if (!userObj) {
        toast.error(t('toastNotSignedIn'));
        setSaving(false);
        return;
      }
      if (!accountId) {
        toast.error(t('toastNotLinked'));
        setSaving(false);
        return;
      }
      const { error } = await supabase.from('deals').insert({
        ...payload,
        user_id: userObj.id,
        account_id: accountId,
        status: 'open',
        last_activity_at: new Date().toISOString(),
      });
      if (error) {
        toast.error(t('toastFailedCreate'));
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    toast.success(deal ? t('toastUpdated') : t('toastCreated'));
    handleSuccessSaved();
  }

  async function handleMarkWon() {
    if (!deal) return;
    setStatusAction('won');

    const res = await fetch(`/api/deals/${deal.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'won' }),
      headers: { 'Content-Type': 'application/json' },
    });
    setStatusAction(null);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(
        body.error === 'DEAL_NOT_YOURS' ? body.message : t('toastFailedStatus')
      );
      return;
    }

    handleSuccessSaved();

    toast.success(t('toastMarkedWon'), {
      duration: 6000,
      action: {
        label: t('undo'),
        onClick: () => void handleReopen(deal.id),
      },
    });
  }

  function handleMarkLostClick() {
    setLostModalOpen(true);
  }

  async function handleLostConfirmed(payload: {
    lost_reason_id: string;
    lost_note?: string;
    re_engage_on?: string;
  }) {
    if (!deal) return;
    setLostLoading(true);

    // Ensure re_engage_on is date-only (YYYY-MM-DD) — DB column is DATE type, not TIMESTAMPTZ.
    // datetime-local inputs produce "YYYY-MM-DDTHH:mm" which Postgres rejects.
    const safePayload = {
      ...payload,
      re_engage_on: payload.re_engage_on
        ? payload.re_engage_on.slice(0, 10)
        : undefined,
    };

    const res = await fetch(`/api/deals/${deal.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'lost', ...safePayload }),
      headers: { 'Content-Type': 'application/json' },
    });
    setLostLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(
        body.error === 'DEAL_NOT_YOURS' ? body.message : t('toastFailedStatus')
      );
      return;
    }

    setLostModalOpen(false);
    handleSuccessSaved();

    toast.success(t('toastMarkedLost'), {
      duration: 6000,
      action: {
        label: t('undo'),
        onClick: () => void handleReopen(deal.id),
      },
    });
  }

  async function handleReopen(dealId?: string) {
    const id = dealId ?? deal?.id;
    if (!id) return;
    setStatusAction('open');
    const res = await fetch(`/api/deals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'open' }),
      headers: { 'Content-Type': 'application/json' },
    });
    setStatusAction(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(
        body.error === 'DEAL_NOT_YOURS' ? body.message : t('toastFailedStatus')
      );
      return;
    }
    toast.success(t('toastReopened'));
    handleSuccessSaved();
  }

  async function handleDelete() {
    if (!deal) return;
    setDeleting(true);
    const { error } = await supabase.from('deals').delete().eq('id', deal.id);
    setDeleting(false);
    if (error) {
      toast.error(t('toastFailedDelete'));
      return;
    }
    toast.success(t('toastDeleted'));
    setConfirmDelete(false);
    handleSuccessSaved();
  }

  const isClosed = deal?.status && deal.status !== 'open';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="bg-popover border-border text-popover-foreground w-full p-0 sm:max-w-lg"
        >
          <form
            onSubmit={handleSubmit(onFormSubmit)}
            className="flex h-full flex-col"
          >
            <SheetHeader className="border-border/50 border-b p-4">
              <SheetTitle className="text-popover-foreground">
                {deal ? t('editDeal') : t('newDeal')}
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {/* Status banner for closed deals */}
              {isClosed && (
                <div
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    deal?.status === 'won'
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-red-500/30 bg-red-500/10 text-red-400'
                  }`}
                >
                  {deal?.status === 'won' ? (
                    <span className="flex items-center gap-1.5">
                      <Check className="h-4 w-4" />
                      {t('bannerWon')}
                    </span>
                  ) : (
                    <span className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1.5">
                        <X className="h-4 w-4" />
                        {t('bannerLost')}
                      </span>
                      {deal?.lost_reason?.label && (
                        <span className="text-xs opacity-80">
                          {t('bannerLostReason', {
                            reason: deal.lost_reason.label,
                          })}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              )}

              {/* Title */}
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t('title')}</Label>
                <Input
                  {...register('title')}
                  placeholder={t('titlePlaceholder')}
                  className="border-border bg-muted text-foreground"
                />
                {errors.title && (
                  <p className="text-destructive text-[11px]">
                    {errors.title.message}
                  </p>
                )}
              </div>

              {/* Contact */}
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t('contact')}</Label>
                <select
                  {...register('contact_id')}
                  className="border-border bg-muted text-foreground focus:border-primary focus:ring-primary h-9 w-full rounded-lg border px-2.5 text-sm outline-none focus:ring-1"
                >
                  <option value="">{t('selectContact')}</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.phone}
                    </option>
                  ))}
                </select>
                {errors.contact_id && (
                  <p className="text-destructive text-[11px]">
                    {errors.contact_id.message}
                  </p>
                )}

                {/* Selected Contact Card with 1-click actions */}
                {selectedContact && (
                  <div className="bg-muted/40 border-border/70 mt-1 flex flex-col gap-1.5 rounded-lg border p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground font-semibold">
                        {selectedContact.name || selectedContact.phone}
                      </span>
                      {selectedContact.phone && (
                        <a
                          href={`tel:${selectedContact.phone}`}
                          className="text-primary inline-flex items-center gap-1 font-mono text-[11px] hover:underline"
                        >
                          <Phone className="size-3" />
                          {selectedContact.phone}
                        </a>
                      )}
                    </div>
                    {selectedContact.lead_details?.location_preference && (
                      <span className="text-muted-foreground text-[11px]">
                        📍 {t('buyerLocation')}:{' '}
                        {selectedContact.lead_details.location_preference}
                      </span>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {linkedConversation && (
                        <Link
                          href={`/inbox?contactId=${contactId}`}
                          className="bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium"
                        >
                          <MessageCircle className="size-3" />
                          {t('linkToConversation')}
                        </Link>
                      )}
                      {onScheduleVisit && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onScheduleVisit(contactId)}
                          className="border-border h-7 gap-1 text-xs"
                        >
                          <CalendarPlus className="text-primary size-3" />
                          {t('scheduleVisitForBuyer')}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Value with Live INR and Brokerage Preview */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-[1fr_110px] gap-3">
                  <div className="grid gap-2">
                    <Label className="text-muted-foreground">
                      {t('value')}
                    </Label>
                    <div className="relative">
                      <IndianRupee className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                      <Input
                        type="text"
                        {...register('value')}
                        placeholder="e.g. 1.5 Cr or 8500000"
                        className="border-border bg-muted text-foreground pl-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-muted-foreground">
                      {t('currency')}
                    </Label>
                    <select
                      {...register('currency')}
                      className="border-border bg-muted text-foreground focus:border-primary h-9 w-full rounded-lg border px-2.5 text-sm outline-none"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Live Preview Chips */}
                {parsedNumericVal > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold">
                      <Sparkles className="size-3" />
                      {t('livePreview')}:{' '}
                      {currency === 'INR'
                        ? formatINR(parsedNumericVal)
                        : formatCurrency(parsedNumericVal, currency)}
                    </span>
                    {estimatedBrokerage !== null && (
                      <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400">
                        {t('estBrokerage', {
                          pct: brokeragePct ?? 2,
                          amount:
                            currency === 'INR'
                              ? formatINR(estimatedBrokerage)
                              : formatCurrency(estimatedBrokerage, currency),
                        })}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Expected Close Date */}
              <div className="grid gap-2">
                <Label className="text-muted-foreground">
                  {t('expectedCloseDate')}
                </Label>
                <Input
                  type="date"
                  {...register('expected_close_date')}
                  className="border-border bg-muted text-foreground"
                />
              </div>

              {/* Stage */}
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t('stage')}</Label>
                <select
                  {...register('stage_id')}
                  className="border-border bg-muted text-foreground focus:border-primary h-9 w-full rounded-lg border px-2.5 text-sm outline-none"
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {errors.stage_id && (
                  <p className="text-destructive text-[11px]">
                    {errors.stage_id.message}
                  </p>
                )}
              </div>

              {/* Assigned To */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground">
                    {t('assignedTo')}
                  </Label>
                  {!isManager && (
                    <span className="text-muted-foreground/80 flex items-center gap-1 text-[11px] font-medium">
                      <Lock className="size-3" />
                      {t('reassignManagerOnly')}
                    </span>
                  )}
                </div>
                <select
                  disabled={!isManager}
                  {...register('assigned_to')}
                  className="border-border bg-muted text-foreground focus:border-primary h-9 w-full rounded-lg border px-2.5 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-75"
                >
                  <option value="">{t('unassigned')}</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || p.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t('notes')}</Label>
                <Textarea
                  {...register('notes')}
                  placeholder={t('notesPlaceholder')}
                  className="border-border bg-muted text-foreground min-h-[90px]"
                />
              </div>

              {/* Status actions — only for existing open deals */}
              {deal && deal.status === 'open' && (
                <div className="border-border bg-muted/50 space-y-2 rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    {t('status')}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={handleMarkWon}
                      disabled={!!statusAction}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 disabled:opacity-50"
                    >
                      {statusAction === 'won' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="mr-1 h-4 w-4" />
                          {t('markAsWon')}
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleMarkLostClick}
                      disabled={!!statusAction}
                      className="flex-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      <>
                        <X className="mr-1 h-4 w-4" />
                        {t('markAsLost')}
                      </>
                    </Button>
                  </div>
                </div>
              )}

              {/* Reopen button — only for closed deals */}
              {deal && isClosed && (
                <div className="border-border bg-muted/50 rounded-lg border p-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleReopen()}
                    disabled={!!statusAction}
                    className="text-muted-foreground hover:text-foreground w-full"
                  >
                    {statusAction === 'open' ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-1 h-4 w-4" />
                    )}
                    {t('reopenDeal')}
                  </Button>
                </div>
              )}
            </div>

            {/* Sheet Footer */}
            <div className="border-border/50 bg-popover/80 border-t p-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="border-border text-muted-foreground hover:bg-muted flex-1 bg-transparent"
                >
                  {t('cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={saving || !title?.trim() || !contactId || !stageId}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1"
                >
                  {saving
                    ? t('saving')
                    : deal
                      ? t('saveChanges')
                      : t('createDeal')}
                </Button>
              </div>

              {deal &&
                (confirmDelete ? (
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs">
                    <span className="text-red-300">{t('deletePrompt')}</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        disabled={deleting}
                        className="text-muted-foreground hover:bg-muted rounded px-2 py-1"
                      >
                        {t('cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {deleting ? t('deleting') : t('confirm')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-3 w-3" />
                    {t('deleteDeal')}
                  </button>
                ))}
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Lost reason modal */}
      <LostReasonModal
        open={lostModalOpen}
        onOpenChange={setLostModalOpen}
        onConfirm={handleLostConfirmed}
        loading={lostLoading}
      />
    </>
  );
}
