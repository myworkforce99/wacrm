'use client';

/**
 * ScheduleVisitSheet
 *
 * A modern right-side Sheet (desktop) / bottom Sheet (mobile) for creating or
 * editing a real-estate site visit:
 *
 *  - Contact search & selection: Clean selected lead card with avatar & phone,
 *    live search list when picking a lead.
 *  - Property context: Rich Base-UI Select with Price (INR), Configuration (BHK),
 *    Location, and selected Property Preview card.
 *  - Quick datetime presets: 1-tap buttons for "Today 4 PM", "Tomorrow 11 AM",
 *    "Tomorrow 4 PM", "This Sat 11 AM", "This Sun 11 AM" + native datetime picker.
 *  - Assigned agent data wiring: Fully synchronized with `tasks` table so the
 *    assigned agent receives an actionable task with due date & notification.
 *  - Status: Amber (Pending) vs Emerald (Confirmed) visual toggle.
 *  - Pickup logistics: Clean toggle with landmark/location input.
 *  - Full 4-locale i18n parity, responsive mobile & desktop UX.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { avatarColorForName, initialsForName } from '@/lib/avatar-color';
import { formatINR } from '@/lib/currency';
import type { Contact, Property, Profile, SiteVisit } from '@/types';
import {
  Loader2,
  Search,
  MapPin,
  User,
  Calendar,
  Building2,
  Check,
  Clock,
  Car,
  Sparkles,
} from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** When provided, the sheet runs in edit mode. */
  visit?: SiteVisit;
  /** Pre-selected contact ID when scheduling a visit for a specific lead */
  defaultContactId?: string;
  /** Pre-selected property ID when scheduling a visit for a specific property */
  defaultPropertyId?: string;
}

type PresetKey =
  'today4pm' | 'tomorrow11am' | 'tomorrow4pm' | 'thisSat11am' | 'thisSun11am';

function getPresetDatetime(preset: PresetKey): string {
  const d = new Date();
  if (preset === 'today4pm') {
    d.setHours(16, 0, 0, 0);
    if (d.getTime() < Date.now()) {
      d.setDate(d.getDate() + 1);
    }
  } else if (preset === 'tomorrow11am') {
    d.setDate(d.getDate() + 1);
    d.setHours(11, 0, 0, 0);
  } else if (preset === 'tomorrow4pm') {
    d.setDate(d.getDate() + 1);
    d.setHours(16, 0, 0, 0);
  } else if (preset === 'thisSat11am') {
    const day = d.getDay(); // 0 is Sun, 6 is Sat
    const daysUntilSat = (6 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilSat);
    d.setHours(11, 0, 0, 0);
  } else if (preset === 'thisSun11am') {
    const day = d.getDay();
    const daysUntilSun = (7 - day) % 7 || 7;
    d.setDate(d.getDate() + daysUntilSun);
    d.setHours(11, 0, 0, 0);
  }
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export function ScheduleVisitSheet({
  open,
  onOpenChange,
  onSuccess,
  visit,
  defaultContactId,
  defaultPropertyId,
}: Props) {
  const t = useTranslations('SiteVisits.schedule');
  const supabase = createClient();
  const { accountId, user } = useAuth();

  // Reference data
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [isChangingContact, setIsChangingContact] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [assignedAgentId, setAssignedAgentId] = useState('');
  const [scheduledAt, setScheduledAt] = useState(''); // datetime-local string
  const [status, setStatus] = useState<'pending' | 'confirmed'>('pending');
  const [notes, setNotes] = useState('');
  const [pickupRequired, setPickupRequired] = useState(false);
  const [pickupLocation, setPickupLocation] = useState('');

  const isEditMode = !!visit;

  const loadFormData = useCallback(async () => {
    setLoading(true);
    const [
      { data: contactsData },
      { data: propsData },
      { data: profilesData },
    ] = await Promise.all([
      supabase.from('contacts').select('id, name, phone').order('name'),
      supabase
        .from('properties')
        .select('id, title, location, configuration, bedrooms, price')
        .order('title'),
      supabase
        .from('profiles')
        .select('id, user_id, full_name, email')
        .order('full_name'),
    ]);

    setContacts((contactsData ?? []) as Contact[]);
    setProperties((propsData ?? []) as Property[]);
    setProfiles((profilesData ?? []) as Profile[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      loadFormData();

      // Pre-fill from visit prop (edit mode) or reset (create mode)
      if (visit) {
        setSelectedContactId(visit.contact_id ?? '');
        setSelectedPropertyId(visit.property_id ?? '');
        setIsChangingContact(false);

        // Convert stored TIMESTAMPTZ -> datetime-local (local ISO slice)
        if (visit.scheduled_at) {
          const d = new Date(visit.scheduled_at);
          const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setScheduledAt(local);
        } else {
          setScheduledAt('');
        }

        setStatus(visit.status === 'confirmed' ? 'confirmed' : 'pending');
        setNotes(visit.notes ?? '');
        setPickupRequired(visit.pickup_required ?? false);
        setPickupLocation(visit.pickup_location ?? '');

        // Fetch assigned task to pre-fill assignedAgentId
        supabase
          .from('tasks')
          .select('assigned_to')
          .eq('site_visit_id', visit.id)
          .maybeSingle()
          .then(({ data: taskData }) => {
            if (taskData?.assigned_to) {
              setAssignedAgentId(taskData.assigned_to);
            } else {
              setAssignedAgentId('');
            }
          });
      } else {
        setContactSearch('');
        setSelectedContactId(defaultContactId ?? '');
        setIsChangingContact(false);
        setSelectedPropertyId(defaultPropertyId ?? '');
        setAssignedAgentId('');
        setScheduledAt(getPresetDatetime('tomorrow11am'));
        setStatus('pending');
        setNotes('');
        setPickupRequired(false);
        setPickupLocation('');
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [
    open,
    visit,
    defaultContactId,
    defaultPropertyId,
    loadFormData,
    supabase,
  ]);

  // Live-filtered contact list
  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts.slice(0, 15);
    const q = contactSearch.toLowerCase();
    return contacts
      .filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [contacts, contactSearch]);

  const selectedContact = contacts.find((c) => c.id === selectedContactId);
  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedContactId || !scheduledAt) return;
    if (!accountId) {
      toast.error(t('toastError'));
      return;
    }

    setSaving(true);
    const scheduledAtISO = new Date(scheduledAt).toISOString();

    const payload = {
      contact_id: selectedContactId,
      property_id: selectedPropertyId || null,
      scheduled_at: scheduledAtISO,
      status,
      notes: notes.trim() || null,
      pickup_required: pickupRequired,
      pickup_location: pickupRequired ? pickupLocation.trim() || null : null,
    };

    let visitId = visit?.id;

    if (isEditMode && visit) {
      const { error } = await supabase
        .from('site_visits')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', visit.id);
      if (error) {
        setSaving(false);
        toast.error(t('toastError'));
        return;
      }
    } else {
      const { data: newVisit, error } = await supabase
        .from('site_visits')
        .insert({
          ...payload,
          account_id: accountId,
        })
        .select('id')
        .single();

      if (error) {
        setSaving(false);
        toast.error(t('toastError'));
        return;
      }
      visitId = newVisit.id;
    }

    // Synchronize assigned agent in `tasks` table
    if (visitId) {
      try {
        const { data: currentTask } = await supabase
          .from('tasks')
          .select('id')
          .eq('site_visit_id', visitId)
          .maybeSingle();

        const taskTitle = `Site Visit: ${selectedProperty?.title || selectedContact?.name || 'Property Showing'}`;

        if (assignedAgentId) {
          if (currentTask) {
            await supabase
              .from('tasks')
              .update({
                assigned_to: assignedAgentId,
                due_at: scheduledAtISO,
                title: taskTitle,
                contact_id: selectedContactId,
                updated_at: new Date().toISOString(),
              })
              .eq('id', currentTask.id);
          } else {
            await supabase.from('tasks').insert({
              account_id: accountId,
              contact_id: selectedContactId,
              site_visit_id: visitId,
              title: taskTitle,
              due_at: scheduledAtISO,
              assigned_to: assignedAgentId,
              created_by: user?.id,
            });
          }
        } else if (currentTask) {
          await supabase
            .from('tasks')
            .update({
              assigned_to: null,
              due_at: scheduledAtISO,
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentTask.id);
        }
      } catch (err) {
        console.error('Failed to sync site visit task:', err);
      }
    }

    setSaving(false);
    toast.success(isEditMode ? t('toastUpdated') : t('toastSuccess'));
    onSuccess();
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-popover border-border flex w-full max-w-lg flex-col p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-border/50 border-b px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
              <Calendar className="size-5" />
            </div>
            <div>
              <SheetTitle className="text-popover-foreground text-base font-semibold">
                {isEditMode ? t('editTitle') : t('title')}
              </SheetTitle>
              <SheetDescription className="text-muted-foreground text-xs">
                {t('desc')}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="text-primary size-6 animate-spin" />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              {/* ── Contact / Lead ── */}
              <div className="space-y-2">
                <Label className="text-muted-foreground flex items-center justify-between text-xs font-semibold tracking-wide uppercase">
                  <span className="flex items-center gap-1.5">
                    <User className="size-3.5" />
                    {t('contactLabel')}
                    <span className="text-destructive">*</span>
                  </span>
                  {selectedContact && !isChangingContact && !isEditMode && (
                    <button
                      type="button"
                      onClick={() => setIsChangingContact(true)}
                      className="text-primary cursor-pointer text-xs font-medium lowercase first-letter:uppercase hover:underline"
                    >
                      {t('changeContact')}
                    </button>
                  )}
                </Label>

                {selectedContact && !isChangingContact ? (
                  <div className="border-border/80 bg-muted/40 flex items-center justify-between rounded-xl border p-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback
                          className="text-xs font-semibold text-white"
                          style={{
                            background: avatarColorForName(
                              selectedContact.name
                            ),
                          }}
                        >
                          {initialsForName(selectedContact.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-sm font-semibold">
                          {selectedContact.name || selectedContact.phone}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {selectedContact.phone}
                        </p>
                      </div>
                    </div>
                    <span className="text-primary bg-primary/10 rounded-full px-2 py-0.5 text-[11px] font-medium">
                      ✓ {t('selectedLead')}
                    </span>
                  </div>
                ) : (
                  <div className="border-border space-y-2 rounded-xl border p-3">
                    <div className="relative">
                      <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                      <Input
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        placeholder={t('contactSearch')}
                        className="border-border bg-muted/60 text-foreground pl-8 text-xs"
                      />
                    </div>
                    <div className="max-h-40 space-y-1 overflow-y-auto">
                      {filteredContacts.length === 0 ? (
                        <p className="text-muted-foreground py-3 text-center text-xs">
                          {t('contactPlaceholder')}
                        </p>
                      ) : (
                        filteredContacts.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedContactId(c.id);
                              setIsChangingContact(false);
                            }}
                            className={`hover:bg-muted flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                              selectedContactId === c.id
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-foreground'
                            }`}
                          >
                            <span className="truncate">
                              {c.name ? `${c.name} · ${c.phone}` : c.phone}
                            </span>
                            {selectedContactId === c.id && (
                              <Check className="size-3.5" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Property ── */}
              <div className="space-y-2">
                <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                  <Building2 className="size-3.5" />
                  {t('propertyLabel')}
                </Label>

                <Select
                  value={selectedPropertyId || 'none'}
                  onValueChange={(val) =>
                    setSelectedPropertyId(val === 'none' ? '' : (val ?? ''))
                  }
                >
                  <SelectTrigger className="border-border bg-muted/40 text-foreground h-9 w-full text-xs">
                    <SelectValue placeholder={t('propertyPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="none">
                      {t('propertyPlaceholder')}
                    </SelectItem>
                    {properties.map((p) => {
                      const detail = [
                        p.configuration ||
                          (p.bedrooms ? `${p.bedrooms} BHK` : null),
                        p.location,
                        p.price ? formatINR(p.price) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ');
                      return (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="font-medium">{p.title}</span>
                          {detail && (
                            <span className="text-muted-foreground ml-1.5 text-[11px]">
                              ({detail})
                            </span>
                          )}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {selectedProperty && (
                  <div className="border-border/60 bg-muted/30 flex items-center justify-between rounded-lg border p-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <MapPin className="text-primary size-3.5 shrink-0" />
                      <span className="text-foreground font-medium">
                        {selectedProperty.location || 'Location TBD'}
                      </span>
                      {selectedProperty.configuration && (
                        <span className="text-muted-foreground bg-card border-border py-0.2 rounded border px-1.5 text-[10px]">
                          {selectedProperty.configuration}
                        </span>
                      )}
                    </div>
                    {selectedProperty.price && (
                      <span className="bg-primary/10 text-primary rounded px-2 py-0.5 text-xs font-bold">
                        {formatINR(selectedProperty.price)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* ── Date & Time with Quick Presets ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                    <Clock className="size-3.5" />
                    {t('dateTimeLabel')}
                    <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                    <Sparkles className="text-primary size-3" />
                    {t('quickPresets')}
                  </span>
                </div>

                {/* Quick Presets Pills */}
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {(
                    [
                      'today4pm',
                      'tomorrow11am',
                      'tomorrow4pm',
                      'thisSat11am',
                      'thisSun11am',
                    ] as const
                  ).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setScheduledAt(getPresetDatetime(preset))}
                      className="border-border hover:border-primary/50 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
                    >
                      {t(preset)}
                    </button>
                  ))}
                </div>

                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  required
                  className="border-border bg-muted/40 text-foreground h-9 text-xs"
                />
              </div>

              {/* ── Assigned Agent ── */}
              <div className="space-y-2">
                <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                  <User className="size-3.5" />
                  {t('agentLabel')}
                </Label>
                <Select
                  value={assignedAgentId || 'none'}
                  onValueChange={(val) =>
                    setAssignedAgentId(val === 'none' ? '' : (val ?? ''))
                  }
                >
                  <SelectTrigger className="border-border bg-muted/40 text-foreground h-9 w-full text-xs">
                    <SelectValue placeholder={t('agentPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t('agentPlaceholder')}
                    </SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.user_id}>
                        {p.full_name || p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ── Status on create or edit ── */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {t('statusLabel')}
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['pending', 'confirmed'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                        status === s
                          ? s === 'confirmed'
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'border-amber-400 bg-amber-400/10 text-amber-600 dark:text-amber-400'
                          : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {status === s && <Check className="size-3.5" />}
                      {s === 'pending'
                        ? t('statusPending')
                        : t('statusConfirmed')}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Pickup Logistics ── */}
              <div className="border-border/80 bg-muted/30 rounded-xl border p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
                      <Car className="size-4" />
                    </div>
                    <div>
                      <p className="text-foreground text-xs font-semibold">
                        {t('pickupLabel')}
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        {t('pickupHint')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={pickupRequired}
                    onCheckedChange={setPickupRequired}
                  />
                </div>

                {pickupRequired && (
                  <div className="border-border/60 mt-3 space-y-1.5 border-t pt-3">
                    <Label className="text-muted-foreground flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase">
                      <MapPin className="size-3" />
                      {t('pickupAddressLabel')}
                    </Label>
                    <Textarea
                      placeholder={t('pickupAddressPlaceholder')}
                      value={pickupLocation}
                      onChange={(e) => setPickupLocation(e.target.value)}
                      className="border-border bg-background text-foreground min-h-[64px] resize-none text-xs"
                    />
                  </div>
                )}
              </div>

              {/* ── Notes ── */}
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {t('notesLabel')}
                </Label>
                <Textarea
                  placeholder={t('notesPlaceholder')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="border-border bg-muted/40 text-foreground min-h-[72px] resize-none text-xs"
                />
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="border-border/50 bg-popover border-t px-5 py-4">
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="border-border text-muted-foreground hover:bg-muted flex-1 text-xs"
                >
                  {t('cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={!selectedContactId || !scheduledAt || saving}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 text-xs font-semibold"
                >
                  {saving && <Loader2 className="mr-2 size-3.5 animate-spin" />}
                  {isEditMode ? t('saveChanges') : t('schedule')}
                </Button>
              </div>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
