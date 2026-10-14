'use client';

import { useState, useEffect } from 'react';
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
import { formatINR } from '@/lib/currency';
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
} from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ContactFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  contactTags?: ContactTag[];
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
  const [configurationPreference, setConfigurationPreference] = useState<string[]>([]);
  const [possessionPreference, setPossessionPreference] = useState('any');

  // Assignment & internal notes
  const [assignedAgentId, setAssignedAgentId] = useState('');
  const [initialNote, setInitialNote] = useState('');

  const [saving, setSaving] = useState(false);

  // Duplicate-phone detection for NEW contacts
  const [dupMatch, setDupMatch] = useState<{
    contact: ExistingContact;
    exact: boolean;
  } | null>(null);
  const [checkingDup, setCheckingDup] = useState(false);

  // Metadata
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    if (open) {
      setName(contact?.name ?? '');
      setPhone(contact?.phone ?? '+91');
      setEmail(contact?.email ?? '');
      setCompany(contact?.company ?? '');
      setSelectedTagIds(contactTags.map((ct) => ct.tag_id));
      setDupMatch(null);
      setInitialNote('');
      fetchTags();
      fetchProfiles();

      if (contact?.id) {
        fetchLeadDetails(contact.id);
      } else {
        setSource('Manual Entry');
        setOtherSource('');
        setLocationPreference('');
        setBudgetMinInput('');
        setBudgetMaxInput('');
        setConfigurationPreference([]);
        setPossessionPreference('any');
        setAssignedAgentId('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contact]);

  async function checkDuplicate() {
    if (isEdit || !accountId) return;
    const value = phone.trim();
    if (!value) {
      setDupMatch(null);
      return;
    }
    setCheckingDup(true);
    try {
      const existing = await findExistingContact(supabase, accountId, value);
      setDupMatch(
        existing
          ? { contact: existing, exact: isExactMatch(existing, value) }
          : null
      );
    } finally {
      setCheckingDup(false);
    }
  }

  async function fetchLeadDetails(contactId: string) {
    const { data } = await supabase
      .from('lead_details')
      .select('source, configuration_preference, possession_preference, location_preference, budget_min, budget_max')
      .eq('contact_id', contactId)
      .maybeSingle();

    if (data) {
      if (data.source) {
        if (KNOWN_SOURCES.includes(data.source)) {
          setSource(data.source);
          setOtherSource('');
        } else {
          setSource('Other');
          setOtherSource(data.source);
        }
      } else {
        setSource('Manual Entry');
      }

      setLocationPreference(data.location_preference ?? '');
      setBudgetMinInput(data.budget_min ? String(data.budget_min) : '');
      setBudgetMaxInput(data.budget_max ? String(data.budget_max) : '');
      setConfigurationPreference(data.configuration_preference || []);
      setPossessionPreference(data.possession_preference || 'any');
    }
  }

  async function fetchTags() {
    setLoadingTags(true);
    const { data } = await supabase.from('tags').select('*').order('name');
    if (data) setTags(data);
    setLoadingTags(false);
  }

  async function fetchProfiles() {
    const { data } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, email, account_role')
      .order('full_name');
    if (data) setProfiles(data as Profile[]);
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  const parsedMin = parseBudget(budgetMinInput);
  const parsedMax = parseBudget(budgetMaxInput);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!phone.trim()) {
      toast.error(t('phoneRequired'));
      return;
    }

    const phoneChanged = !isEdit || phone.trim() !== (contact?.phone ?? '');
    if (phoneChanged && !parseInternationalPhone(phone)) {
      toast.error(t('phoneNeedsCountryCode'));
      return;
    }

    if (!isEdit && dupMatch?.exact) {
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
      if (!accountId) throw new Error('Your profile is not linked to an account.');

      let contactId = contact?.id;

      if (isEdit && contactId) {
        const { error } = await supabase
          .from('contacts')
          .update({
            name: name.trim() || null,
            phone: phone.trim(),
            email: email.trim() || null,
            company: company.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', contactId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
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
        if (error) throw error;
        contactId = data.id;
      }

      // Upsert lead details (source, budget, location, configuration, possession)
      if (contactId) {
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
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'contact_id' }
        );
        if (ldError) throw ldError;
      }

      // Sync tags
      if (contactId) {
        const existingTagIds = new Set(contactTags.map((tag) => tag.tag_id));
        const desiredTagIds = new Set(selectedTagIds);
        const toRemove = [...existingTagIds].filter((id) => !desiredTagIds.has(id));
        const toAdd = [...desiredTagIds].filter((id) => !existingTagIds.has(id));

        for (const tagId of toRemove) {
          await deleteContactTag(contactId, tagId);
        }
        for (const tagId of toAdd) {
          await addContactTag(contactId, tagId);
        }
      }

      // Optional: Add initial note if provided
      if (!isEdit && contactId && initialNote.trim()) {
        await supabase.from('contact_notes').insert({
          contact_id: contactId,
          user_id: user.id,
          note_text: initialNote.trim(),
        });
      }

      // Optional: Create initial Deal if agent assigned on create
      if (!isEdit && contactId && assignedAgentId) {
        const { data: pipeline } = await supabase
          .from('pipelines')
          .select('id, pipeline_stages(id, position)')
          .order('position', { referencedTable: 'pipeline_stages', ascending: true })
          .limit(1)
          .maybeSingle();

        if (pipeline && pipeline.pipeline_stages && pipeline.pipeline_stages.length > 0) {
          const firstStage = pipeline.pipeline_stages[0];
          await supabase.from('deals').insert({
            user_id: user.id,
            pipeline_id: pipeline.id,
            stage_id: firstStage.id,
            contact_id: contactId,
            assigned_to: assignedAgentId,
            title: `${name.trim() || phone.trim()} - Requirement`,
            value: parsedMax || parsedMin || 0,
            currency: 'INR',
            status: 'open',
          });
        }
      }

      toast.success(isEdit ? t('toastSuccessEdit') : t('toastSuccessAdd'));
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        toast.error(t('toastConflict'));
        if (!isEdit && accountId) {
          const existing = await findExistingContact(supabase, accountId, phone.trim());
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
      <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 border-b border-border/60">
          <DialogTitle className="text-popover-foreground text-lg font-semibold flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            {isEdit ? t('editTitle') : t('addTitle')}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            {isEdit ? t('editDesc') : t('addDesc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Lead Details */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('sectionContact') || 'Contact Information'}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cf-name" className="text-foreground text-xs font-medium">
                  {t('nameLabel')} <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="cf-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('namePlaceholder')}
                  className="bg-card border-border text-foreground"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cf-phone" className="text-foreground text-xs font-medium">
                  {t('phoneLabel')} <span className="text-red-400">*</span>
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
                  className="bg-card border-border text-foreground"
                  required
                />
              </div>
            </div>

            {dupMatch && (
              <div
                className={`flex items-start gap-2 rounded-md border p-3 text-xs ${
                  dupMatch.exact
                    ? 'border-red-500/40 bg-red-500/10 text-red-400'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                }`}
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">{dupMatch.exact ? t('dupExact') : t('dupSimilar')}</p>
                  {onViewExisting && (
                    <button
                      type="button"
                      onClick={() => onViewExisting(dupMatch.contact.id)}
                      className="font-medium underline underline-offset-2 hover:opacity-80"
                    >
                      {t('viewExisting', {
                        name: dupMatch.contact.name || dupMatch.contact.phone,
                      })}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cf-email" className="text-foreground text-xs font-medium">
                  {t('emailLabel')}
                </Label>
                <Input
                  id="cf-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  className="bg-card border-border text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cf-company" className="text-foreground text-xs font-medium">
                  {t('companyLabel')}
                </Label>
                <Input
                  id="cf-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder={t('companyPlaceholder')}
                  className="bg-card border-border text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Real Estate Requirements */}
          <div className="space-y-4 pt-2 border-t border-border/50">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('sectionPreferences') || 'Property Requirements'}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cf-source" className="text-foreground text-xs font-medium">
                  {t('sourceLabel') || 'Lead Source'}
                </Label>
                <Select value={source} onValueChange={(val) => setSource(val || 'Manual Entry')}>
                  <SelectTrigger id="cf-source" className="bg-card border-border text-foreground">
                    <SelectValue placeholder={t('sourcePlaceholder') || 'Select source...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {KNOWN_SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {source === 'Other' && (
                  <Input
                    value={otherSource}
                    onChange={(e) => setOtherSource(e.target.value)}
                    placeholder="Specify lead source..."
                    className="bg-card border-border text-foreground mt-2 text-xs"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cf-location" className="text-foreground text-xs font-medium flex items-center gap-1">
                  <MapPin className="size-3 text-primary" />
                  {t('locationLabel') || 'Location Preference'}
                </Label>
                <Input
                  id="cf-location"
                  value={locationPreference}
                  onChange={(e) => setLocationPreference(e.target.value)}
                  placeholder={t('locationPlaceholder') || 'e.g. Whitefield, Gurgaon, Bandra...'}
                  className="bg-card border-border text-foreground"
                />
              </div>
            </div>

            {/* Budget Range */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-foreground text-xs font-medium flex items-center gap-1">
                  <IndianRupee className="size-3 text-primary" />
                  {t('budgetMinLabel') || 'Budget Range (INR)'}
                </Label>
                {(parsedMin !== null || parsedMax !== null) && (
                  <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {parsedMin !== null && parsedMax !== null
                      ? `${formatINR(parsedMin)} – ${formatINR(parsedMax)}`
                      : parsedMin !== null
                        ? `Min ${formatINR(parsedMin)}`
                        : `Up to ${formatINR(parsedMax!)}`}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={budgetMinInput}
                  onChange={(e) => setBudgetMinInput(e.target.value)}
                  placeholder={t('budgetMinPlaceholder') || 'Min (e.g. 50L or 50,00,000)'}
                  className="bg-card border-border text-foreground text-xs"
                />
                <Input
                  value={budgetMaxInput}
                  onChange={(e) => setBudgetMaxInput(e.target.value)}
                  placeholder={t('budgetMaxPlaceholder') || 'Max (e.g. 1.5Cr or 1,50,00,000)'}
                  className="bg-card border-border text-foreground text-xs"
                />
              </div>
            </div>

            {/* BHK / Configuration Chips */}
            <div className="space-y-2">
              <Label className="text-foreground text-xs font-medium">
                {t('configLabel') || 'Configuration / BHK Preference'}
              </Label>
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
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer border ${
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                          : 'bg-muted border-border text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {config}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Possession Preference */}
            <div className="space-y-1.5">
              <Label className="text-foreground text-xs font-medium">
                {t('possessionLabel') || 'Possession Preference'}
              </Label>
              <Select value={possessionPreference} onValueChange={(val) => setPossessionPreference(val || 'any')}>
                <SelectTrigger className="bg-card border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t('possessionAny') || 'Any Possession'}</SelectItem>
                  <SelectItem value="ready_to_move_only">
                    {t('possessionReady') || 'Ready to Move Only'}
                  </SelectItem>
                  <SelectItem value="under_construction_ok">
                    {t('possessionUnderConstruction') || 'Under Construction OK'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section 3: Assignment, Tags & Notes */}
          <div className="space-y-4 pt-2 border-t border-border/50">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('sectionAssignment') || 'Assignment & Organization'}
            </h4>

            {!isEdit && profiles.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="cf-agent" className="text-foreground text-xs font-medium flex items-center gap-1">
                  <User className="size-3 text-primary" />
                  {t('agentLabel') || 'Assign to Agent (Optional)'}
                </Label>
                <Select value={assignedAgentId} onValueChange={(val) => setAssignedAgentId(val || '')}>
                  <SelectTrigger id="cf-agent" className="bg-card border-border text-foreground">
                    <SelectValue placeholder={t('agentPlaceholder') || 'Select an agent...'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name} ({p.account_role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Tags */}
            <div className="space-y-1.5">
              <Label className="text-foreground text-xs font-medium flex items-center gap-1">
                <TagIcon className="size-3 text-primary" />
                {t('tagsLabel')}
              </Label>
              {loadingTags ? (
                <div className="text-muted-foreground flex items-center gap-2 text-xs py-1">
                  <Loader2 className="size-3 animate-spin" />
                  {t('loadingTags')}
                </div>
              ) : tags.length === 0 ? (
                <p className="text-muted-foreground text-xs">{t('noTagsAvailable')}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const selected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer border ${
                          selected
                            ? 'ring-primary ring-2 ring-offset-1 ring-offset-background'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: tag.color + '20',
                          color: tag.color,
                          borderColor: tag.color + '40',
                        }}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Initial Note for New Leads */}
            {!isEdit && (
              <div className="space-y-1.5">
                <Label htmlFor="cf-note" className="text-foreground text-xs font-medium">
                  {t('notesLabel') || 'Initial Notes / Requirement Details'}
                </Label>
                <Textarea
                  id="cf-note"
                  value={initialNote}
                  onChange={(e) => setInitialNote(e.target.value)}
                  placeholder={t('notesPlaceholder') || 'Any specific requirements, call notes, or follow-up details...'}
                  className="bg-card border-border text-foreground text-xs min-h-[70px]"
                />
              </div>
            )}
          </div>

          <DialogFooter className="bg-popover border-t border-border/60 p-4 -mx-6 -mb-6 mt-6 flex sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={saving || checkingDup || (!isEdit && !!dupMatch?.exact)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              {saving && <Loader2 className="size-4 animate-spin mr-1.5" />}
              {isEdit ? t('update') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
