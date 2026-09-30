'use client';

import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatINR } from '@/lib/currency';
import type { Contact, Property, LeadDetail } from '@/types';

interface CostSheetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId?: string;
  propertyId?: string;
}

export function CostSheetModal({
  open,
  onOpenChange,
  contactId: initialContactId,
  propertyId,
}: CostSheetModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [sending, setSending] = useState(false);
  const [templateContent, setTemplateContent] = useState<string | null>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<
    string | undefined
  >(initialContactId);

  const [contactData, setContactData] = useState<Contact | null>(null);
  const [matchingProperties, setMatchingProperties] = useState<
    (Property & { _matchScore?: number })[]
  >([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<
    string | undefined
  >(propertyId);
  const [agentDetails, setAgentDetails] = useState({ name: '', phone: '' });

  // 1. Fetch contacts if no initialContactId provided
  useEffect(() => {
    if (!open || initialContactId) return;
    let isMounted = true;
    setLoadingContacts(true);
    fetch('/api/v1/contacts?limit=1000') // Adjust according to API if necessary, or just use a combo box endpoint if available.
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.contacts) setContacts(data.contacts);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (isMounted) setLoadingContacts(false);
      });
    return () => {
      isMounted = false;
    };
  }, [open, initialContactId]);

  // 2. Fetch required data when a contact is selected
  useEffect(() => {
    if (!open) return;
    // Reset state on open changes
    if (open) {
      if (initialContactId) {
        setSelectedContactId(initialContactId);
      } else {
        setSelectedContactId(undefined);
      }
    }
  }, [open, initialContactId]);

  useEffect(() => {
    if (!open || !selectedContactId) return;

    let isMounted = true;
    setLoading(true);

    async function loadData() {
      try {
        const [accountRes, contactRes, propertiesRes] = await Promise.all([
          fetch('/api/account'),
          fetch(`/api/v1/contacts/${selectedContactId}`),
          fetch('/api/v1/properties?limit=20'),
        ]);

        if (!accountRes.ok || !contactRes.ok || !propertiesRes.ok) {
          throw new Error('Failed to load required data');
        }

        const accountData = await accountRes.json();
        const contactJson = await contactRes.json();
        const propertiesJson = await propertiesRes.json();

        if (!isMounted) return;

        // Fetch agent info
        const agentName =
          accountData.role?.full_name || accountData.account?.name || 'Agent';
        const agentPhone = 'Agent Phone'; // Usually would come from profile or whatsapp config, fallback to placeholder
        setAgentDetails({ name: agentName, phone: agentPhone });

        const costSheetId = accountData.account?.cost_sheet_template_id;
        if (costSheetId) {
          const qrRes = await fetch('/api/quick-replies');
          const qrData = await qrRes.json();
          if (qrRes.ok && qrData.quick_replies) {
            const match = qrData.quick_replies.find(
              (qr: { id: string; content_text: string | null }) =>
                qr.id === costSheetId
            );
            if (match && match.content_text) {
              setTemplateContent(match.content_text);
            }
          }
        }

        setContactData(contactJson.contact);

        const allProperties: Property[] = propertiesJson.properties || [];
        const leadDetails = contactJson.contact?.lead_details?.[0] || {};

        const locPref = (leadDetails.location_preference || '').toLowerCase();

        const filtered = allProperties.map((p) => ({ ...p, _matchScore: 0 }));
        filtered.forEach((p) => {
          let score = 0;
          if (locPref && (p.location || '').toLowerCase().includes(locPref))
            score += 1;
          if (
            leadDetails.configuration_preference &&
            leadDetails.configuration_preference.includes(p.configuration)
          ) {
            score += 1;
          }
          if (
            leadDetails.property_type &&
            p.property_type === leadDetails.property_type
          ) {
            score += 1;
          }
          p._matchScore = score;
        });

        filtered.sort((a, b) => (b._matchScore || 0) - (a._matchScore || 0));
        const top3 = filtered.slice(0, 3);
        setMatchingProperties(top3);

        if (propertyId && top3.some((p) => p.id === propertyId)) {
          setSelectedPropertyId(propertyId);
        } else if (top3.length > 0) {
          setSelectedPropertyId(top3[0].id);
        }
      } catch (err: unknown) {
        console.error(err);
        toast.error('Failed to load cost sheet data');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [open, selectedContactId, propertyId]);

  const selectedProperty = useMemo(() => {
    return matchingProperties.find((p) => p.id === selectedPropertyId);
  }, [matchingProperties, selectedPropertyId]);

  const filledTemplate = useMemo(() => {
    if (!templateContent) return '';
    const leadDetails = (contactData as { lead_details?: LeadDetail[] })
      ?.lead_details?.[0];

    const dataMap: Record<string, string> = {
      property_title: selectedProperty?.title || '',
      location: selectedProperty?.location || '',
      price: selectedProperty?.price ? formatINR(selectedProperty.price) : '',
      property_type: selectedProperty?.property_type || '',
      configuration: selectedProperty?.configuration || '',
      bedrooms: selectedProperty?.bedrooms
        ? String(selectedProperty.bedrooms)
        : '',
      rera_id: selectedProperty?.rera_id || '',
      builder_name: selectedProperty?.builder_name || '',
      possession_status: selectedProperty?.possession_status || '',
      carpet_area: selectedProperty?.carpet_area
        ? String(selectedProperty.carpet_area)
        : '',
      budget_min: leadDetails?.budget_min
        ? formatINR(leadDetails.budget_min)
        : '',
      budget_max: leadDetails?.budget_max
        ? formatINR(leadDetails.budget_max)
        : '',
      agent_name: agentDetails.name,
      agent_phone: agentDetails.phone,
    };

    return templateContent.replace(
      /\{\{(\w+)\}\}/g,
      (_, key) => dataMap[key] ?? ''
    );
  }, [templateContent, selectedProperty, contactData, agentDetails]);

  const handleSend = async () => {
    if (!templateContent || !selectedContactId) return;
    setSending(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: selectedContactId,
          message_type: 'text',
          content_text: filledTemplate,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send WhatsApp message');
      }

      toast.success('Cost Sheet sent! ✓');
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : 'Failed to send Cost Sheet'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="sm:side-right h-[90vh] overflow-y-auto sm:h-full sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>Send Cost Sheet</SheetTitle>
          <SheetDescription>
            Send a property cost breakdown via WhatsApp.
          </SheetDescription>
        </SheetHeader>

        {!initialContactId && !selectedContactId ? (
          <div className="mt-6 space-y-4">
            <Label>Select Contact</Label>
            {loadingContacts ? (
              <div className="flex h-10 items-center justify-center">
                <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
              </div>
            ) : (
              <select
                value=""
                onChange={(e) => setSelectedContactId(e.target.value)}
                className="border-border bg-muted text-foreground focus:border-primary focus:ring-primary h-9 w-full rounded-lg border px-2.5 text-sm outline-none focus:ring-1"
              >
                <option value="">Select a contact...</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.phone}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : !templateContent ? (
          <div className="text-muted-foreground mt-8 text-center text-sm">
            <p>No Cost Sheet template configured.</p>
            <p className="mt-2">
              Set one up in{' '}
              <Link
                href="/settings?tab=cost-sheet"
                className="text-primary hover:underline"
                onClick={() => onOpenChange(false)}
              >
                Settings → Cost Sheet
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="space-y-3">
              <Label>Select Property</Label>
              {matchingProperties.length > 0 ? (
                <RadioGroup
                  value={selectedPropertyId}
                  onValueChange={setSelectedPropertyId}
                  className="space-y-2"
                >
                  {matchingProperties.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-start space-x-3 rounded-md border p-3"
                    >
                      <RadioGroupItem
                        value={p.id}
                        id={`prop-${p.id}`}
                        className="mt-1"
                      />
                      <Label
                        htmlFor={`prop-${p.id}`}
                        className="flex flex-1 cursor-pointer flex-col"
                      >
                        <span className="font-semibold">{p.title}</span>
                        <span className="text-muted-foreground text-sm">
                          {p.location}
                        </span>
                        <span className="mt-1 text-sm font-medium">
                          {p.price ? formatINR(p.price) : 'Price on request'}
                        </span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No matching properties found.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Preview Message</Label>
              <div className="bg-muted max-h-[300px] overflow-y-auto rounded-md p-4">
                <pre className="text-foreground font-mono text-sm whitespace-pre-wrap">
                  {filledTemplate}
                </pre>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleSend}
              disabled={sending || matchingProperties.length === 0}
            >
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Send via WhatsApp
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
