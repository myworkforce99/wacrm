'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { addContactTag, deleteContactTag } from '@/lib/contacts/tag-api';
import { toast } from 'sonner';
import type { Contact, Tag, ContactTag, Profile } from '@/types';
import { PROPERTY_CONFIGURATIONS } from '@/types';
import {
  findExistingContact,
  isExactMatch,
  isUniqueViolation,
  type ExistingContact,
} from '@/lib/contacts/dedupe';
import { parseInternationalPhone } from '@/lib/whatsapp/phone-utils';
import { parseBudget } from '@/lib/contacts/parse-budget';
import { formatINR, formatINRRange } from '@/lib/currency';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  AlertTriangle,
  MapPin,
  IndianRupee,
  User,
  Tag as TagIcon,
  Sparkles,
  Pencil,
  Building2,
  Mail,
  Phone,
  Check,
  CheckCircle2,
  GitCommit,
  Home,
  Target,
  Clock,
  FileText,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ContactFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  contactTags?: (ContactTag | Tag)[];
  onSaved: () => void;
  /** Open an existing contact's detail view — used by the duplicate
   *  notice to jump to the contact that already owns this number. */
  onViewExisting?: (contactId: string) => void;
}

const KNOWN_SOURCES = [
  '99acres',
  'MagicBricks',
  'Housing.com',
  'NoBroker',
  'Walk-in',
  'Referral',
  'Meta Ads',
  'Google Ads',
  'Manual Entry',
  'Other',
];

const PROPERTY_TYPES = [
  'Apartment',
  'Villa',
  'Plot',
  'Commercial',
  'Penthouse',
  'Builder Floor',
  'Studio',
];

const INTENT_OPTIONS = ['End Use', 'Investment', 'Rental Yield'];

const QUICK_BUDGET_PRESETS = [
  { label: '< ₹50L', min: '', max: '50L' },
  { label: '₹50L – 1Cr', min: '50L', max: '1Cr' },
  { label: '₹1Cr – 2Cr', min: '1Cr', max: '2Cr' },
  { label: '₹2Cr – 5Cr', min: '2Cr', max: '5Cr' },
  { label: '₹5Cr+', min: '5Cr', max: '' },
];

interface PipelineStageItem {
  id: string;
  name: string;
  position: number;
  color?: string;
  pipeline_id: string;
}

export function ContactForm({
  open,
  onOpenChange,
  contact,
  contactTags = [],
  onSaved,
  onViewExisting,
}: ContactFormProps) {
  const t = useTranslations('Contacts.form');
  const supabase = createClient();
  const { accountId } = useAuth();
  const isEdit = !!contact;

  // Basic contact info
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+91');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');

  // Real estate qualification info
  const [source, setSource] = useState('Manual Entry');
  const [otherSource, setOtherSource] = useState('');
  const [locationPreference, setLocationPreference] = useState('');
  const [budgetMinInput, setBudgetMinInput] = useState('');
  const [budgetMaxInput, setBudgetMaxInput] = useState('');
  const [configurationPreference, setConfigurationPreference] = useState<
    string[]
  >([]);
  const [propertyType, setPropertyType] = useState('all');
  const [intent, setIntent] = useState('all');
  const [possessionPreference, setPossessionPreference] = useState('any');

  // Assignment & pipeline stage
  const [assignedAgentId, setAssignedAgentId] = useState('unassigned');
  const [selectedStageId, setSelectedStageId] = useState('');
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [existingDealId, setExistingDealId] = useState<string | null>(null);

  // Notes
  const [noteText, setNoteText] = useState('');

  // Loading & saving states
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);

  // Duplicate-phone detection
  const [dupMatch, setDupMatch] = useState<{
    contact: ExistingContact;
    exact: boolean;
  } | null>(null);
  const [checkingDup, setCheckingDup] = useState(false);

  // Reference data
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [stages, setStages] = useState<PipelineStageItem[]>([]);

  // Fetch reference data (tags, profiles, pipeline stages)
  const fetchReferenceData = useCallback(async () => {
    setLoadingTags(true);
    const [tagsRes, profilesRes, pipelinesRes] = await Promise.all([
      supabase.from('tags').select('*').order('name'),
      supabase
        .from('profiles')
        .select('id, user_id, full_name, email, account_role')
        .order('full_name'),
      supabase
        .from('pipelines')
        .select('id, name, pipeline_stages(id, name, position, color)')
        .order('position', {
          referencedTable: 'pipeline_stages',
          ascending: true,
        }),
    ]);

    if (tagsRes.data) setTags(tagsRes.data);
    if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);

    if (pipelinesRes.data && pipelinesRes.data.length > 0) {
      const flattenedStages: PipelineStageItem[] = [];
      for (const p of pipelinesRes.data) {
        if (p.pipeline_stages && Array.isArray(p.pipeline_stages)) {
          for (const s of p.pipeline_stages) {
            flattenedStages.push({
              id: s.id,
              name: s.name,
              position: s.position,
              color: s.color,
              pipeline_id: p.id,
            });
          }
        }
      }
      setStages(flattenedStages);
      if (!selectedPipelineId && pipelinesRes.data[0]?.id) {
        setSelectedPipelineId(pipelinesRes.data[0].id);
      }
    }
    setLoadingTags(false);
  }, [supabase, selectedPipelineId]);

  // Fetch lead details, deals and tags for existing contact
  const fetchExistingLeadData = useCallback(
    async (contactItem: Contact) => {
      setLoadingData(true);
      try {
        // 1. Fetch lead details
        const { data: ld } = await supabase
          .from('lead_details')
          .select(
            'source, configuration_preference, possession_preference, location_preference, budget_min, budget_max, property_type, intent'
          )
          .eq('contact_id', contactItem.id)
          .maybeSingle();

        if (ld) {
          if (ld.source) {
            if (KNOWN_SOURCES.includes(ld.source)) {
              setSource(ld.source);
              setOtherSource('');
            } else {
              setSource('Other');
              setOtherSource(ld.source);
            }
          } else {
            setSource('Manual Entry');
          }

          setLocationPreference(ld.location_preference ?? '');
          setBudgetMinInput(
            ld.budget_min ? formatINR(ld.budget_min).replace('₹', '') : ''
          );
          setBudgetMaxInput(
            ld.budget_max ? formatINR(ld.budget_max).replace('₹', '') : ''
          );
          setConfigurationPreference(ld.configuration_preference || []);
          setPossessionPreference(ld.possession_preference || 'any');
          setPropertyType(ld.property_type || 'all');
          setIntent(ld.intent || 'all');
        } else {
          setSource('Manual Entry');
          setOtherSource('');
          setLocationPreference('');
          setBudgetMinInput('');
          setBudgetMaxInput('');
          setConfigurationPreference([]);
          setPossessionPreference('any');
          setPropertyType('all');
          setIntent('all');
        }

        // 2. Fetch contact's tags directly
        const { data: ctData } = await supabase
          .from('contact_tags')
          .select('tag_id')
          .eq('contact_id', contactItem.id);
        if (ctData) {
          setSelectedTagIds(ctData.map((ct) => ct.tag_id));
        } else {
          setSelectedTagIds(
            contactTags.map((ct) => ('tag_id' in ct ? ct.tag_id : ct.id))
          );
        }

        // 3. Fetch deal for stage and assignment
        const { data: deal } = await supabase
          .from('deals')
          .select(
            'id, pipeline_id, stage_id, status, assigned_to, title, value'
          )
          .eq('contact_id', contactItem.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (deal) {
          setExistingDealId(deal.id);
          setSelectedPipelineId(deal.pipeline_id);
          setSelectedStageId(deal.stage_id);
          if (deal.assigned_to) {
            setAssignedAgentId(deal.assigned_to);
          } else {
            setAssignedAgentId('unassigned');
          }
        } else {
          setExistingDealId(null);
          setSelectedStageId('');
          // Fall back to conversation assigned_agent_id
          const { data: conv } = await supabase
            .from('conversations')
            .select('id, assigned_agent_id')
            .eq('contact_id', contactItem.id)
            .maybeSingle();

          if (conv?.assigned_agent_id) {
            // Find matching profile by user_id
            const { data: prof } = await supabase
              .from('profiles')
              .select('id')
              .eq('user_id', conv.assigned_agent_id)
              .maybeSingle();
            if (prof) {
              setAssignedAgentId(prof.id);
            } else {
              setAssignedAgentId('unassigned');
            }
          } else {
            setAssignedAgentId('unassigned');
          }
        }
      } catch (err) {
        console.error('Error fetching lead details for edit:', err);
      } finally {
        setLoadingData(false);
      }
    },
    [supabase, contactTags]
  );

  useEffect(() => {
    if (open) {
      setName(contact?.name ?? '');
      setPhone(contact?.phone ?? '+91');
      setEmail(contact?.email ?? '');
      setCompany(contact?.company ?? '');
      setDupMatch(null);
      setNoteText('');
      void fetchReferenceData();

      if (contact?.id) {
        void fetchExistingLeadData(contact);
      } else {
        setSource('Manual Entry');
        setOtherSource('');
        setLocationPreference('');
        setBudgetMinInput('');
        setBudgetMaxInput('');
        setConfigurationPreference([]);
        setPropertyType('all');
        setIntent('all');
        setPossessionPreference('any');
        setAssignedAgentId('unassigned');
        setSelectedStageId('');
        setSelectedTagIds([]);
        setExistingDealId(null);
      }
    }
  }, [open, contact, fetchReferenceData, fetchExistingLeadData]);

  async function checkDuplicate() {
    if (!accountId) return;
    const value = phone.trim();
    if (!value) {
      setDupMatch(null);
      return;
    }
    // In edit mode, if phone didn't change from contact.phone, skip dup check
    if (isEdit && contact?.phone && value === contact.phone.trim()) {
      setDupMatch(null);
      return;
    }

    setCheckingDup(true);
    try {
      const existing = await findExistingContact(supabase, accountId, value);
      // Ensure we don't flag the contact itself as a duplicate
      if (existing && isEdit && contact?.id && existing.id === contact.id) {
        setDupMatch(null);
      } else {
        setDupMatch(
          existing
            ? { contact: existing, exact: isExactMatch(existing, value) }
            : null
        );
      }
    } finally {
      setCheckingDup(false);
    }
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  }

  const parsedMin = useMemo(
    () => parseBudget(budgetMinInput),
    [budgetMinInput]
  );
  const parsedMax = useMemo(
    () => parseBudget(budgetMaxInput),
    [budgetMaxInput]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error(t('nameLabel') + ' is required');
      return;
    }

    if (!phone.trim()) {
      toast.error(t('phoneRequired'));
      return;
    }

    const phoneChanged = !isEdit || phone.trim() !== (contact?.phone ?? '');
    if (phoneChanged && !parseInternationalPhone(phone)) {
      toast.error(t('phoneNeedsCountryCode'));
      return;
    }

    if (phoneChanged && dupMatch?.exact) {
      toast.error(t('toastConflict'));
      return;
    }

    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');
      if (!accountId)
        throw new Error('Your profile is not linked to an account.');

      let contactId = contact?.id;

      // 1. Save Contact record
      if (isEdit && contactId) {
        const { error: contactErr } = await supabase
          .from('contacts')
          .update({
            name: name.trim() || null,
            phone: phone.trim(),
            email: email.trim() || null,
            company: company.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', contactId);
        if (contactErr) throw contactErr;
      } else {
        const { data: newContact, error: createErr } = await supabase
          .from('contacts')
          .insert({
            user_id: user.id,
            account_id: accountId,
            name: name.trim() || null,
            phone: phone.trim(),
            email: email.trim() || null,
            company: company.trim() || null,
          })
          .select('id')
          .single();
        if (createErr) throw createErr;
        contactId = newContact.id;
      }

      if (!contactId) throw new Error('Failed to resolve contact ID');

      // 2. Upsert Real Estate Lead Details
      const actualSource = source === 'Other' ? otherSource.trim() : source;
      const { error: ldError } = await supabase.from('lead_details').upsert(
        {
          account_id: accountId,
          contact_id: contactId,
          source: actualSource || 'Manual Entry',
          location_preference: locationPreference.trim() || null,
          budget_min: parsedMin ?? null,
          budget_max: parsedMax ?? null,
          configuration_preference: configurationPreference,
          possession_preference: possessionPreference || 'any',
          property_type: propertyType === 'all' ? null : propertyType,
          intent: intent === 'all' ? null : intent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'contact_id' }
      );
      if (ldError) throw ldError;

      // 3. Sync Tags accurately against DB
      const { data: currentTags } = await supabase
        .from('contact_tags')
        .select('tag_id')
        .eq('contact_id', contactId);
      const currentTagIds = new Set((currentTags || []).map((t) => t.tag_id));
      const desiredTagIds = new Set(selectedTagIds);
      const toRemove = [...currentTagIds].filter(
        (id) => !desiredTagIds.has(id)
      );
      const toAdd = [...desiredTagIds].filter((id) => !currentTagIds.has(id));

      for (const tagId of toRemove) {
        await deleteContactTag(contactId, tagId);
      }
      for (const tagId of toAdd) {
        await addContactTag(contactId, tagId);
      }

      // 4. Sync Agent Assignment & Conversation
      const targetProfile =
        assignedAgentId !== 'unassigned'
          ? profiles.find((p) => p.id === assignedAgentId)
          : null;

      const { data: convData } = await supabase
        .from('conversations')
        .select('id, assigned_agent_id')
        .eq('contact_id', contactId)
        .maybeSingle();

      if (convData) {
        const nextAgentUserId = targetProfile ? targetProfile.user_id : null;
        if (convData.assigned_agent_id !== nextAgentUserId) {
          await supabase
            .from('conversations')
            .update({ assigned_agent_id: nextAgentUserId })
            .eq('id', convData.id);

          if (nextAgentUserId) {
            await supabase.from('assignment_history').insert({
              account_id: accountId,
              contact_id: contactId,
              from_agent_id: convData.assigned_agent_id,
              to_agent_id: nextAgentUserId,
              actor_id: user.id,
              reason: isEdit ? 'contact_edit_modal' : 'contact_create_modal',
            });
          }
        }
      }

      // 5. Sync Deal & Pipeline Stage
      const resolvedStageId =
        selectedStageId || (stages.length > 0 ? stages[0].id : null);
      const resolvedPipelineId =
        selectedPipelineId ||
        (stages.length > 0 ? stages[0].pipeline_id : null);

      if (existingDealId) {
        const dealUpdates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (selectedStageId) dealUpdates.stage_id = selectedStageId;
        if (assignedAgentId === 'unassigned') {
          dealUpdates.assigned_to = null;
        } else if (assignedAgentId) {
          dealUpdates.assigned_to = assignedAgentId;
        }
        if (parsedMax || parsedMin) {
          dealUpdates.value = parsedMax || parsedMin || 0;
        }
        await supabase
          .from('deals')
          .update(dealUpdates)
          .eq('id', existingDealId);
      } else if (resolvedStageId && resolvedPipelineId) {
        // Create initial deal if stage or agent assignment was picked
        await supabase.from('deals').insert({
          user_id: user.id,
          pipeline_id: resolvedPipelineId,
          stage_id: resolvedStageId,
          contact_id: contactId,
          assigned_to:
            assignedAgentId !== 'unassigned' ? assignedAgentId : null,
          title: `${name.trim() || phone.trim()} - Requirement`,
          value: parsedMax || parsedMin || 0,
          currency: 'INR',
          status: 'open',
        });
      }

      // 6. Optional: Add Note if provided
      if (noteText.trim()) {
        await supabase.from('contact_notes').insert({
          contact_id: contactId,
          user_id: user.id,
          note_text: noteText.trim(),
        });
      }

      toast.success(isEdit ? t('toastSuccessEdit') : t('toastSuccessAdd'));
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        toast.error(t('toastConflict'));
        if (!isEdit && accountId) {
          const existing = await findExistingContact(
            supabase,
            accountId,
            phone.trim()
          );
          if (existing) setDupMatch({ contact: existing, exact: true });
        }
        return;
      }
      const message = err instanceof Error ? err.message : t('toastError');
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground flex max-h-[92vh] flex-col overflow-hidden rounded-2xl p-0 shadow-2xl sm:max-w-2xl">
        {/* Header */}
        <DialogHeader className="border-border/70 bg-muted/20 shrink-0 border-b p-5 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary border-primary/20 flex size-10 shrink-0 items-center justify-center rounded-xl border">
                {isEdit ? (
                  <Pencil className="size-5" />
                ) : (
                  <Sparkles className="size-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-foreground flex items-center gap-2 text-lg font-semibold tracking-tight">
                  {isEdit ? t('editTitle') : t('addTitle')}
                  {isEdit && (
                    <Badge
                      variant="outline"
                      className="bg-primary/10 text-primary border-primary/25 ml-1 text-[11px] font-normal"
                    >
                      {t('editingLead')}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground mt-0.5 text-xs">
                  {isEdit ? t('editDesc') : t('addDesc')}
                </DialogDescription>
              </div>
            </div>
            {isEdit && contact?.phone && (
              <span className="text-muted-foreground bg-muted/60 border-border hidden items-center gap-1 rounded-md border px-2.5 py-1 text-xs sm:inline-flex">
                <Phone className="text-muted-foreground size-3" />
                {contact.phone}
              </span>
            )}
          </div>
        </DialogHeader>

        {loadingData ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="text-primary size-8 animate-spin" />
            <p className="text-muted-foreground text-xs font-medium">
              Loading lead details...
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6"
          >
            {/* Section 1: Contact Information */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <User className="text-primary size-3.5" />
                  {t('sectionContact')}
                </h4>
                <span className="text-muted-foreground text-[11px]">
                  * Required fields
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cf-name"
                    className="text-foreground text-xs font-medium"
                  >
                    {t('nameLabel')} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="cf-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('namePlaceholder')}
                    className="bg-card border-border text-foreground h-9 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="cf-phone"
                    className="text-foreground text-xs font-medium"
                  >
                    {t('phoneLabel')} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="cf-phone"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (dupMatch) setDupMatch(null);
                    }}
                    onBlur={checkDuplicate}
                    placeholder={t('phonePlaceholder')}
                    className="bg-card border-border text-foreground h-9 text-xs"
                    required
                  />
                </div>
              </div>

              {dupMatch && (
                <div
                  className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs ${
                    dupMatch.exact
                      ? 'border-red-500/30 bg-red-500/10 text-red-500 dark:text-red-400'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium">
                      {dupMatch.exact ? t('dupExact') : t('dupSimilar')}
                    </p>
                    {onViewExisting && (
                      <button
                        type="button"
                        onClick={() => onViewExisting(dupMatch.contact.id)}
                        className="cursor-pointer font-medium underline underline-offset-2 hover:opacity-80"
                      >
                        {t('viewExisting', {
                          name: dupMatch.contact.name || dupMatch.contact.phone,
                        })}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cf-email"
                    className="text-foreground flex items-center gap-1 text-xs font-medium"
                  >
                    <Mail className="text-muted-foreground size-3" />
                    {t('emailLabel')}
                  </Label>
                  <Input
                    id="cf-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    className="bg-card border-border text-foreground h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="cf-company"
                    className="text-foreground flex items-center gap-1 text-xs font-medium"
                  >
                    <Building2 className="text-muted-foreground size-3" />
                    {t('companyLabel')} / Designation
                  </Label>
                  <Input
                    id="cf-company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder={t('companyPlaceholder')}
                    className="bg-card border-border text-foreground h-9 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Real Estate Requirements */}
            <div className="border-border/60 space-y-4 border-t pt-3">
              <div className="flex items-center justify-between">
                <h4 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <Home className="text-primary size-3.5" />
                  {t('sectionPreferences')}
                </h4>
                {(parsedMin !== null || parsedMax !== null) && (
                  <Badge
                    variant="outline"
                    className="bg-primary/10 text-primary border-primary/20 flex items-center gap-1 text-[11px] font-semibold"
                  >
                    <IndianRupee className="size-3" />
                    {formatINRRange(parsedMin, parsedMax)}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cf-source"
                    className="text-foreground text-xs font-medium"
                  >
                    {t('sourceLabel')}
                  </Label>
                  <Select
                    value={source}
                    onValueChange={(val) => setSource(val || 'Manual Entry')}
                  >
                    <SelectTrigger
                      id="cf-source"
                      className="bg-card border-border text-foreground h-9 w-full text-xs"
                    >
                      <SelectValue placeholder={t('sourcePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {KNOWN_SOURCES.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {source === 'Other' && (
                    <Input
                      value={otherSource}
                      onChange={(e) => setOtherSource(e.target.value)}
                      placeholder="Specify source name..."
                      className="bg-card border-border text-foreground mt-2 h-8 text-xs"
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="cf-location"
                    className="text-foreground flex items-center gap-1 text-xs font-medium"
                  >
                    <MapPin className="text-primary size-3" />
                    {t('locationLabel')}
                  </Label>
                  <Input
                    id="cf-location"
                    value={locationPreference}
                    onChange={(e) => setLocationPreference(e.target.value)}
                    placeholder={t('locationPlaceholder')}
                    className="bg-card border-border text-foreground h-9 text-xs"
                  />
                </div>
              </div>

              {/* Budget Range & Quick Presets */}
              <div className="bg-muted/30 border-border/70 space-y-2 rounded-xl border p-3.5">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground flex items-center gap-1 text-xs font-medium">
                    <IndianRupee className="text-primary size-3" />
                    {t('budgetMinLabel')}
                  </Label>
                  <span className="text-muted-foreground font-mono text-[11px]">
                    Supports &quot;50L&quot;, &quot;1.5Cr&quot;, or raw numbers
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    value={budgetMinInput}
                    onChange={(e) => setBudgetMinInput(e.target.value)}
                    placeholder={t('budgetMinPlaceholder')}
                    className="bg-card border-border text-foreground h-8.5 text-xs"
                  />
                  <Input
                    value={budgetMaxInput}
                    onChange={(e) => setBudgetMaxInput(e.target.value)}
                    placeholder={t('budgetMaxPlaceholder')}
                    className="bg-card border-border text-foreground h-8.5 text-xs"
                  />
                </div>

                {/* Quick Budget Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-muted-foreground mr-1 text-[11px]">
                    {t('quickBudgets')}:
                  </span>
                  {QUICK_BUDGET_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setBudgetMinInput(preset.min);
                        setBudgetMaxInput(preset.max);
                      }}
                      className="bg-card hover:bg-muted text-muted-foreground hover:text-foreground border-border cursor-pointer rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Property Type & Buyer Intent */}
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cf-property-type"
                    className="text-foreground flex items-center gap-1 text-xs font-medium"
                  >
                    <Building2 className="text-primary size-3" />
                    {t('propertyTypeLabel')}
                  </Label>
                  <Select
                    value={propertyType}
                    onValueChange={(val) => setPropertyType(val || 'all')}
                  >
                    <SelectTrigger
                      id="cf-property-type"
                      className="bg-card border-border text-foreground h-9 w-full text-xs"
                    >
                      <SelectValue placeholder={t('propertyTypePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">
                        All Property Types
                      </SelectItem>
                      {PROPERTY_TYPES.map((pt) => (
                        <SelectItem key={pt} value={pt} className="text-xs">
                          {pt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="cf-intent"
                    className="text-foreground flex items-center gap-1 text-xs font-medium"
                  >
                    <Target className="text-primary size-3" />
                    {t('intentLabel')}
                  </Label>
                  <Select
                    value={intent}
                    onValueChange={(val) => setIntent(val || 'all')}
                  >
                    <SelectTrigger
                      id="cf-intent"
                      className="bg-card border-border text-foreground h-9 w-full text-xs"
                    >
                      <SelectValue placeholder={t('intentPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">
                        Any Intent
                      </SelectItem>
                      {INTENT_OPTIONS.map((io) => (
                        <SelectItem key={io} value={io} className="text-xs">
                          {io}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Configuration / BHK Preference */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground text-xs font-medium">
                    {t('configLabel')}
                  </Label>
                  {configurationPreference.length > 0 && (
                    <span className="text-primary text-[11px] font-medium">
                      {configurationPreference.length} selected
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PROPERTY_CONFIGURATIONS.map((config) => {
                    const isSelected = configurationPreference.includes(config);
                    return (
                      <button
                        key={config}
                        type="button"
                        onClick={() => {
                          setConfigurationPreference((prev) =>
                            prev.includes(config)
                              ? prev.filter((c) => c !== config)
                              : [...prev, config]
                          );
                        }}
                        className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground font-semibold shadow-xs'
                            : 'bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {isSelected && <Check className="size-3" />}
                        {config}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Possession Preference */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="cf-possession"
                  className="text-foreground flex items-center gap-1 text-xs font-medium"
                >
                  <Clock className="text-primary size-3" />
                  {t('possessionLabel')}
                </Label>
                <Select
                  value={possessionPreference}
                  onValueChange={(val) => setPossessionPreference(val || 'any')}
                >
                  <SelectTrigger
                    id="cf-possession"
                    className="bg-card border-border text-foreground h-9 w-full text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any" className="text-xs">
                      {t('possessionAny')}
                    </SelectItem>
                    <SelectItem value="ready_to_move_only" className="text-xs">
                      {t('possessionReady')}
                    </SelectItem>
                    <SelectItem
                      value="under_construction_ok"
                      className="text-xs"
                    >
                      {t('possessionUnderConstruction')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Section 3: Assignment & Pipeline Stage */}
            <div className="border-border/60 space-y-4 border-t pt-3">
              <h4 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                <GitCommit className="text-primary size-3.5" />
                {t('sectionAssignment')}
              </h4>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {/* Assign to Agent */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cf-agent"
                    className="text-foreground flex items-center gap-1 text-xs font-medium"
                  >
                    <User className="text-primary size-3" />
                    {t('agentLabel')}
                  </Label>
                  <Select
                    value={assignedAgentId}
                    onValueChange={(val) =>
                      setAssignedAgentId(val || 'unassigned')
                    }
                  >
                    <SelectTrigger
                      id="cf-agent"
                      className="bg-card border-border text-foreground h-9 w-full text-xs"
                    >
                      <SelectValue placeholder={t('agentPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned" className="text-xs">
                        {t('unassigned')}
                      </SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.full_name} ({p.account_role || 'agent'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Pipeline Stage */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cf-stage"
                    className="text-foreground flex items-center gap-1 text-xs font-medium"
                  >
                    <CheckCircle2 className="text-primary size-3" />
                    {t('pipelineStageLabel')}
                  </Label>
                  <Select
                    value={selectedStageId}
                    onValueChange={(val) => setSelectedStageId(val || '')}
                  >
                    <SelectTrigger
                      id="cf-stage"
                      className="bg-card border-border text-foreground h-9 w-full text-xs"
                    >
                      <SelectValue
                        placeholder={t('pipelineStagePlaceholder')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">
                          <span className="flex items-center gap-2">
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{
                                backgroundColor: s.color || '#3b82f6',
                              }}
                            />
                            {s.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tags Selector */}
              <div className="space-y-2">
                <Label className="text-foreground flex items-center gap-1 text-xs font-medium">
                  <TagIcon className="text-primary size-3" />
                  {t('tagsLabel')}
                </Label>
                {loadingTags ? (
                  <div className="text-muted-foreground flex items-center gap-2 py-1 text-xs">
                    <Loader2 className="size-3 animate-spin" />
                    {t('loadingTags')}
                  </div>
                ) : tags.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    {t('noTagsAvailable')}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => {
                      const selected = selectedTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                            selected
                              ? 'ring-primary ring-offset-background font-semibold shadow-xs ring-2 ring-offset-1'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                          style={{
                            backgroundColor: tag.color + '20',
                            color: tag.color,
                            borderColor: tag.color + '50',
                          }}
                        >
                          {selected && <Check className="size-3" />}
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Internal Notes */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="cf-note"
                  className="text-foreground flex items-center gap-1 text-xs font-medium"
                >
                  <FileText className="text-primary size-3" />
                  {isEdit ? t('notesLabelEdit') : t('notesLabel')}
                </Label>
                <Textarea
                  id="cf-note"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={
                    isEdit ? t('notesPlaceholderEdit') : t('notesPlaceholder')
                  }
                  className="bg-card border-border text-foreground min-h-[70px] resize-y text-xs"
                />
              </div>
            </div>

            {/* Footer */}
            <DialogFooter className="bg-muted/20 border-border/70 -mx-6 mt-6 -mb-6 flex shrink-0 flex-row items-center justify-between border-t p-4 sm:justify-between">
              <span className="text-muted-foreground hidden text-[11px] sm:inline">
                {t('requiredHint')}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="border-border text-muted-foreground hover:bg-muted h-9 text-xs"
                >
                  {t('cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={saving || checkingDup || !!dupMatch?.exact}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 text-xs font-medium shadow-xs"
                >
                  {saving && (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  )}
                  {isEdit ? t('saveChanges') : t('create')}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
