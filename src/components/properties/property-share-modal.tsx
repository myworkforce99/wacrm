'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { Property, Contact } from '@/types';
import { formatINR } from '@/lib/currency';
import { formatConfiguration } from '@/lib/properties/format-configuration';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check, MessageCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface PropertyShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property | null;
}

export function PropertyShareModal({
  open,
  onOpenChange,
  property,
}: PropertyShareModalProps) {
  const t = useTranslations('Properties.share');
  const supabase = createClient();

  const [copied, setCopied] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  // Fetch recent contacts for quick WhatsApp dispatch
  useEffect(() => {
    if (!open) return;
    let isCancelled = false;

    async function loadContacts() {
      setLoadingContacts(true);
      const { data } = await supabase
        .from('contacts')
        .select('id, name, phone')
        .order('name')
        .limit(50);

      if (!isCancelled && data) {
        setContacts(data as Contact[]);
      }
      if (!isCancelled) {
        setLoadingContacts(false);
      }
    }

    loadContacts();
    return () => {
      isCancelled = true;
    };
  }, [open, supabase]);

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts.slice(0, 5);
    const q = contactSearch.toLowerCase();
    return contacts
      .filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [contacts, contactSearch]);

  const formattedMessage = useMemo(() => {
    if (!property) return '';

    const lines: string[] = [];
    lines.push(`🏡 *${property.title}*`);
    if (property.project_name || property.builder_name) {
      const sub = [property.project_name, property.builder_name]
        .filter(Boolean)
        .join(' by ');
      lines.push(`🏗️ ${sub}`);
    }
    if (property.location) {
      lines.push(`📍 *Location:* ${property.location}`);
    }
    if (property.price) {
      lines.push(`💰 *Price:* ${formatINR(property.price)}`);
    }

    const specs: string[] = [];
    const formattedConfig = formatConfiguration(
      property.configuration,
      property.bedrooms
    );
    if (formattedConfig) specs.push(formattedConfig);
    if (property.carpet_area) specs.push(`${property.carpet_area} sq ft`);
    if (property.facing) specs.push(`${property.facing} Facing`);
    if (specs.length > 0) {
      lines.push(`📐 *Specs:* ${specs.join(' • ')}`);
    }

    if (property.possession_status) {
      const statusMap: Record<string, string> = {
        ready_to_move: 'Ready to Move',
        under_construction: 'Under Construction',
        nearing_possession: 'Nearing Possession',
      };
      lines.push(
        `⏳ *Status:* ${statusMap[property.possession_status] || property.possession_status}`
      );
    }

    if (property.rera_id) {
      lines.push(`📜 *RERA Reg:* ${property.rera_id}`);
    }

    if (property.tags && property.tags.length > 0) {
      lines.push(`✨ *Highlights:* ${property.tags.join(', ')}`);
    }

    lines.push('');
    lines.push(
      'Would you like to schedule an exclusive site visit? Reply to this message or let us know your preferred time!'
    );

    return lines.join('\n');
  }, [property]);

  if (!property) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formattedMessage);
      setCopied(true);
      toast.success(t('toastCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('toastCopyFailed'));
    }
  }

  function handleShareWhatsAppGeneric() {
    const url = `https://wa.me/?text=${encodeURIComponent(formattedMessage)}`;
    window.open(url, '_blank');
  }

  function handleSendToContact(contact: Contact) {
    if (!contact.phone) {
      toast.error(t('contactNoPhone'));
      return;
    }
    const cleanPhone = contact.phone.replace(/[^\d]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(formattedMessage)}`;
    window.open(url, '_blank');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-5 text-emerald-500" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        {/* Message preview block */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              {t('previewLabel')}
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="h-8 gap-1.5 text-xs"
              >
                {copied ? (
                  <Check className="size-3.5 text-green-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copied ? t('copied') : t('copy')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleShareWhatsAppGeneric}
                className="h-8 gap-1.5 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
              >
                <MessageCircle className="size-3.5" />
                {t('openWhatsApp')}
              </Button>
            </div>
          </div>

          <div className="border-border bg-muted/40 text-foreground rounded-lg border p-3.5 font-mono text-xs leading-relaxed whitespace-pre-wrap select-all">
            {formattedMessage}
          </div>
        </div>

        {/* Send directly to lead/contact */}
        <div className="border-border space-y-3 border-t pt-4">
          <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            {t('sendToLeadLabel')}
          </Label>

          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder={t('searchContactPlaceholder')}
              className="h-9 pl-8 text-xs"
            />
          </div>

          <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
            {loadingContacts ? (
              <p className="text-muted-foreground py-4 text-center text-xs">
                {t('loadingContacts')}
              </p>
            ) : filteredContacts.length === 0 ? (
              <p className="text-muted-foreground py-3 text-center text-xs">
                {t('noContactsFound')}
              </p>
            ) : (
              filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="hover:bg-muted/60 hover:border-border flex items-center justify-between rounded-md border border-transparent p-2 text-xs transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-foreground truncate font-medium">
                      {contact.name || t('unnamedLead')}
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      {contact.phone || t('noPhone')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Link
                      href={`/inbox?contactId=${contact.id}`}
                      className={cn(
                        buttonVariants({ variant: 'ghost', size: 'sm' }),
                        'text-muted-foreground hover:text-foreground h-7 px-2 text-xs'
                      )}
                    >
                      {t('chatInCrm')}
                    </Link>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSendToContact(contact)}
                      disabled={!contact.phone}
                      className="h-7 gap-1 text-xs text-emerald-600 dark:text-emerald-400"
                    >
                      <MessageCircle className="size-3" />
                      {t('sendBtn')}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
