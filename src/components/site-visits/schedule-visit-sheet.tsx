'use client';

import { useState, useEffect, useCallback } from 'react';
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
import type { Contact, Property } from '@/types';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ScheduleVisitSheet({ open, onOpenChange, onSuccess }: Props) {
  const t = useTranslations('SiteVisits.schedule');
  const supabase = createClient();
  const { accountId } = useAuth();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const loadFormData = useCallback(async () => {
    setLoading(true);
    const [{ data: contactsData }, { data: propsData }] = await Promise.all([
      supabase.from('contacts').select('*').order('name', { ascending: true }),
      supabase
        .from('properties')
        .select('*')
        .order('title', { ascending: true }),
    ]);

    setContacts((contactsData || []) as Contact[]);
    setProperties((propsData || []) as Property[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        loadFormData();
        // Reset form
        setSelectedContactId('');
        setSelectedPropertyId('');
        setDate('');
        setTime('');
        setNotes('');
      }, 0);
    }
  }, [open, loadFormData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedContactId || !date || !time) return;
    if (!accountId) {
      toast.error(t('toastError'));
      return;
    }

    setSaving(true);

    // Combine date and time into TIMESTAMPTZ
    const scheduledAt = new Date(`${date}T${time}`).toISOString();

    const { error } = await supabase.from('site_visits').insert({
      account_id: accountId,
      contact_id: selectedContactId,
      property_id: selectedPropertyId || null,
      scheduled_at: scheduledAt,
      status: 'pending',
      notes: notes || null,
    });

    setSaving(false);

    if (error) {
      toast.error(t('toastError'));
    } else {
      toast.success(t('toastSuccess'));
      onSuccess();
      onOpenChange(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="sm:side-right flex max-h-[90vh] flex-col rounded-t-2xl sm:max-h-screen sm:rounded-none"
      >
        <SheetHeader>
          <SheetTitle>{t('title')}</SheetTitle>
          <SheetDescription>{t('desc')}</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="text-primary size-6 animate-spin" />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-1 flex-col gap-4 overflow-y-auto py-4"
          >
            <div className="space-y-2">
              <Label>{t('contactLabel')} *</Label>
              <select
                className="bg-card border-border text-foreground flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                value={selectedContactId}
                onChange={(e) => setSelectedContactId(e.target.value)}
                required
              >
                <option value="">{t('contactPlaceholder')}</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.phone}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>{t('propertyLabel')}</Label>
              <select
                className="bg-card border-border text-foreground flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
              >
                <option value="">{t('propertyPlaceholder')}</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('dateLabel')} *</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t('timeLabel')} *</Label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('notesLabel')}</Label>
              <Textarea
                placeholder={t('notesPlaceholder')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-none"
              />
            </div>

            <div className="mt-auto flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={!selectedContactId || !date || !time || saving}
              >
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {t('schedule')}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
