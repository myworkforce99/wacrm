'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';

import type {
  Contact,
  Deal,
  ContactNote,
  Tag,
  LeadDetail,
  Conversation,
} from '@/types';
import {
  Phone,
  Mail,
  Copy,
  Check,
  Tag as TagIcon,
  IndianRupee,
  StickyNote,
  Plus,
  Pencil,
  MapPin,
  Clock,
  Home,
  Calendar,
  Zap,
  X,
  Loader2,
  Lock,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SourceBadge } from '@/components/ui/source-badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatINRRange } from '@/lib/currency';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import { contactHandle } from '@/lib/whatsapp/wa-identity';
import { ScheduleVisitSheet } from '@/components/site-visits/schedule-visit-sheet';
import { CostSheetModal } from '@/components/contacts/cost-sheet-modal';
import { addContactTag, deleteContactTag } from '@/lib/contacts/tag-api';
import { toast } from 'sonner';

interface ContactSidebarProps {
  contact: Contact | null;
  conversation?: Conversation | null;
  canManage?: boolean;
  onClaimLead?: () => void;
  onUpdated?: () => void;
}

const CONFIG_OPTIONS = ['1BHK', '2BHK', '3BHK', '4BHK', '5BHK+', 'Villa'];

export function ContactSidebar({
  contact,
  conversation,
  canManage = true,
  onClaimLead,
  onUpdated,
}: ContactSidebarProps) {
  const tSidebar = useTranslations('Inbox.sidebar');
  const tThread = useTranslations('Inbox.messageThread');

  const { accountId } = useAuth();
  const [copied, setCopied] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tags, setTags] = useState<(Tag & { contact_tag_id: string })[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [leadDetail, setLeadDetail] = useState<LeadDetail | null>(null);

  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Cross-module action modals
  const [scheduleVisitOpen, setScheduleVisitOpen] = useState(false);
  const [costSheetOpen, setCostSheetOpen] = useState(false);
  const [editRequirementsOpen, setEditRequirementsOpen] = useState(false);

  // Requirements edit form state
  const [budgetMin, setBudgetMin] = useState<string>('');
  const [budgetMax, setBudgetMax] = useState<string>('');
  const [selectedConfigs, setSelectedConfigs] = useState<string[]>([]);
  const [locationPref, setLocationPref] = useState<string>('');
  const [possessionPref, setPossessionPref] = useState<string>('any');
  const [propertyType, setPropertyType] = useState<string>('Apartment');
  const [intent, setIntent] = useState<string>('Self Use');
  const [savingRequirements, setSavingRequirements] = useState(false);

  const fetchContactData = useCallback(async () => {
    if (!contact) return;

    const supabase = createClient();

    // Fetch deals, notes, tags, lead requirements, and all available tags in parallel
    const [dealsRes, notesRes, tagsRes, leadRes, allTagsRes] =
      await Promise.all([
        supabase
          .from('deals')
          .select('*, stage:pipeline_stages!deals_stage_id_fkey(*)')
          .eq('contact_id', contact.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('contact_notes')
          .select('*')
          .eq('contact_id', contact.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('contact_tags')
          .select('id, tag_id, tags(*)')
          .eq('contact_id', contact.id),
        supabase
          .from('lead_details')
          .select('*')
          .eq('contact_id', contact.id)
          .maybeSingle(),
        supabase.from('tags').select('*').order('name'),
      ]);

    if (dealsRes.data) setDeals(dealsRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (leadRes.data) {
      setLeadDetail(leadRes.data as LeadDetail);
    } else {
      setLeadDetail(null);
    }
    if (allTagsRes.data) setAllTags(allTagsRes.data as Tag[]);
    if (tagsRes.data) {
      const mapped = tagsRes.data
        .filter((ct: Record<string, unknown>) => ct.tags)
        .map((ct: Record<string, unknown>) => ({
          ...(ct.tags as Tag),
          contact_tag_id: ct.id as string,
        }));
      setTags(mapped);
    }
  }, [contact]);

  useEffect(() => {
    fetchContactData();
  }, [fetchContactData]);

  // Sync requirements form when edit dialog opens or leadDetail changes
  useEffect(() => {
    if (leadDetail) {
      setBudgetMin(leadDetail.budget_min ? String(leadDetail.budget_min) : '');
      setBudgetMax(leadDetail.budget_max ? String(leadDetail.budget_max) : '');
      setSelectedConfigs(leadDetail.configuration_preference || []);
      setLocationPref(leadDetail.location_preference || '');
      setPossessionPref(leadDetail.possession_preference || 'any');
      setPropertyType(leadDetail.property_type || 'Apartment');
      setIntent(leadDetail.intent || 'Self Use');
    } else {
      setBudgetMin('');
      setBudgetMax('');
      setSelectedConfigs([]);
      setLocationPref('');
      setPossessionPref('any');
      setPropertyType('Apartment');
      setIntent('Self Use');
    }
  }, [leadDetail, editRequirementsOpen]);

  const handleCopyPhone = useCallback(async () => {
    const handle = contact ? contactHandle(contact) : '';
    if (!handle) return;
    await navigator.clipboard.writeText(handle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [contact]);

  const handleAddNote = useCallback(async () => {
    if (!contact || !newNote.trim()) return;
    if (!accountId) return;
    setAddingNote(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    const { data, error } = await supabase
      .from('contact_notes')
      .insert({
        contact_id: contact.id,
        account_id: accountId,
        user_id: user?.id,
        note_text: newNote.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote('');
      toast.success('Internal note added');
    } else {
      toast.error('Failed to add note');
    }
    setAddingNote(false);
  }, [contact, newNote, accountId]);

  const handleToggleConfig = (cfg: string) => {
    setSelectedConfigs((prev) =>
      prev.includes(cfg) ? prev.filter((c) => c !== cfg) : [...prev, cfg]
    );
  };

  const handleSaveRequirements = async () => {
    if (!contact || !accountId) return;
    setSavingRequirements(true);
    try {
      const supabase = createClient();
      const minVal = budgetMin.trim() ? Number(budgetMin.trim()) : null;
      const maxVal = budgetMax.trim() ? Number(budgetMax.trim()) : null;

      const payload = {
        account_id: accountId,
        contact_id: contact.id,
        budget_min: minVal,
        budget_max: maxVal,
        configuration_preference: selectedConfigs,
        location_preference: locationPref.trim() || null,
        possession_preference: possessionPref === 'any' ? null : possessionPref,
        property_type: propertyType || null,
        intent: intent || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('lead_details')
        .upsert(payload, { onConflict: 'contact_id' })
        .select()
        .single();

      if (error) throw error;

      setLeadDetail(data as LeadDetail);
      toast.success('Requirements updated! ✓');
      setEditRequirementsOpen(false);
      onUpdated?.();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save requirements');
    } finally {
      setSavingRequirements(false);
    }
  };

  const handleAddTag = async (tagId: string) => {
    if (!contact) return;
    try {
      await addContactTag(contact.id, tagId);
      const targetTag = allTags.find((t) => t.id === tagId);
      if (targetTag) {
        setTags((prev) => [
          ...prev,
          { ...targetTag, contact_tag_id: `temp_${Date.now()}` },
        ]);
      }
      toast.success('Tag added');
      fetchContactData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add tag');
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!contact) return;
    try {
      await deleteContactTag(contact.id, tagId);
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      toast.success('Tag removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove tag');
    }
  };

  if (!contact) {
    return (
      <div className="border-border bg-card flex min-h-0 w-full flex-1 items-center justify-center lg:w-80 lg:border-l">
        <p className="text-muted-foreground text-sm">
          {tThread('selectConversation')}
        </p>
      </div>
    );
  }

  const displayName = contact.name || contactHandle(contact);
  const initials = displayName.charAt(0).toUpperCase();
  const availableTags = allTags.filter(
    (at) => !tags.some((t) => t.id === at.id)
  );

  return (
    <div className="border-border bg-card flex min-h-0 w-full flex-1 flex-col lg:w-80 lg:border-l">
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          {/* Contact Info Header */}
          <div className="flex flex-col items-center text-center">
            <div className="bg-muted text-foreground flex h-14 w-14 items-center justify-center rounded-full text-base font-semibold shadow-xs">
              {contact.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={contact.avatar_url}
                  alt={displayName}
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <h3 className="text-foreground mt-2.5 text-sm font-semibold">
              {displayName}
            </h3>
            {contact.company && (
              <p className="text-muted-foreground text-xs">{contact.company}</p>
            )}
          </div>

          {/* Unassigned Lead Notice & Claim Action */}
          {!canManage && !conversation?.assigned_agent_id && (
            <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3 text-xs text-amber-900 shadow-2xs dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                <Lock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>{tSidebar('unassignedNoticeTitle')}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-700/90 dark:text-amber-400/90">
                {tSidebar('unassignedNoticeBody')}
              </p>
              {onClaimLead && (
                <Button
                  size="sm"
                  type="button"
                  onClick={onClaimLead}
                  className="mt-2.5 h-7 w-full cursor-pointer gap-1.5 bg-amber-500 text-xs font-semibold text-white shadow-xs hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>{tThread('claimLead')}</span>
                </Button>
              )}
            </div>
          )}

          {/* Quick Contact & Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={handleCopyPhone}
              className="text-muted-foreground hover:bg-muted border-border/50 flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
            >
              <Phone className="text-muted-foreground h-3.5 w-3.5" />
              <span className="flex-1 text-left font-mono">
                {contactHandle(contact)}
              </span>
              {copied ? (
                <Check className="text-primary h-3.5 w-3.5" />
              ) : (
                <Copy className="text-muted-foreground h-3.5 w-3.5" />
              )}
            </button>

            {contact.email && (
              <div className="text-muted-foreground border-border/50 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs">
                <Mail className="text-muted-foreground h-3.5 w-3.5" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}

            {/* In-Chat Action Buttons: Schedule Visit & Send Cost Sheet */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                disabled={!canManage}
                title={!canManage ? tSidebar('claimToSchedule') : undefined}
                onClick={() => setScheduleVisitOpen(true)}
                className="border-border hover:bg-muted flex h-8 items-center justify-center gap-1.5 px-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Calendar className="text-primary h-3.5 w-3.5" />
                <span>Schedule Visit</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!canManage}
                title={
                  !canManage ? tSidebar('claimToSendCostSheet') : undefined
                }
                onClick={() => setCostSheetOpen(true)}
                className="border-border hover:bg-muted flex h-8 items-center justify-center gap-1.5 px-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Zap className="h-3.5 w-3.5 text-emerald-500" />
                <span>Cost Sheet</span>
              </Button>
            </div>
          </div>

          {/* Real Estate Requirements / Lead Qualification Card */}
          <div className="border-border/80 bg-muted/20 space-y-2.5 rounded-xl border p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                <Home className="text-primary h-3.5 w-3.5" />
                <span>Requirements</span>
              </div>
              {canManage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditRequirementsOpen(true)}
                  className="text-muted-foreground hover:text-foreground h-6 px-1.5 text-xs"
                >
                  <Pencil className="text-primary mr-1 h-3 w-3" />
                  Edit
                </Button>
              ) : (
                <span
                  className="text-muted-foreground/50 inline-flex items-center gap-1 text-[10px]"
                  title={tSidebar('claimToEditRequirements')}
                >
                  <Lock className="h-3 w-3" />
                </span>
              )}
            </div>

            {/* Budget Range */}
            <div className="bg-background border-border/60 flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs">
              <span className="text-muted-foreground flex items-center gap-1 font-medium">
                <IndianRupee className="text-primary h-3 w-3" />
                Budget
              </span>
              <span className="text-primary bg-primary/10 rounded-full px-2 py-0.5 text-xs font-bold">
                {formatINRRange(leadDetail?.budget_min, leadDetail?.budget_max)}
              </span>
            </div>

            {/* Configuration / BHK Preferences */}
            <div className="text-xs">
              <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                BHK Preference
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {leadDetail?.configuration_preference &&
                leadDetail.configuration_preference.length > 0 ? (
                  leadDetail.configuration_preference.map((cfg) => (
                    <span
                      key={cfg}
                      className="border-primary/40 bg-primary/10 text-primary rounded-full border px-2 py-0.5 text-[10px] font-medium"
                    >
                      {cfg}
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground text-[11px] italic">
                    Any configuration
                  </span>
                )}
              </div>
            </div>

            {/* Location & Possession Grid */}
            <div className="border-border/50 grid grid-cols-2 gap-2 border-t pt-1 text-xs">
              <div>
                <span className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold uppercase">
                  <MapPin className="text-primary h-3 w-3" />
                  Location
                </span>
                <p className="text-foreground mt-0.5 truncate text-[11px] font-medium">
                  {leadDetail?.location_preference || 'Not specified'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold uppercase">
                  <Clock className="text-primary h-3 w-3" />
                  Possession
                </span>
                <p className="text-foreground mt-0.5 truncate text-[11px] font-medium">
                  {leadDetail?.possession_preference === 'ready_to_move_only'
                    ? 'Ready to move'
                    : leadDetail?.possession_preference ===
                        'under_construction_ok'
                      ? 'Under constr.'
                      : 'Any'}
                </p>
              </div>
            </div>

            {/* Source */}
            {leadDetail?.source && (
              <div className="border-border/50 flex items-center justify-between border-t pt-1.5 text-xs">
                <span className="text-muted-foreground text-[10px] font-semibold uppercase">
                  Source
                </span>
                <SourceBadge source={leadDetail.source} />
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <div className="flex items-center justify-between px-1">
              <div className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
                <TagIcon className="h-3.5 w-3.5" />
                <span>{tSidebar('tags')}</span>
              </div>
              {canManage && availableTags.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-6 items-center justify-center rounded-md px-1.5 text-xs transition-colors">
                    <Plus className="mr-0.5 h-3 w-3" />
                    Add
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    {availableTags.map((at) => (
                      <DropdownMenuItem
                        key={at.id}
                        onClick={() => handleAddTag(at.id)}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: at.color }}
                        />
                        <span>{at.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.length === 0 ? (
                <p className="text-muted-foreground px-1 text-xs">
                  {tSidebar('noTags')}
                </p>
              ) : (
                tags.map((tag) => (
                  <span
                    key={tag.contact_tag_id || tag.id}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    <span>{tag.name}</span>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTag(tag.id)}
                        className="hover:opacity-75 focus:outline-hidden"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Active Deals */}
          <div>
            <div className="text-muted-foreground flex items-center gap-2 px-1 text-xs font-semibold tracking-wider uppercase">
              <IndianRupee className="h-3.5 w-3.5" />
              <span>{tSidebar('deals')}</span>
            </div>
            <div className="mt-2 space-y-2">
              {deals.length === 0 ? (
                <p className="text-muted-foreground px-1 text-xs">
                  {tSidebar('noDeals')}
                </p>
              ) : (
                deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="bg-muted/50 border-border/50 rounded-lg border px-3 py-2"
                  >
                    <p className="text-foreground text-xs font-medium">
                      {deal.title}
                    </p>
                    <div className="text-muted-foreground mt-1 flex items-center justify-between text-xs">
                      <span className="font-semibold">
                        {deal.currency ?? '₹'}
                        {deal.value.toLocaleString()}
                      </span>
                      {deal.stage && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px]"
                          style={{
                            backgroundColor: `${deal.stage.color}20`,
                            color: deal.stage.color,
                          }}
                        >
                          {deal.stage.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Internal Notes */}
          <div>
            <div className="text-muted-foreground flex items-center gap-2 px-1 text-xs font-semibold tracking-wider uppercase">
              <StickyNote className="h-3.5 w-3.5" />
              <span>{tSidebar('notes')}</span>
            </div>
            <div className="mt-2 space-y-2">
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder={
                    canManage
                      ? tSidebar('addNotePlaceholder')
                      : tSidebar('claimToAddNotes')
                  }
                  disabled={!canManage}
                  rows={2}
                  className="border-border bg-muted/50 text-foreground placeholder-muted-foreground focus:border-primary/50 flex-1 resize-none rounded-lg border px-2.5 py-1.5 text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90 h-auto px-2.5 disabled:opacity-40"
                  onClick={handleAddNote}
                  disabled={!canManage || !newNote.trim() || addingNote}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-muted/40 border-border/40 rounded-lg border p-2.5"
                  >
                    <p className="text-muted-foreground text-xs whitespace-pre-wrap">
                      {note.note_text}
                    </p>
                    <p className="text-muted-foreground/80 mt-1 text-[10px]">
                      {format(new Date(note.created_at), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Schedule Visit Sheet */}
      <ScheduleVisitSheet
        open={scheduleVisitOpen}
        onOpenChange={setScheduleVisitOpen}
        onSuccess={() => fetchContactData()}
        defaultContactId={contact.id}
      />

      {/* Cost Sheet Modal */}
      <CostSheetModal
        open={costSheetOpen}
        onOpenChange={setCostSheetOpen}
        contactId={contact.id}
      />

      {/* Edit Real Estate Requirements Dialog */}
      <Dialog
        open={editRequirementsOpen}
        onOpenChange={setEditRequirementsOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Real Estate Requirements</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Budget Range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Min Budget (₹)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 12000000"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Max Budget (₹)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 18000000"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>

            {/* BHK Preferences */}
            <div>
              <Label className="text-xs">BHK Configuration</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {CONFIG_OPTIONS.map((cfg) => {
                  const selected = selectedConfigs.includes(cfg);
                  return (
                    <button
                      key={cfg}
                      type="button"
                      onClick={() => handleToggleConfig(cfg)}
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                        selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      {cfg}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Location Preference */}
            <div>
              <Label className="text-xs">Preferred Location</Label>
              <Input
                placeholder="e.g. Powai, Mumbai"
                value={locationPref}
                onChange={(e) => setLocationPref(e.target.value)}
                className="mt-1 h-8 text-xs"
              />
            </div>

            {/* Possession Timeline & Property Type */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Possession Timeline</Label>
                <Select
                  value={possessionPref}
                  onValueChange={(val) => {
                    if (val) setPossessionPref(val);
                  }}
                >
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Timeline</SelectItem>
                    <SelectItem value="ready_to_move_only">
                      Ready to Move
                    </SelectItem>
                    <SelectItem value="under_construction_ok">
                      Under Construction OK
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Property Type</Label>
                <Select
                  value={propertyType}
                  onValueChange={(val) => {
                    if (val) setPropertyType(val);
                  }}
                >
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Apartment">Apartment</SelectItem>
                    <SelectItem value="Villa">Villa</SelectItem>
                    <SelectItem value="Plot">Plot</SelectItem>
                    <SelectItem value="Commercial">Commercial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Buyer Intent */}
            <div>
              <Label className="text-xs">Buyer Intent</Label>
              <Select
                value={intent}
                onValueChange={(val) => {
                  if (val) setIntent(val);
                }}
              >
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Self Use">Self Use / End Use</SelectItem>
                  <SelectItem value="Investment">Investment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditRequirementsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveRequirements}
              disabled={savingRequirements}
            >
              {savingRequirements && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Save Requirements
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
