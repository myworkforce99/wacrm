'use client';

import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
// import { Switch } from '@/components/ui/switch';
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

  /* ============================================================
   * [ADVANCE COST SHEET STATE - Disabled for now, to be re-enabled in future development]
   * const [isAdvanced, setIsAdvanced] = useState(false);
   * const [accountRates, setAccountRates] = useState<{
   *   base_rate?: number;
   *   floor_rise?: number;
   *   floor_rise_from?: number;
   *   parking?: number;
   *   gst_percent?: number;
   *   stamp_duty_percent?: number;
   *   registration_fee?: number;
   * }>({
   *   base_rate: 8500,
   *   floor_rise: 50,
   *   floor_rise_from: 5,
   *   parking: 400000,
   *   gst_percent: 5,
   *   stamp_duty_percent: 6,
   *   registration_fee: 30000,
   * });
   * ============================================================ */

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
    async function fetchContacts() {
      try {
        const db = createClient();
        const { data, error } = await db
          .from('contacts')
          .select('id, name, phone')
          .order('name')
          .limit(100);
        if (isMounted && !error && data) {
          setContacts(data as unknown as Contact[]);
        }
      } catch (err: unknown) {
        console.error(err);
      } finally {
        if (isMounted) setLoadingContacts(false);
      }
    }
    void fetchContacts();
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
        const db = createClient();
        const [accountRes, contactRes, propertiesRes] = await Promise.all([
          fetch('/api/account'),
          db
            .from('contacts')
            .select('*, lead_details(*)')
            .eq('id', selectedContactId)
            .single(),
          db.from('properties').select('*').limit(50),
        ]);

        if (!accountRes.ok || contactRes.error || propertiesRes.error) {
          throw new Error('Failed to load required data');
        }

        const accountData = await accountRes.json();
        const contact = contactRes.data;
        const allProperties: Property[] = (propertiesRes.data ||
          []) as Property[];

        if (!isMounted) return;

        // Fetch agent info
        const agentName =
          accountData.role?.full_name || accountData.account?.name || 'Agent';
        const agentPhone = 'Agent Phone'; // Usually would come from profile or whatsapp config, fallback to placeholder
        setAgentDetails({ name: agentName, phone: agentPhone });

        /* ============================================================
         * [ADVANCE COST SHEET MODE & RATES - Disabled for now]
         * const accountMode = accountData.account?.settings?.cost_sheet_mode;
         * setIsAdvanced(accountMode === 'advance');
         * if (accountData.account?.settings?.cost_sheet_rates) {
         *   setAccountRates(accountData.account.settings.cost_sheet_rates);
         * }
         * ============================================================ */

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

        setContactData(contact as unknown as Contact);

        const leadDetails = (contact as { lead_details?: LeadDetail | null })
          ?.lead_details;

        const locPref = (leadDetails?.location_preference || '').toLowerCase();

        const filtered = allProperties.map((p) => ({ ...p, _matchScore: 0 }));
        filtered.forEach((p) => {
          let score = 0;
          if (locPref && (p.location || '').toLowerCase().includes(locPref))
            score += 1;
          if (
            leadDetails?.configuration_preference &&
            p.configuration &&
            leadDetails.configuration_preference.includes(p.configuration)
          ) {
            score += 1;
          }
          if (
            leadDetails?.property_type &&
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

  /* ============================================================
   * [ADVANCE COST SHEET CALCULATION - Disabled for now, to be re-enabled in future development]
   * const calculation = useMemo(() => {
   *   if (!selectedProperty) return null;
   *   const carpetArea = selectedProperty.carpet_area || 1000;
   *   const baseRate = accountRates.base_rate || 8500;
   *   const agreementValue = selectedProperty.price
   *     ? Number(selectedProperty.price)
   *     : carpetArea * baseRate;
   *   const parkingCost = accountRates.parking ?? 400000;
   *   const subtotal = agreementValue + parkingCost;
   *   const gstAmount = Math.round(
   *     (subtotal * (accountRates.gst_percent ?? 5)) / 100
   *   );
   *   const stampDutyAmount = Math.round(
   *     (agreementValue * (accountRates.stamp_duty_percent ?? 6)) / 100
   *   );
   *   const regFee = accountRates.registration_fee ?? 30000;
   *   const totalAllInclusive =
   *     subtotal + gstAmount + stampDutyAmount + regFee;
   *
   *   return {
   *     agreementValue,
   *     carpetArea,
   *     baseRate,
   *     parkingCost,
   *     subtotal,
   *     gstAmount,
   *     stampDutyAmount,
   *     regFee,
   *     totalAllInclusive,
   *   };
   * }, [selectedProperty, accountRates]);
   * ============================================================ */

  const filledTemplate = useMemo(() => {
    if (!templateContent) return '';
    const leadDetails = (contactData as { lead_details?: LeadDetail | null })
      ?.lead_details;

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
      /* ============================================================
       * [ADVANCE COST SHEET MACROS - Disabled for now]
       * base_rate: calculation?.baseRate
       *   ? `${formatINR(calculation.baseRate)} / sq ft`
       *   : '₹8,500 / sq ft',
       * parking: calculation ? formatINR(calculation.parkingCost) : '₹4,00,000',
       * gst: calculation ? formatINR(calculation.gstAmount) : '5%',
       * stamp_duty: calculation ? formatINR(calculation.stampDutyAmount) : '6%',
       * registration: calculation ? formatINR(calculation.regFee) : '₹30,000',
       * total_cost: calculation
       *   ? formatINR(calculation.totalAllInclusive)
       *   : '',
       * ============================================================ */
    };

    let template = templateContent;
    // Sanitize any residual advance breakdown or base_rate to simple single price
    template = template
      .replace(/📊?\s*\*?Itemized Cost Breakdown[\s\S]*?(?=(\n\s*\n\s*[💰📞]|$))/i, '')
      .trim();
    if (template.includes('Base Rate: {{base_rate}}')) {
      template = template.replace('Base Rate: {{base_rate}}', 'Price: {{price}}');
    }

    return template.replace(
      /\{\{(\w+)\}\}/g,
      (_, key) => dataMap[key] ?? ''
    );
  }, [
    templateContent,
    selectedProperty,
    contactData,
    agentDetails,
  ]);

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
            {/* ============================================================
             * [ADVANCE COST SHEET TOGGLE - Disabled for now, to be re-enabled in future development]
             *
             * <div className="flex items-center justify-between rounded-lg border bg-card p-3 shadow-xs">
             *   <div className="space-y-0.5">
             *     <Label
             *       htmlFor="advance-cost-sheet-toggle"
             *       className="text-foreground text-sm font-semibold cursor-pointer"
             *     >
             *       Advance Cost Sheet
             *     </Label>
             *     <p className="text-muted-foreground text-xs">
             *       Itemized breakdown with GST, Stamp Duty & Parking
             *     </p>
             *   </div>
             *   <Switch
             *     id="advance-cost-sheet-toggle"
             *     checked={isAdvanced}
             *     onCheckedChange={setIsAdvanced}
             *   />
             * </div>
             * ============================================================ */}

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

              {/* ============================================================
               * [ADVANCE COST SHEET ITEMIZED BREAKDOWN - Disabled for now, to be re-enabled in future development]
               *
               * {isAdvanced && calculation && (
               *   <div className="rounded-lg border bg-card p-4 space-y-2.5 text-sm">
               *     <div className="flex justify-between items-center font-semibold border-b pb-2">
               *       <span className="text-foreground">Itemized Cost Estimate (Indian Standard)</span>
               *       <span className="text-primary text-base font-bold">
               *         {formatINR(calculation.totalAllInclusive)}
               *       </span>
               *     </div>
               *     ...
               *   </div>
               * )}
               * ============================================================ */}
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
