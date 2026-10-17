'use client';

/**
 * ContactDetailView
 *
 * High-density inspection Sheet for viewing comprehensive lead profiles:
 *  - Overview: Structured Real Estate Requirements (Budget in ₹ INR, Configuration
 *    BHK chips, Property Type, Buyer Intent, Possession Timeline, Location, Source)
 *    and Contact Information with 1-click Copy & direct WhatsApp chat.
 *  - Prominent "Edit Details" triggers seamlessly redirect to ContactForm modal
 *    to eliminate duplicated competing inline form logic.
 *  - Dedicated Visits Tab: Lists all scheduled and past site visits for this lead,
 *    status badges (Pending, Confirmed, Completed, No Show), pickup info, and 1-click
 *    "Schedule Visit" trigger.
 *  - Comprehensive Tabs: Visits, Deals, Tasks, Notes, Matches, Tags, Custom Fields.
 *  - Quick header actions: Edit Details, Schedule Visit, Chat in Inbox, Call, Template, Cost Sheet.
 */

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { addContactTag, deleteContactTag } from '@/lib/contacts/tag-api';
import { useAuth } from '@/hooks/use-auth';
import { formatCurrency, formatINR, formatINRRange } from '@/lib/currency';
import { toast } from 'sonner';
import type {
  Contact,
  Tag,
  ContactNote,
  CustomField,
  Deal,
  MessageTemplate,
  AssignmentHistory,
  LeadDetail,
  Property,
  SiteVisit,
} from '@/types';
import { SlaBadge } from '@/components/ui/sla-badge';
import { SourceBadge } from '@/components/ui/source-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  TemplatePicker,
  type TemplateSendValues,
} from '@/components/inbox/template-picker';
import { CostSheetModal } from '@/components/contacts/cost-sheet-modal';
import { TasksWidget } from '@/components/dashboard/tasks-widget';
import { ScheduleVisitSheet } from '@/components/site-visits/schedule-visit-sheet';
import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Phone,
  Mail,
  Building2,
  Copy,
  Check,
  Loader2,
  Plus,
  Trash2,
  IndianRupee,
  LayoutTemplate,
  History,
  User,
  Send,
  Zap,
  Calendar,
  MessageCircle,
  Pencil,
  MapPin,
  Clock,
  Car,
  Sparkles,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { contactHandle } from '@/lib/whatsapp/wa-identity';
import { avatarColorForName, initialsForName } from '@/lib/avatar-color';

interface ContactDetailViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
  onUpdated: () => void;
  onEdit?: (contact: Contact) => void;
}

export function ContactDetailView({
  open,
  onOpenChange,
  contactId,
  onUpdated,
  onEdit,
}: ContactDetailViewProps) {
  const t = useTranslations('Contacts.detailView');
  const supabase = createClient();
  const { accountId, defaultCurrency, account } = useAuth();
  const hasCostSheet = !!account?.cost_sheet_template_id;

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [conversation, setConversation] = useState<{
    id: string;
    first_unanswered_at: string | null;
    assigned_agent_id: string | null;
  } | null>(null);
  const [assignee, setAssignee] = useState<{
    user_id: string;
    full_name: string;
  } | null>(null);

  const [assignmentHistoryOpen, setAssignmentHistoryOpen] = useState(false);
  const [assignmentHistory, setAssignmentHistory] = useState<
    AssignmentHistory[]
  >([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [taskCount, setTaskCount] = useState(0);

  // Send template modal
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState(false);

  // Modals
  const [costSheetModalOpen, setCostSheetModalOpen] = useState(false);
  const [scheduleVisitOpen, setScheduleVisitOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<SiteVisit | undefined>(
    undefined
  );

  // Lead qualification details
  const [leadDetail, setLeadDetail] = useState<LeadDetail | null>(null);

  // Visits tab
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);

  // Tags tab
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [contactTagIds, setContactTagIds] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);

  // Notes tab
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Custom fields tab
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [savingCustom, setSavingCustom] = useState(false);
  const [loadingCustom, setLoadingCustom] = useState(false);

  // Deals tab
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);

  // Match tab
  const [matchedProperties, setMatchedProperties] = useState<Property[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  const fetchContact = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);

    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (data) {
      setContact(data);
    }

    const { data: conv } = await supabase
      .from('conversations')
      .select('id, first_unanswered_at, assigned_agent_id')
      .eq('contact_id', contactId)
      .maybeSingle();

    if (conv) {
      setConversation(conv);
      if (conv.assigned_agent_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .eq('user_id', conv.assigned_agent_id)
          .maybeSingle();
        if (profile) setAssignee(profile);
      }
    }

    setLoading(false);
  }, [contactId, supabase]);

  const fetchLeadDetails = useCallback(async () => {
    if (!contactId) return;
    const { data } = await supabase
      .from('lead_details')
      .select('*')
      .eq('contact_id', contactId)
      .maybeSingle();
    setLeadDetail(data ?? null);
  }, [contactId, supabase]);

  const fetchVisits = useCallback(async () => {
    if (!contactId) return;
    setLoadingVisits(true);
    const { data } = await supabase
      .from('site_visits')
      .select(
        '*, property:properties(id, title, location, configuration, bedrooms, price)'
      )
      .eq('contact_id', contactId)
      .order('scheduled_at', { ascending: false });

    setVisits((data ?? []) as SiteVisit[]);
    setLoadingVisits(false);
  }, [contactId, supabase]);

  const fetchTags = useCallback(async () => {
    if (!contactId) return;

    const [tagsRes, contactTagsRes] = await Promise.all([
      supabase.from('tags').select('*').order('name'),
      supabase
        .from('contact_tags')
        .select('tag_id')
        .eq('contact_id', contactId),
    ]);

    if (tagsRes.data) setAllTags(tagsRes.data);
    if (contactTagsRes.data) {
      setContactTagIds(contactTagsRes.data.map((ct) => ct.tag_id));
    }
  }, [contactId, supabase]);

  const fetchNotes = useCallback(async () => {
    if (!contactId) return;
    setLoadingNotes(true);

    const { data } = await supabase
      .from('contact_notes')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });

    if (data) setNotes(data);
    setLoadingNotes(false);
  }, [contactId, supabase]);

  const fetchCustomFields = useCallback(async () => {
    if (!contactId) return;
    setLoadingCustom(true);

    const [fieldsRes, valuesRes] = await Promise.all([
      supabase.from('custom_fields').select('*').order('field_name'),
      supabase
        .from('contact_custom_values')
        .select('*')
        .eq('contact_id', contactId),
    ]);

    if (fieldsRes.data) setCustomFields(fieldsRes.data);
    if (valuesRes.data) {
      const map: Record<string, string> = {};
      valuesRes.data.forEach((v) => {
        map[v.custom_field_id] = v.value ?? '';
      });
      setCustomValues(map);
    }
    setLoadingCustom(false);
  }, [contactId, supabase]);

  const fetchDeals = useCallback(async () => {
    if (!contactId) return;
    setLoadingDeals(true);
    const { data } = await supabase
      .from('deals')
      .select('*, stage:pipeline_stages!deals_stage_id_fkey(*)')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    setDeals((data ?? []) as Deal[]);
    setLoadingDeals(false);
  }, [contactId, supabase]);

  const fetchMatches = useCallback(async () => {
    if (!contactId) return;
    setLoadingMatches(true);

    const { data: detailData } = await supabase
      .from('lead_details')
      .select('*')
      .eq('contact_id', contactId)
      .maybeSingle();

    if (detailData) {
      let query = supabase.from('properties').select('*');

      if (detailData.location_preference) {
        query = query.ilike('location', `%${detailData.location_preference}%`);
      }
      if (detailData.property_type) {
        query = query.eq('property_type', detailData.property_type);
      }
      if (detailData.budget_min) {
        query = query.gte('price', detailData.budget_min);
      }
      if (detailData.budget_max) {
        query = query.lte('price', detailData.budget_max);
      }

      query = query.limit(3);
      const { data: propertiesData } = await query;
      setMatchedProperties(propertiesData ?? []);
    } else {
      setMatchedProperties([]);
    }

    setLoadingMatches(false);
  }, [contactId, supabase]);

  const fetchTaskCount = useCallback(async () => {
    if (!contactId) return;
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('contact_id', contactId)
      .eq('done', false);
    setTaskCount(count ?? 0);
  }, [contactId, supabase]);

  useEffect(() => {
    if (open && contactId) {
      fetchContact();
      fetchLeadDetails();
      fetchVisits();
      fetchTags();
      fetchNotes();
      fetchCustomFields();
      fetchDeals();
      fetchMatches();
      fetchTaskCount();
    }
  }, [
    open,
    contactId,
    fetchContact,
    fetchLeadDetails,
    fetchVisits,
    fetchTags,
    fetchNotes,
    fetchCustomFields,
    fetchDeals,
    fetchMatches,
    fetchTaskCount,
  ]);

  async function fetchAssignmentHistory() {
    if (!contactId) return;
    setLoadingHistory(true);
    setAssignmentHistoryOpen(true);
    const { data } = await supabase
      .from('assignment_history')
      .select(
        '*, from_agent:profiles!from_agent_id(user_id, full_name), to_agent:profiles!to_agent_id(user_id, full_name), actor:profiles!actor_id(user_id, full_name)'
      )
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    if (data) {
      setAssignmentHistory(data as unknown as AssignmentHistory[]);
    }
    setLoadingHistory(false);
  }

  async function copyPhone() {
    if (!contact) return;
    await navigator.clipboard.writeText(contactHandle(contact));
    setCopiedPhone(true);
    toast.success(t('toastInfoCopied'));
    setTimeout(() => setCopiedPhone(false), 2000);
  }

  async function updateVisitStatus(visitId: string, newStatus: string) {
    const { error } = await supabase
      .from('site_visits')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', visitId);

    if (error) {
      toast.error('Failed to update visit status');
    } else {
      toast.success('Visit status updated');
      fetchVisits();
      onUpdated();
    }
  }

  async function toggleTag(tagId: string) {
    if (!contactId) return;
    setSavingTags(true);

    const isSelected = contactTagIds.includes(tagId);
    try {
      if (isSelected) {
        await deleteContactTag(contactId, tagId);
        setContactTagIds((prev) => prev.filter((id) => id !== tagId));
      } else {
        await addContactTag(contactId, tagId);
        setContactTagIds((prev) => [...prev, tagId]);
      }
      onUpdated();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('toastUpdateFailed')
      );
    }
    setSavingTags(false);
  }

  async function addNote() {
    if (!contactId || !newNote.trim()) return;
    setSavingNote(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user || !accountId) {
      toast.error(t('toastNotAuthenticated'));
      setSavingNote(false);
      return;
    }

    const { error } = await supabase.from('contact_notes').insert({
      contact_id: contactId,
      account_id: accountId,
      user_id: user.id,
      note_text: newNote.trim(),
    });

    if (error) {
      toast.error(t('toastNoteAddFailed'));
    } else {
      setNewNote('');
      fetchNotes();
      toast.success(t('toastNoteAdded'));
    }
    setSavingNote(false);
  }

  async function deleteNote(noteId: string) {
    const { error } = await supabase
      .from('contact_notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      toast.error(t('toastNoteDeleteFailed'));
    } else {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success(t('toastNoteDeleted'));
    }
  }

  async function saveCustomFields() {
    if (!contactId) return;
    setSavingCustom(true);

    try {
      await supabase
        .from('contact_custom_values')
        .delete()
        .eq('contact_id', contactId);

      const rows = Object.entries(customValues)
        .filter(([, val]) => val.trim())
        .map(([fieldId, val]) => ({
          contact_id: contactId,
          custom_field_id: fieldId,
          value: val.trim(),
        }));

      if (rows.length > 0) {
        const { error } = await supabase
          .from('contact_custom_values')
          .insert(rows);
        if (error) throw error;
      }

      toast.success(t('toastCustomFieldsSaved'));
    } catch {
      toast.error(t('toastCustomFieldsFailed'));
    }
    setSavingCustom(false);
  }

  async function handleSendTemplate(
    template: MessageTemplate,
    values: TemplateSendValues
  ) {
    if (!contactId) return;
    setSendingTemplate(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contactId,
          message_type: 'template',
          template_name: template.name,
          template_language: template.language,
          template_message_params: {
            body: values.body,
            headerText: values.headerText,
            buttonParams: values.buttonParams,
          },
          template_params: values.body,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reason = payload?.error || `HTTP ${res.status}`;
        toast.error(t('toastTemplateFailed', { reason }));
        return;
      }

      toast.success(t('toastTemplateSent', { name: template.name }));
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'network error';
      toast.error(`Failed to send template: ${reason}`);
    } finally {
      setSendingTemplate(false);
    }
  }

  async function handleSendPropertyMatch(property: Property) {
    if (!contactId || !contact) return;
    setSendingTemplate(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contactId,
          message_type: 'text',
          text: `Hi ${contact.name || 'there'}, we found a property that matches your preferences: ${property.title} located at ${property.location}. Price: ${property.price ? (defaultCurrency === 'INR' ? formatINR(property.price) : formatCurrency(property.price, defaultCurrency)) : 'TBD'}. Let us know if you'd like to schedule a visit!`,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reason = payload?.error || `HTTP ${res.status}`;
        toast.error(t('toastTemplateFailed', { reason }));
        return;
      }
      toast.success(`Property match sent via WhatsApp`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'network error';
      toast.error(`Failed to send property match: ${reason}`);
    } finally {
      setSendingTemplate(false);
    }
  }

  // ── Overview / Requirements (Non-duplicated, High-density Lead Card) ──
  const detailsContent = (
    <div className="space-y-4">
      {/* Real Estate Qualification Section */}
      <div className="bg-card border-border/80 rounded-xl border p-4 shadow-xs">
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary size-4" />
            <h4 className="text-foreground text-xs font-semibold tracking-wide uppercase">
              {t('realEstateRequirements')}
            </h4>
          </div>
          {onEdit && contact && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onEdit(contact);
              }}
              className="border-border text-foreground hover:bg-muted h-7 px-2.5 text-xs font-medium"
            >
              <Pencil className="text-primary mr-1.5 size-3" />
              {t('editRequirements')}
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {/* Budget Range */}
          <div className="bg-muted/40 flex items-center justify-between rounded-lg p-3">
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
              <IndianRupee className="text-primary size-3.5" />
              {t('budgetRange')}
            </span>
            <span className="text-primary bg-primary/10 rounded-full px-2.5 py-0.5 text-xs font-bold">
              {formatINRRange(
                leadDetail?.budget_min ?? null,
                leadDetail?.budget_max ?? null
              )}
            </span>
          </div>

          {/* Configuration / BHK Preferences */}
          <div className="space-y-1.5">
            <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              {t('configuration')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {leadDetail?.property_type === 'Plot' ||
              leadDetail?.property_type === 'Commercial' ? (
                <span className="text-muted-foreground text-xs italic">
                  {t('configNotApplicable', {
                    type: leadDetail.property_type,
                  })}
                </span>
              ) : leadDetail?.configuration_preference &&
                leadDetail.configuration_preference.length > 0 ? (
                leadDetail.configuration_preference.map((cfg) => (
                  <span
                    key={cfg}
                    className="border-primary/40 bg-primary/10 text-primary rounded-full border px-2.5 py-0.5 text-xs font-medium"
                  >
                    {cfg}
                  </span>
                ))
              ) : (
                <span className="text-muted-foreground text-xs">
                  {t('anyConfig')}
                </span>
              )}
            </div>
          </div>

          {/* Property Type & Buyer Intent */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="border-border/60 bg-muted/20 space-y-1 rounded-lg border p-2.5">
              <span className="text-muted-foreground text-[10px] font-semibold uppercase">
                {t('propertyType')}
              </span>
              <p className="text-foreground text-xs font-semibold">
                {leadDetail?.property_type || t('notSpecified')}
              </p>
            </div>
            <div className="border-border/60 bg-muted/20 space-y-1 rounded-lg border p-2.5">
              <span className="text-muted-foreground text-[10px] font-semibold uppercase">
                {t('buyerIntent')}
              </span>
              <p className="text-foreground text-xs font-semibold">
                {leadDetail?.intent || t('notSpecified')}
              </p>
            </div>
          </div>

          {/* Location & Possession */}
          <div className="grid grid-cols-2 gap-2">
            <div className="border-border/60 bg-muted/20 space-y-1 rounded-lg border p-2.5">
              <span className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold uppercase">
                <MapPin className="text-primary size-3" />
                {t('preferredLocation')}
              </span>
              <p className="text-foreground truncate text-xs font-medium">
                {leadDetail?.location_preference || t('notSpecified')}
              </p>
            </div>
            <div className="border-border/60 bg-muted/20 space-y-1 rounded-lg border p-2.5">
              <span className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold uppercase">
                <Clock className="size-3" />
                {t('possessionTimeline')}
              </span>
              <p className="text-foreground truncate text-xs font-medium">
                {leadDetail?.possession_preference === 'ready_to_move_only'
                  ? 'Ready to move only'
                  : leadDetail?.possession_preference ===
                      'under_construction_ok'
                    ? 'Under construction OK'
                    : t('anyTimeline')}
              </p>
            </div>
          </div>

          {/* Lead Source */}
          <div className="flex items-center justify-between border-t pt-2.5 text-xs">
            <span className="text-muted-foreground font-medium">
              {t('leadSource')}
            </span>
            {leadDetail?.source ? (
              <SourceBadge source={leadDetail.source} />
            ) : (
              <span className="text-muted-foreground text-xs">
                {t('notSpecified')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Core Contact Info Card */}
      <div className="bg-card border-border/80 space-y-3 rounded-xl border p-4 shadow-xs">
        <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {t('contactInfo')}
        </h4>

        <div className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('name')}</span>
            <span className="text-foreground font-semibold">
              {contact?.name || t('unnamed')}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('phone')}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={copyPhone}
                className="hover:text-primary flex cursor-pointer items-center gap-1 font-mono font-medium transition-colors"
                title="Copy phone"
              >
                <span>{contact?.phone}</span>
                {copiedPhone ? (
                  <Check className="text-primary size-3" />
                ) : (
                  <Copy className="size-3" />
                )}
              </button>
            </div>
          </div>

          {contact?.email && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('email')}</span>
              <span className="text-foreground font-medium">
                {contact.email}
              </span>
            </div>
          )}

          {contact?.company && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('company')}</span>
              <span className="text-foreground font-medium">
                {contact.company}
              </span>
            </div>
          )}

          {contact?.created_at && (
            <div className="border-border/50 flex items-center justify-between border-t pt-2 text-[11px]">
              <span className="text-muted-foreground">{t('createdAt')}</span>
              <span className="text-muted-foreground">
                {new Date(contact.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── Site Visits Tab Content ──
  const visitsContent = (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-1">
        <p className="text-muted-foreground text-xs">
          {visits.length === 1
            ? '1 site visit on record'
            : `${visits.length} site visits on record`}
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditingVisit(undefined);
            setScheduleVisitOpen(true);
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90 h-7.5 px-3 text-xs font-medium"
        >
          <Calendar className="mr-1.5 size-3.5" />
          {t('visitsTab.scheduleBtn')}
        </Button>
      </div>

      {loadingVisits ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="text-primary size-5 animate-spin" />
        </div>
      ) : visits.length === 0 ? (
        <div className="border-border/80 bg-muted/20 flex flex-col items-center justify-center rounded-xl border py-10 text-center">
          <Calendar className="text-muted-foreground/60 mb-2 size-8" />
          <p className="text-muted-foreground text-xs">
            {t('visitsTab.noVisits')}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingVisit(undefined);
              setScheduleVisitOpen(true);
            }}
            className="border-border text-foreground hover:bg-muted mt-3 h-8 text-xs font-medium"
          >
            <Plus className="mr-1 size-3.5" />
            {t('visitsTab.scheduleBtn')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visits.map((v) => {
            const visitDate = v.scheduled_at
              ? new Date(v.scheduled_at).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'TBD';

            return (
              <div
                key={v.id}
                className="bg-card border-border/80 space-y-2.5 rounded-xl border p-3.5 shadow-xs"
              >
                {/* Header: Date + Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
                      <Clock className="size-4" />
                    </div>
                    <div>
                      <p className="text-foreground text-xs font-semibold">
                        {visitDate}
                      </p>
                      {v.property ? (
                        <p className="text-muted-foreground text-xs">
                          {v.property.title} · {v.property.location}
                        </p>
                      ) : (
                        <p className="text-muted-foreground text-xs italic">
                          Property to be decided
                        </p>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={v.status} />
                </div>

                {/* Property Detail Strip */}
                {v.property && (
                  <div className="border-border/50 bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs">
                    <span className="text-foreground font-medium">
                      {v.property.configuration ||
                        (v.property.bedrooms
                          ? `${v.property.bedrooms} BHK`
                          : '')}
                    </span>
                    {v.property.price && (
                      <span className="text-primary font-bold">
                        {formatINR(v.property.price)}
                      </span>
                    )}
                  </div>
                )}

                {/* Pickup Details */}
                {v.pickup_required && (
                  <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <Car className="text-primary size-3.5 shrink-0" />
                    <span>
                      {t('visitsTab.pickupAt', {
                        location: v.pickup_location || 'Address pending',
                      })}
                    </span>
                  </div>
                )}

                {/* Notes */}
                {v.notes && (
                  <p className="text-muted-foreground bg-muted/30 rounded p-2 text-xs italic">
                    &quot;{v.notes}&quot;
                  </p>
                )}

                {/* Visit Actions */}
                <div className="border-border/50 flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    {v.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => updateVisitStatus(v.id, 'confirmed')}
                        className="cursor-pointer rounded px-2 py-0.5 text-[11px] font-medium text-emerald-600 transition-colors hover:bg-emerald-500/10"
                      >
                        ✓ {t('visitsTab.markConfirmed')}
                      </button>
                    )}
                    {(v.status === 'confirmed' || v.status === 'pending') && (
                      <button
                        type="button"
                        onClick={() => updateVisitStatus(v.id, 'completed')}
                        className="text-primary hover:bg-primary/10 cursor-pointer rounded px-2 py-0.5 text-[11px] font-medium transition-colors"
                      >
                        {t('visitsTab.markCompleted')}
                      </button>
                    )}
                    {v.status !== 'no_show' && v.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={() => updateVisitStatus(v.id, 'no_show')}
                        className="cursor-pointer rounded px-2 py-0.5 text-[11px] font-medium text-red-500 transition-colors hover:bg-red-500/10"
                      >
                        {t('visitsTab.markNoShow')}
                      </button>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingVisit(v);
                      setScheduleVisitOpen(true);
                    }}
                    className="h-6 px-2 text-[11px]"
                  >
                    <Pencil className="mr-1 size-3" />
                    {t('visitsTab.edit')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const tagsContent = (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        {t('tagsTab.clickTagDesc')}
      </p>
      {allTags.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t('tagsTab.noTagsAvailable')}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => {
            const selected = contactTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                disabled={savingTags}
                className={`inline-flex cursor-pointer items-center rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  selected
                    ? 'ring-primary ring-offset-border ring-2 ring-offset-1'
                    : 'opacity-50 hover:opacity-80'
                }`}
                style={{
                  backgroundColor: tag.color + '20',
                  color: tag.color,
                }}
              >
                {selected && <Check className="mr-1 size-3" />}
                {tag.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const notesContent = (
    <>
      <div className="mb-3 space-y-2">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder={t('notesTab.placeholder')}
          className="bg-muted/40 border-border text-foreground placeholder:text-muted-foreground min-h-[64px] resize-none text-xs"
        />
        <Button
          onClick={addNote}
          disabled={!newNote.trim() || savingNote}
          className="bg-primary hover:bg-primary/90 text-primary-foreground h-7.5 px-3 text-xs"
          size="sm"
        >
          {savingNote ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-3.5" />
          )}
          {t('notesTab.save')}
        </Button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {loadingNotes ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-xs">
            {t('notesTab.noNotes')}
          </p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="bg-card border-border/70 group rounded-xl border p-3 shadow-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-foreground flex-1 text-xs whitespace-pre-wrap">
                  {note.note_text}
                </p>
                <button
                  onClick={() => deleteNote(note.id)}
                  className="text-muted-foreground shrink-0 cursor-pointer opacity-0 transition-all group-hover:opacity-100 hover:text-red-400"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <p className="text-muted-foreground mt-1.5 text-[10px]">
                {new Date(note.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          ))
        )}
      </div>
    </>
  );

  const customContent = (
    <>
      {loadingCustom ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
        </div>
      ) : customFields.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-xs">
          {t('noCustomFields')}
        </p>
      ) : (
        <div className="space-y-3">
          {customFields.map((field) => {
            const rawOptions = field.field_options;
            const isSelect =
              field.field_type === 'select' &&
              Array.isArray(rawOptions) &&
              (rawOptions as unknown[]).length > 0;
            const options = isSelect ? (rawOptions as unknown as string[]) : [];
            return (
              <div key={field.id} className="space-y-1.5">
                <Label className="text-muted-foreground text-xs capitalize">
                  {field.field_name}
                </Label>
                {isSelect ? (
                  <Select
                    value={customValues[field.id] ?? ''}
                    onValueChange={(val: string | null) =>
                      setCustomValues((prev) => ({
                        ...prev,
                        [field.id]: val ?? '',
                      }))
                    }
                  >
                    <SelectTrigger className="bg-muted/40 border-border text-foreground h-8 text-xs">
                      <SelectValue
                        placeholder={`Select ${field.field_name}...`}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={customValues[field.id] ?? ''}
                    onChange={(e) =>
                      setCustomValues((prev) => ({
                        ...prev,
                        [field.id]: e.target.value,
                      }))
                    }
                    placeholder={t('enterCustomField', {
                      name: field.field_name,
                    })}
                    className="bg-muted/40 border-border text-foreground placeholder:text-muted-foreground h-8 text-xs"
                  />
                )}
              </div>
            );
          })}
          <Button
            onClick={saveCustomFields}
            disabled={savingCustom}
            className="bg-primary hover:bg-primary/90 text-primary-foreground w-full text-xs"
            size="sm"
          >
            {savingCustom ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            {t('saveCustomFieldsBtn')}
          </Button>
        </div>
      )}
    </>
  );

  const dealsContent = (
    <>
      {loadingDeals ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="text-primary size-5 animate-spin" />
        </div>
      ) : deals.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-xs">
          {t('dealsTab.noDeals')}
        </p>
      ) : (
        <div className="space-y-2">
          {deals.map((deal) => (
            <div
              key={deal.id}
              className="border-border bg-card rounded-xl border p-3.5 shadow-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-foreground text-xs font-semibold">
                  {deal.title}
                </p>
                {deal.stage && (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${deal.stage.color}20`,
                      color: deal.stage.color,
                    }}
                  >
                    {deal.stage.name}
                  </span>
                )}
              </div>
              <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
                <span className="text-primary flex items-center gap-1 font-bold">
                  <IndianRupee className="size-3" />
                  {deal.currency === 'INR' ||
                  (!deal.currency && defaultCurrency === 'INR')
                    ? formatINR(deal.value ?? 0)
                    : formatCurrency(
                        deal.value ?? 0,
                        deal.currency || defaultCurrency
                      )}
                </span>
                {deal.status && deal.status !== 'open' && (
                  <span
                    className={
                      deal.status === 'won'
                        ? 'text-emerald-500'
                        : 'text-red-400'
                    }
                  >
                    {deal.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const matchContent = (
    <>
      {loadingMatches ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="text-primary size-5 animate-spin" />
        </div>
      ) : matchedProperties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-muted-foreground text-xs">
            {t('matchTab.noMatches')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {matchedProperties.map((property) => (
            <div
              key={property.id}
              className="border-border/80 bg-card rounded-xl border p-3.5 shadow-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-foreground text-xs font-semibold">
                    {property.title}
                  </h4>
                  <p className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                    {property.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="text-primary size-3" />
                        {property.location}
                      </span>
                    )}
                    {property.property_type && (
                      <span>• {property.property_type}</span>
                    )}
                  </p>
                </div>
                {property.price && (
                  <span className="bg-primary/10 text-primary rounded px-2 py-0.5 text-xs font-bold">
                    {defaultCurrency === 'INR'
                      ? formatINR(property.price)
                      : formatCurrency(property.price, defaultCurrency)}
                  </span>
                )}
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSendPropertyMatch(property)}
                  disabled={sendingTemplate}
                  className="h-7 text-xs"
                >
                  <Send className="mr-1.5 size-3" />
                  {t('matchTab.sendViaWhatsapp')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="bg-popover border-border text-popover-foreground flex w-full flex-col p-0 sm:max-w-xl"
        >
          {loading || !contact ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="text-primary size-6 animate-spin" />
            </div>
          ) : (
            <div className="flex h-full flex-col overflow-hidden">
              {/* Header */}
              <SheetHeader className="border-border/50 border-b p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="size-12 shrink-0">
                    <AvatarFallback
                      className="text-sm font-semibold text-white"
                      style={{
                        background: avatarColorForName(contact.name),
                      }}
                    >
                      {initialsForName(contact.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-popover-foreground truncate text-base font-bold">
                      {contact.name || t('unnamed')}
                    </SheetTitle>
                    <SheetDescription className="text-muted-foreground mt-0.5 text-xs">
                      {t('contactDetailsDesc')}
                    </SheetDescription>
                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-xs">
                      <button
                        onClick={copyPhone}
                        className="hover:text-primary flex cursor-pointer items-center gap-1 font-mono font-medium transition-colors"
                      >
                        <Phone className="size-3" />
                        {contactHandle(contact)}
                        {copiedPhone ? (
                          <Check className="text-primary size-3" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                      {contact.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="size-3" />
                          {contact.email}
                        </span>
                      )}
                      {contact.company && (
                        <span className="flex items-center gap-1">
                          <Building2 className="size-3" />
                          {contact.company}
                        </span>
                      )}
                    </div>
                    {(conversation?.first_unanswered_at || assignee) && (
                      <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
                        {conversation?.first_unanswered_at && (
                          <SlaBadge
                            firstUnansweredAt={conversation.first_unanswered_at}
                          />
                        )}
                        {assignee && (
                          <button
                            onClick={fetchAssignmentHistory}
                            className="bg-muted hover:bg-muted/80 border-border flex cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] transition-colors"
                          >
                            <User className="size-3" />
                            {t('assignedTo')}
                            <span className="text-foreground font-medium">
                              {assignee.full_name}
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-1">
                  {onEdit && contact && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onOpenChange(false);
                        onEdit(contact);
                      }}
                      className="border-border text-foreground hover:bg-muted h-7.5 px-2.5 text-xs"
                    >
                      <Pencil className="text-primary mr-1.5 size-3.5" />
                      {t('editLeadBtn')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingVisit(undefined);
                      setScheduleVisitOpen(true);
                    }}
                    className="border-border text-foreground hover:bg-muted h-7.5 px-2.5 text-xs"
                  >
                    <Calendar className="text-primary mr-1.5 size-3.5" />
                    {t('scheduleVisitBtn')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={`/inbox?contact=${contact.id}`} />}
                    className="border-border text-foreground hover:bg-muted h-7.5 px-2.5 text-xs"
                  >
                    <MessageCircle className="mr-1.5 size-3.5 text-emerald-600" />
                    {t('chatInInboxBtn')}
                  </Button>
                  {contact.phone && (
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<a href={`tel:${contact.phone}`} />}
                      className="border-border text-foreground hover:bg-muted h-7.5 px-2.5 text-xs"
                    >
                      <Phone className="mr-1.5 size-3.5 text-blue-600" />
                      {t('callBtn')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => setTemplatePickerOpen(true)}
                    disabled={sendingTemplate}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 h-7.5 px-2.5 text-xs"
                  >
                    {sendingTemplate ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <LayoutTemplate className="mr-1 size-3.5" />
                    )}
                    {t('sendTemplateBtn')}
                  </Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger
                        onClick={() => {
                          if (hasCostSheet) setCostSheetModalOpen(true);
                        }}
                        disabled={!hasCostSheet}
                        className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-7.5 items-center justify-center rounded-md border px-2.5 text-xs font-medium shadow-xs transition-colors disabled:pointer-events-none disabled:opacity-50"
                      >
                        <Zap className="mr-1 size-3.5 text-emerald-500" />
                        Cost Sheet
                      </TooltipTrigger>
                      {!hasCostSheet && (
                        <TooltipContent>
                          Set up your Cost Sheet in Settings -&gt; Cost Sheet
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </SheetHeader>

              {/* Mobile View: Stacked Sections */}
              <div className="flex flex-col gap-5 overflow-y-auto p-4 md:hidden">
                <section>
                  <h3 className="text-foreground mb-2 font-semibold">
                    {t('tabs.details')}
                  </h3>
                  {detailsContent}
                </section>
                <section>
                  <h3 className="text-foreground mb-2 font-semibold">
                    {t('tabs.visits')} ({visits.length})
                  </h3>
                  {visitsContent}
                </section>
                <section>
                  <h3 className="text-foreground mb-2 font-semibold">
                    {t('tabs.deals')}
                  </h3>
                  {dealsContent}
                </section>
                <section>
                  <h3 className="text-foreground mb-2 font-semibold">Tasks</h3>
                  <TasksWidget contactId={contactId || undefined} />
                </section>
                <section>
                  <h3 className="text-foreground mb-2 font-semibold">
                    {t('tabs.notes')}
                  </h3>
                  {notesContent}
                </section>
                <section>
                  <h3 className="text-foreground mb-2 font-semibold">
                    {t('tabs.match')}
                  </h3>
                  {matchContent}
                </section>
                <section>
                  <h3 className="text-foreground mb-2 font-semibold">
                    {t('tabs.tags')}
                  </h3>
                  {tagsContent}
                </section>
                <section>
                  <h3 className="text-foreground mb-2 font-semibold">
                    {t('tabs.custom')}
                  </h3>
                  {customContent}
                </section>
              </div>

              {/* Desktop View: Tabs */}
              <Tabs
                defaultValue="details"
                className="hidden min-h-0 flex-1 flex-col md:flex"
              >
                <TabsList className="bg-muted/40 border-border mx-4 mt-2.5 h-auto flex-wrap gap-1 border-b pb-1">
                  <TabsTrigger
                    value="details"
                    className="data-active:bg-background data-active:text-primary text-muted-foreground text-xs"
                  >
                    {t('tabs.details')}
                  </TabsTrigger>
                  <TabsTrigger
                    value="visits"
                    className="data-active:bg-background data-active:text-primary text-muted-foreground flex items-center gap-1.5 text-xs"
                  >
                    <span>{t('tabs.visits')}</span>
                    {visits.length > 0 && (
                      <span className="bg-primary/10 text-primary flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold">
                        {visits.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="deals"
                    className="data-active:bg-background data-active:text-primary text-muted-foreground text-xs"
                  >
                    {t('tabs.deals')}
                  </TabsTrigger>
                  <TabsTrigger
                    value="tasks"
                    className="data-active:bg-background data-active:text-primary text-muted-foreground flex items-center gap-1.5 text-xs"
                  >
                    <span>Tasks</span>
                    {taskCount > 0 && (
                      <span className="bg-primary/10 text-primary flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold">
                        {taskCount}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="notes"
                    className="data-active:bg-background data-active:text-primary text-muted-foreground text-xs"
                  >
                    {t('tabs.notes')}
                  </TabsTrigger>
                  <TabsTrigger
                    value="match"
                    className="data-active:bg-background data-active:text-primary text-muted-foreground text-xs"
                  >
                    {t('tabs.match')}
                  </TabsTrigger>
                  <TabsTrigger
                    value="tags"
                    className="data-active:bg-background data-active:text-primary text-muted-foreground text-xs"
                  >
                    {t('tabs.tags')}
                  </TabsTrigger>
                  <TabsTrigger
                    value="custom"
                    className="data-active:bg-background data-active:text-primary text-muted-foreground text-xs"
                  >
                    {t('tabs.custom')}
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  value="details"
                  className="flex-1 overflow-y-auto px-4 py-3"
                >
                  {detailsContent}
                </TabsContent>

                <TabsContent
                  value="visits"
                  className="flex-1 overflow-y-auto px-4 py-3"
                >
                  {visitsContent}
                </TabsContent>

                <TabsContent
                  value="deals"
                  className="flex-1 overflow-y-auto px-4 py-3"
                >
                  {dealsContent}
                </TabsContent>

                <TabsContent
                  value="tasks"
                  className="flex-1 overflow-y-auto px-4 py-3"
                >
                  <TasksWidget contactId={contactId || undefined} />
                </TabsContent>

                <TabsContent
                  value="notes"
                  className="flex min-h-0 flex-1 flex-col px-4 py-3"
                >
                  {notesContent}
                </TabsContent>

                <TabsContent
                  value="match"
                  className="flex-1 overflow-y-auto px-4 py-3"
                >
                  {matchContent}
                </TabsContent>

                <TabsContent
                  value="tags"
                  className="flex-1 overflow-y-auto px-4 py-3"
                >
                  {tagsContent}
                </TabsContent>

                <TabsContent
                  value="custom"
                  className="flex-1 overflow-y-auto px-4 py-3"
                >
                  {customContent}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Assignment History Sheet */}
      <Sheet
        open={assignmentHistoryOpen}
        onOpenChange={setAssignmentHistoryOpen}
      >
        <SheetContent
          side="right"
          className="bg-popover border-border text-popover-foreground flex w-full flex-col p-0 sm:max-w-md"
        >
          <SheetHeader className="border-border/50 border-b p-4">
            <SheetTitle className="text-popover-foreground flex items-center gap-2 text-sm font-semibold">
              <History className="size-4" />
              {t('assignmentHistoryTitle')}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground size-5 animate-spin" />
              </div>
            ) : assignmentHistory.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-xs">
                {t('noAssignmentHistory')}
              </p>
            ) : (
              <div className="space-y-3">
                {assignmentHistory.map((record) => (
                  <div
                    key={record.id}
                    className="bg-card border-border/80 rounded-xl border p-3 shadow-xs"
                  >
                    <p className="text-foreground text-xs font-semibold">
                      {record.to_agent
                        ? record.to_agent.full_name
                        : 'Unassigned'}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      From:{' '}
                      {record.from_agent
                        ? record.from_agent.full_name
                        : 'Unassigned'}
                    </p>
                    <div className="text-muted-foreground border-border/50 mt-2 flex items-center justify-between border-t pt-2 text-[10px]">
                      <span>
                        Reason:{' '}
                        <span className="font-medium">{record.reason}</span>
                      </span>
                      <span>
                        {new Date(record.created_at).toLocaleDateString()}{' '}
                        {new Date(record.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <TemplatePicker
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        onSelect={handleSendTemplate}
      />

      <CostSheetModal
        open={costSheetModalOpen}
        onOpenChange={setCostSheetModalOpen}
        contactId={contactId || undefined}
      />

      <ScheduleVisitSheet
        open={scheduleVisitOpen}
        onOpenChange={setScheduleVisitOpen}
        defaultContactId={contact?.id}
        visit={editingVisit}
        onSuccess={() => {
          fetchVisits();
          onUpdated();
        }}
      />
    </>
  );
}
