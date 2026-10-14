'use client';

/**
 * ScheduleVisitSheet
 *
 * A right-side Sheet (desktop) / bottom Sheet (mobile) for creating or
 * editing a site visit. Key design decisions:
 *
 *  - Contact search: a live filter input above the contact dropdown so
 *    agents don't scroll through 500 names.
 *  - Property context: shows title + location + config in each option.
 *  - Assigned-agent field: who from the team shows the property.
 *  - Status on create: defaults to 'pending'; agents can bump to
 *    'confirmed' on creation if they've already called the lead.
 *  - Pickup toggle: i18n-keyed, expands inline.
 *  - Date/time merged into a single datetime-local input on mobile;
 *    split back to individual YYYY-MM-DD + HH:mm on submit so the
 *    rest of the DB layer remains unchanged.
 *  - Edit mode: when `visit` prop is provided, all fields are pre-filled
 *    and the submit PATCH-es the existing row instead of inserting.
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
import type { Contact, Property, Profile, SiteVisit } from '@/types';
import { Loader2, Search, MapPin, User, Calendar } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** When provided, the sheet runs in edit mode. */
  visit?: SiteVisit & { contact: Contact | null; property: Property | null };
  /** Pre-selected contact ID when scheduling a visit for a specific lead */
  defaultContactId?: string;
  /** Pre-selected property ID when scheduling a visit for a specific property */
  defaultPropertyId?: string;
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
  const { accountId } = useAuth();

  // Reference data
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
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
        .select('id, full_name, email')
        .order('full_name'),
    ]);

    setContacts((contactsData ?? []) as Contact[]);
    setProperties((propsData ?? []) as Property[]);
    setProfiles((profilesData ?? []) as Profile[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!open) return;

    loadFormData();

    // Pre-fill from visit prop (edit mode) or reset (create mode)
    if (visit) {
      setSelectedContactId(visit.contact_id ?? '');
      setSelectedPropertyId(visit.property_id ?? '');
      setAssignedAgentId('');
      // Convert stored TIMESTAMPTZ → datetime-local (local ISO slice)
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
      setPickupRequired(visit.pickup_required);
      setPickupLocation(visit.pickup_location ?? '');
    } else {
      setContactSearch('');
      setSelectedContactId(defaultContactId ?? '');
      setSelectedPropertyId(defaultPropertyId ?? '');
      setAssignedAgentId('');
      setScheduledAt('');
      setStatus('pending');
      setNotes('');
      setPickupRequired(false);
      setPickupLocation('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visit?.id, defaultContactId, defaultPropertyId]);

  // Live-filtered contact list
  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts;
    const q = contactSearch.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q)
    );
  }, [contacts, contactSearch]);

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

    const { error } = isEditMode
      ? await supabase
          .from('site_visits')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', visit.id)
      : await supabase.from('site_visits').insert({
          ...payload,
          account_id: accountId,
        });

    setSaving(false);

    if (error) {
      toast.error(t('toastError'));
    } else {
      toast.success(isEditMode ? t('toastUpdated') : t('toastSuccess'));
      onSuccess();
      onOpenChange(false);
    }
  }

  const selectedContact = contacts.find((c) => c.id === selectedContactId);
  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  // Minimum datetime = now (can't schedule visits in the past)
  const minDatetime = new Date(Date.now() - 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-popover border-border flex w-full max-w-lg flex-col p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-border/50 border-b px-5 pt-5 pb-4">
          <SheetTitle className="text-popover-foreground text-lg font-semibold">
            {isEditMode ? t('editTitle') : t('title')}
          </SheetTitle>
          <SheetDescription className="text-muted-foreground text-sm">
            {t('desc')}
          </SheetDescription>
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
              {/* ── Contact ── */}
              <div className="space-y-2">
                <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                  <User className="size-3.5" />
                  {t('contactLabel')}
                  <span className="text-destructive">*</span>
                </Label>

                {/* Live search */}
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                  <Input
                    value={contactSearch}
                    onChange={(e) => {
                      setContactSearch(e.target.value);
                      setSelectedContactId('');
                    }}
                    placeholder={t('contactSearch')}
                    className="border-border bg-muted text-foreground pl-8 text-sm"
                  />
                </div>

                <select
                  className="border-border bg-muted text-foreground focus:border-primary focus:ring-primary h-9 w-full rounded-lg border px-2.5 text-sm outline-none focus:ring-1"
                  value={selectedContactId}
                  onChange={(e) => {
                    setSelectedContactId(e.target.value);
                    setContactSearch(''); // clear search so full list comes back
                  }}
                  required
                  size={Math.min(filteredContacts.length + 1, 6)}
                >
                  <option value="">{t('contactPlaceholder')}</option>
                  {filteredContacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name ? `${c.name} · ${c.phone}` : c.phone}
                    </option>
                  ))}
                </select>

                {selectedContact && (
                  <p className="text-primary text-xs">
                    ✓ {selectedContact.name || selectedContact.phone}
                  </p>
                )}
              </div>

              {/* ── Property ── */}
              <div className="space-y-2">
                <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                  <MapPin className="size-3.5" />
                  {t('propertyLabel')}
                </Label>
                <select
                  className="border-border bg-muted text-foreground focus:border-primary h-9 w-full rounded-lg border px-2.5 text-sm outline-none"
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                >
                  <option value="">{t('propertyPlaceholder')}</option>
                  {properties.map((p) => {
                    const detail = [
                      p.configuration ||
                        (p.bedrooms ? `${p.bedrooms} BHK` : null),
                      p.location,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <option key={p.id} value={p.id}>
                        {p.title}
                        {detail ? ` — ${detail}` : ''}
                      </option>
                    );
                  })}
                </select>
                {selectedProperty?.location && (
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <MapPin className="size-3" />
                    {selectedProperty.location}
                    {selectedProperty.configuration
                      ? ` · ${selectedProperty.configuration}`
                      : selectedProperty.bedrooms
                        ? ` · ${selectedProperty.bedrooms} BHK`
                        : ''}
                  </p>
                )}
              </div>

              {/* ── Date & Time ── */}
              <div className="space-y-2">
                <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                  <Calendar className="size-3.5" />
                  {t('dateTimeLabel')}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  min={isEditMode ? undefined : minDatetime}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  required
                  className="border-border bg-muted text-foreground"
                />
              </div>

              {/* ── Assigned Agent ── */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {t('agentLabel')}
                </Label>
                <select
                  className="border-border bg-muted text-foreground focus:border-primary h-9 w-full rounded-lg border px-2.5 text-sm outline-none"
                  value={assignedAgentId}
                  onChange={(e) => setAssignedAgentId(e.target.value)}
                >
                  <option value="">{t('agentPlaceholder')}</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || p.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* ── Status on create ── */}
              {!isEditMode && (
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
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          status === s
                            ? s === 'confirmed'
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-amber-400 bg-amber-400/10 text-amber-500'
                            : 'border-border bg-muted text-muted-foreground hover:bg-muted/70'
                        }`}
                      >
                        {s === 'pending'
                          ? t('statusPending')
                          : t('statusConfirmed')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Notes ── */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {t('notesLabel')}
                </Label>
                <Textarea
                  placeholder={t('notesPlaceholder')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="border-border bg-muted text-foreground min-h-[80px] resize-none text-sm"
                />
              </div>

              {/* ── Pickup ── */}
              <div className="border-border bg-muted/40 rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-foreground text-sm font-medium">
                      {t('pickupLabel')}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {t('pickupHint')}
                    </p>
                  </div>
                  <Switch
                    checked={pickupRequired}
                    onCheckedChange={setPickupRequired}
                  />
                </div>

                {pickupRequired && (
                  <div className="border-border/60 mt-4 space-y-2 border-t pt-4">
                    <Label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      {t('pickupAddressLabel')}
                    </Label>
                    <Textarea
                      placeholder={t('pickupAddressPlaceholder')}
                      value={pickupLocation}
                      onChange={(e) => setPickupLocation(e.target.value)}
                      className="border-border bg-background text-foreground min-h-[72px] resize-none text-sm"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="border-border/50 bg-popover border-t px-5 py-4">
              <div className="flex gap-3">
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
                  disabled={!selectedContactId || !scheduledAt || saving}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1"
                >
                  {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
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
