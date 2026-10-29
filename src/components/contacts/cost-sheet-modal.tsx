'use client';

import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  Download,
  MessageCircle,
  Send,
  Calculator,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { canManageMembers } from '@/lib/auth/roles';
import {
  getAgentAssignedContactIds,
  buildAgentContactFilter,
} from '@/lib/contacts/agent-scoping';
import {
  generateCostSheetPdf,
  downloadPdfBlob,
  calculateCostSheet,
  type CostSheetProps,
} from '@/lib/pdf';
import { uploadAccountMedia } from '@/lib/storage/upload-media';

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
  const t = useTranslations('CostSheet');
  const { user, profile, accountRole } = useAuth();
  const isManager = accountRole ? canManageMembers(accountRole) : false;

  const [loading, setLoading] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [sendingText, setSendingText] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [sendingPdf, setSendingPdf] = useState(false);
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
  const [agencyName, setAgencyName] = useState('WaCRM Real Estate');

  // 1. Fetch contacts if no initialContactId provided
  useEffect(() => {
    if (!open || initialContactId) return;
    let isMounted = true;
    const timer = setTimeout(() => {
      setLoadingContacts(true);
    }, 0);

    async function fetchContacts() {
      try {
        const db = createClient();
        let query = db
          .from('contacts')
          .select('id, name, phone')
          .order('name')
          .limit(100);

        if (!isManager && user?.id) {
          const assignedContactIds = await getAgentAssignedContactIds(
            db,
            user.id,
            profile?.id
          );
          const filter = buildAgentContactFilter(
            user.id,
            profile?.id,
            assignedContactIds
          );
          query = query.or(filter);
        }

        const { data, error } = await query;
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
      clearTimeout(timer);
    };
  }, [open, initialContactId, isManager, user, profile]);

  // 2. Fetch required data when a contact is selected
  useEffect(() => {
    if (!open) return;
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
    const timer = setTimeout(() => {
      setLoading(true);
    }, 0);

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

        // Fetch agent & agency info
        const resolvedAgency = accountData.account?.name || 'WaCRM Real Estate';
        const agentName =
          accountData.role?.full_name || accountData.account?.name || 'Agent';
        const agentPhone =
          (accountData.account?.phone as string | undefined) || '';
        setAgencyName(resolvedAgency);
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

    void loadData();

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [open, selectedContactId, propertyId, profile]);

  const selectedProperty = useMemo(() => {
    return matchingProperties.find((p) => p.id === selectedPropertyId);
  }, [matchingProperties, selectedPropertyId]);

  const calculation = useMemo(() => {
    if (!selectedProperty) return null;
    return calculateCostSheet({
      price: selectedProperty.price,
      carpetArea: selectedProperty.carpet_area,
      possessionStatus: selectedProperty.possession_status,
    });
  }, [selectedProperty]);

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
    };

    let template = templateContent;
    // Sanitize any residual advance breakdown or base_rate to simple single price
    template = template
      .replace(
        /📊?\s*\*?Itemized Cost Breakdown[\s\S]*?(?=(\n\s*\n\s*[💰📞]|$))/i,
        ''
      )
      .trim();
    if (template.includes('Base Rate: {{base_rate}}')) {
      template = template.replace(
        'Base Rate: {{base_rate}}',
        'Price: {{price}}'
      );
    }

    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => dataMap[key] ?? '');
  }, [templateContent, selectedProperty, contactData, agentDetails]);

  // Construct PDF props from currently selected property, contact, and agent
  const getPdfProps = (): CostSheetProps | null => {
    if (!selectedProperty) return null;
    return {
      agencyName,
      agentName: agentDetails.name,
      agentPhone: agentDetails.phone || undefined,
      clientName: contactData?.name || undefined,
      clientPhone: contactData?.phone || undefined,
      propertyTitle: selectedProperty.title,
      projectName: selectedProperty.project_name,
      builderName: selectedProperty.builder_name,
      location: selectedProperty.location,
      configuration: selectedProperty.configuration,
      bedrooms: selectedProperty.bedrooms,
      carpetArea: selectedProperty.carpet_area,
      facing: selectedProperty.facing,
      possessionStatus: selectedProperty.possession_status,
      possessionDate: selectedProperty.possession_date,
      reraId: selectedProperty.rera_id,
      basePrice: selectedProperty.price,
    };
  };

  const handleDownloadPdf = async () => {
    const props = getPdfProps();
    if (!props) return;
    setGeneratingPdf(true);
    try {
      const blob = await generateCostSheetPdf(props);
      const cleanTitle = (props.propertyTitle || 'Property')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 30);
      const filename = `Cost_Sheet_${cleanTitle}.pdf`;
      downloadPdfBlob(blob, filename);
      toast.success(t('pdfDownloaded'));
    } catch (err: unknown) {
      console.error(err);
      toast.error('Failed to generate Cost Sheet PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSendPdfWhatsApp = async () => {
    const props = getPdfProps();
    if (!props || !selectedContactId) return;
    setSendingPdf(true);
    try {
      const blob = await generateCostSheetPdf(props);
      const cleanTitle = (props.propertyTitle || 'Property')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 30);
      const filename = `Cost_Sheet_${cleanTitle}.pdf`;
      const pdfFile = new File([blob], filename, { type: 'application/pdf' });

      // Upload to chat-media bucket via uploadAccountMedia
      const { publicUrl } = await uploadAccountMedia('chat-media', pdfFile);

      // Call /api/whatsapp/send with message_type: 'document'
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: selectedContactId,
          message_type: 'document',
          media_url: publicUrl,
          filename,
          content_text: `Cost Sheet for ${props.propertyTitle} (${props.location || 'Listing'})`,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to dispatch PDF via WhatsApp');
      }

      toast.success(t('pdfSentSuccess'));
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : t('pdfSendFailed'));
    } finally {
      setSendingPdf(false);
    }
  };

  const handleSendText = async () => {
    if (!templateContent || !selectedContactId) return;
    setSendingText(true);
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

      toast.success(t('textSentSuccess'));
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : t('textSendFailed'));
    } finally {
      setSendingText(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="sm:side-right h-[90vh] overflow-y-auto sm:h-full sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calculator className="text-primary size-5" />
            {t('title')}
          </SheetTitle>
          <SheetDescription>{t('description')}</SheetDescription>
        </SheetHeader>

        {!initialContactId && !selectedContactId ? (
          <div className="mt-6 space-y-4">
            <Label>{t('selectContact')}</Label>
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
                <option value="">{t('selectContactPlaceholder')}</option>
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
        ) : (
          <div className="mt-6 space-y-5">
            {/* Property Selector */}
            <div className="space-y-3">
              <Label>{t('selectProperty')}</Label>
              {matchingProperties.length > 0 ? (
                <RadioGroup
                  value={selectedPropertyId}
                  onValueChange={setSelectedPropertyId}
                  className="space-y-2"
                >
                  {matchingProperties.map((p) => (
                    <div
                      key={p.id}
                      className="border-border bg-card/60 flex items-start space-x-3 rounded-md border p-3 transition-colors"
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
                        <span className="text-foreground font-semibold">
                          {p.title}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {p.location || 'Location upon inquiry'}
                        </span>
                        <span className="text-primary mt-1 text-xs font-semibold">
                          {p.price ? formatINR(p.price) : t('priceOnRequest')}
                        </span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t('noPropertiesFound')}
                </p>
              )}
            </div>

            {/* Itemized Cost Breakdown Card */}
            {calculation && (
              <div className="border-border bg-card space-y-2 rounded-lg border p-3.5 text-xs shadow-xs">
                <div className="border-border flex items-center justify-between border-b pb-2">
                  <span className="text-foreground font-semibold">
                    {t('itemizedEstimate')}
                  </span>
                  <span className="text-primary text-sm font-bold">
                    {formatINR(calculation.totalAllInclusive)}
                  </span>
                </div>
                <div className="space-y-1.5 pt-1">
                  <div className="text-muted-foreground flex justify-between">
                    <span>{t('agreementValue')}</span>
                    <span className="text-foreground font-medium">
                      {formatINR(calculation.agreementValue)}
                    </span>
                  </div>
                  <div className="text-muted-foreground flex justify-between">
                    <span>{t('parking')}</span>
                    <span className="text-foreground font-medium">
                      {formatINR(calculation.parkingCost)}
                    </span>
                  </div>
                  <div className="text-muted-foreground flex justify-between">
                    <span>
                      {t('gst')} ({calculation.gstPercent}%)
                    </span>
                    <span className="text-foreground font-medium">
                      {formatINR(calculation.gstAmount)}
                    </span>
                  </div>
                  <div className="text-muted-foreground flex justify-between">
                    <span>
                      {t('stampDuty')} ({calculation.stampDutyPercent}%)
                    </span>
                    <span className="text-foreground font-medium">
                      {formatINR(calculation.stampDutyAmount)}
                    </span>
                  </div>
                  <div className="text-muted-foreground flex justify-between">
                    <span>{t('registration')}</span>
                    <span className="text-foreground font-medium">
                      {formatINR(calculation.registrationFee)}
                    </span>
                  </div>
                  <div className="border-border/60 text-foreground flex justify-between border-t pt-1.5 font-semibold">
                    <span>{t('totalEstimate')}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {formatINR(calculation.totalAllInclusive)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Text Message Preview (if template configured) */}
            {templateContent ? (
              <div className="space-y-2">
                <Label className="text-xs">{t('previewMessage')}</Label>
                <div className="bg-muted/70 max-h-[160px] overflow-y-auto rounded-md p-3">
                  <pre className="text-foreground font-mono text-xs whitespace-pre-wrap">
                    {filledTemplate}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground rounded-lg border border-dashed p-3 text-center text-xs">
                <p>{t('noTemplateConfigured')}</p>
                <p className="mt-1">
                  <Link
                    href="/settings?tab=cost-sheet"
                    className="text-primary hover:underline"
                    onClick={() => onOpenChange(false)}
                  >
                    {t('setUpInSettings')}
                  </Link>
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <Button
                type="button"
                className="w-full gap-2 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
                onClick={handleSendPdfWhatsApp}
                disabled={
                  sendingPdf ||
                  generatingPdf ||
                  !selectedProperty ||
                  !selectedContactId
                }
              >
                {sendingPdf ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MessageCircle className="size-4" />
                )}
                {t('sendPdfWhatsApp')}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  onClick={handleDownloadPdf}
                  disabled={generatingPdf || sendingPdf || !selectedProperty}
                >
                  {generatingPdf ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  {t('downloadPdf')}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  className="gap-1.5 text-xs"
                  onClick={handleSendText}
                  disabled={
                    sendingText ||
                    !templateContent ||
                    !selectedContactId ||
                    matchingProperties.length === 0
                  }
                >
                  {sendingText ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  {t('sendViaWhatsApp')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
