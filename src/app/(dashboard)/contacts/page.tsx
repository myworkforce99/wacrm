'use client';

/**
 * Contacts / Leads Page
 *
 * Full-featured B2B Real Estate Leads management view:
 *  - Situational awareness stats overview (Total Leads, Fresh/New, Hot Leads, Active Deals, Pending Reply)
 *  - Multi-dimensional filters (Search, Source, Deal Stage/Status, Tags, Assignee)
 *  - Desktop Table with refined hierarchy, SourceBadge, StatusBadge, Location, Budget (INR),
 *    and quick inline actions (Direct WhatsApp chat, 1-click Call, Schedule Visit, More menu)
 *  - Modern Mobile Cards layout with 1-tap Call, WhatsApp, Schedule Visit, and Detail actions
 *  - Complete integration with ScheduleVisitSheet, ContactForm, ContactDetailView, and bulk operations
 *  - Full i18n support, dark & light mode styling, and responsive layout
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { PullToRefresh } from '@/components/layout/pull-to-refresh';
import { vibrate } from '@/lib/utils/vibrate';
import type { Contact, Tag, Profile } from '@/types';
import { Skeleton } from '@/components/dashboard/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Plus,
  Upload,
  Download,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  Users,
  Eye,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Filter,
  X,
  Phone,
  MessageCircle,
  Calendar,
  MapPin,
  IndianRupee,
  Flame,
  Sparkles,
  TrendingUp,
  UserCheck,
  Copy,
} from 'lucide-react';
import { ContactForm } from '@/components/contacts/contact-form';
import { ContactDetailView } from '@/components/contacts/contact-detail-view';
import { ScheduleVisitSheet } from '@/components/site-visits/schedule-visit-sheet';
import { useRouter } from 'next/navigation';
import { CustomFieldsManager } from '@/components/contacts/custom-fields-manager';
import { BulkReassignModal } from '@/components/contacts/bulk-reassign-modal';
import { useCan } from '@/hooks/use-can';
import { canManageMembers } from '@/lib/auth/roles';
import { GatedButton } from '@/components/ui/gated-button';
import { SlaBadge } from '@/components/ui/sla-badge';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/page-header';
import { SourceBadge } from '@/components/ui/source-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { avatarColorForName, initialsForName } from '@/lib/avatar-color';
import { formatCurrency, formatINR } from '@/lib/currency';
import Link from 'next/link';

const PAGE_SIZE = 25;

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
];

const KNOWN_STAGES = [
  'New',
  'Contacted',
  'Site Visit',
  'Negotiation',
  'Booking / Token Paid',
  'Won',
  'Lost',
];

function formatRelativeDate(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  const date = new Date(isoString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 86400 && now.getDate() === date.getDate()) {
    return 'Today';
  }

  const diffInDays = Math.floor(diffInSeconds / 86400);
  if (diffInDays === 1) return '1d ago';
  if (diffInDays < 30) return `${diffInDays}d ago`;

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}mo ago`;

  return `${Math.floor(diffInDays / 365)}y ago`;
}

function formatBudgetDisplay(
  min: number | null | undefined,
  max: number | null | undefined,
  currency = 'INR'
): string {
  if (!min && !max) return '-';
  const format = (v: number) =>
    currency === 'INR' ? formatINR(v) : formatCurrency(v, currency);
  if (min && !max) return format(min);
  if (!min && max) return format(max);
  return `${format(min as number)} – ${format(max as number)}`;
}

interface ContactWithTags extends Contact {
  tags?: Tag[];
  first_unanswered_at?: string | null;
  assignee?: { id: string; full_name: string } | null;
  lead_details?: {
    source?: string;
    location_preference?: string;
    budget_min?: number;
    budget_max?: number;
    configuration_preference?: string[];
    possession_preference?: string;
  } | null;
  deals?: {
    id?: string;
    assigned_to?: string | null;
    status?: string;
    pipeline_stages?: {
      name?: string;
    };
  }[];
}

export default function ContactsPage() {
  const t = useTranslations('Contacts.page');
  const router = useRouter();
  const supabase = createClient();
  const { accountRole, user, profile, defaultCurrency } = useAuth();
  const isManager = accountRole ? canManageMembers(accountRole) : false;
  const canEdit = useCan('send-messages');
  const canEditSettings = useCan('edit-settings');

  const [contacts, setContacts] = useState<ContactWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');

  // Modals & Sheets
  const [formOpen, setFormOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [scheduleVisitOpen, setScheduleVisitOpen] = useState(false);
  const [scheduleVisitContactId, setScheduleVisitContactId] = useState<
    string | undefined
  >(undefined);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkReassignOpen, setBulkReassignOpen] = useState(false);

  // Reference data
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const fetchSeq = useRef(0);

  const fetchTags = useCallback(async () => {
    const { data } = await supabase.from('tags').select('*');
    if (data) {
      const map: Record<string, Tag> = {};
      data.forEach((t) => (map[t.id] = t));
      setTagsMap(map);
      setSelectedTagIds((prev) => {
        const pruned = prev.filter((id) => map[id]);
        return pruned.length === prev.length ? prev : pruned;
      });
    }
  }, [supabase]);

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, email, account_role')
      .order('full_name');
    if (data) setProfiles(data as Profile[]);
  }, [supabase]);

  const fetchContacts = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    setSelected(new Set());

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const term = search.trim();

    let contactRows: Contact[];
    let count: number;

    if (selectedTagIds.length > 0) {
      const { data, error } = await supabase.rpc('filter_contacts_by_tags', {
        p_tag_ids: selectedTagIds,
        p_search: term || null,
        p_limit: PAGE_SIZE,
        p_offset: from,
        p_agent_user_id: accountRole === 'agent' && user?.id ? user.id : null,
      });
      if (seq !== fetchSeq.current) return;
      if (error) {
        toast.error(t('toastFailedLoad'));
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as { contact: Contact; total_count: number }[];

      const ids = rows.map((r) => r.contact.id);
      if (ids.length > 0) {
        const { data: relations } = await supabase
          .from('contacts')
          .select(
            'id, lead_details(*), deals(id, status, assigned_to, pipeline_stages!deals_stage_id_fkey(name))'
          )
          .in('id', ids)
          .order('created_at', { referencedTable: 'deals', ascending: false });

        const relationMap = new Map((relations ?? []).map((r) => [r.id, r]));
        contactRows = rows.map((r) => ({
          ...r.contact,
          lead_details: relationMap.get(r.contact.id)?.lead_details ?? null,
          deals: relationMap.get(r.contact.id)?.deals ?? [],
        }));
      } else {
        contactRows = [];
      }
      count = rows.length > 0 ? Number(rows[0].total_count) : 0;
    } else if (accountRole === 'agent' && user?.id) {
      const profileId = profile?.id;
      const { data: agentDeals } = profileId
        ? await supabase
            .from('deals')
            .select('contact_id')
            .eq('assigned_to', profileId)
            .not('contact_id', 'is', null)
        : { data: [] };

      const dealContactIds = (agentDeals
        ?.map((d) => d.contact_id)
        .filter(Boolean) ?? []) as string[];

      let agentQuery = supabase
        .from('contacts')
        .select(
          '*, lead_details(*), deals(id, status, assigned_to, pipeline_stages!deals_stage_id_fkey(name))',
          {
            count: 'exact',
          }
        )
        .order('created_at', { ascending: false })
        .order('created_at', { referencedTable: 'deals', ascending: false })
        .range(from, to);

      if (dealContactIds.length > 0) {
        agentQuery = agentQuery.or(
          `user_id.eq.${user.id},id.in.(${dealContactIds.join(',')})`
        );
      } else {
        agentQuery = agentQuery.eq('user_id', user.id);
      }

      if (term) {
        const like = `%${term}%`;
        agentQuery = agentQuery.or(
          `name.ilike.${like},phone.ilike.${like},email.ilike.${like}`
        );
      }

      const { data, count: exactCount, error } = await agentQuery;
      if (seq !== fetchSeq.current) return;
      if (error) {
        toast.error(t('toastFailedLoad'));
        setLoading(false);
        return;
      }
      contactRows = (data as unknown as Contact[]) ?? [];
      count = exactCount ?? 0;
    } else {
      let query = supabase
        .from('contacts')
        .select(
          '*, lead_details(*), deals(id, status, assigned_to, pipeline_stages!deals_stage_id_fkey(name))',
          {
            count: 'exact',
          }
        )
        .order('created_at', { ascending: false })
        .order('created_at', { referencedTable: 'deals', ascending: false })
        .range(from, to);

      if (term) {
        const like = `%${term}%`;
        query = query.or(
          `name.ilike.${like},phone.ilike.${like},email.ilike.${like}`
        );
      }

      const { data, count: exactCount, error } = await query;
      if (seq !== fetchSeq.current) return;
      if (error) {
        toast.error(t('toastFailedLoad'));
        setLoading(false);
        return;
      }
      contactRows = (data as unknown as Contact[]) ?? [];
      count = exactCount ?? 0;
    }

    setTotalCount(count);

    if (contactRows.length === 0) {
      setContacts([]);
      setLoading(false);
      return;
    }

    const contactIds = contactRows.map((c) => c.id);
    const { data: contactTags } = await supabase
      .from('contact_tags')
      .select('contact_id, tag_id')
      .in('contact_id', contactIds);

    const { data: convData } = await supabase
      .from('conversations')
      .select('contact_id, first_unanswered_at, assigned_agent_id')
      .in('contact_id', contactIds);

    const convAssigneeIds = (convData
      ?.map((c) => c.assigned_agent_id)
      .filter(Boolean) ?? []) as string[];

    type ContactRowWithDeals = Contact & {
      deals?: { assigned_to?: string | null }[];
    };
    const dealAssigneeProfileIds = (contactRows as ContactRowWithDeals[])
      .flatMap((c) => c.deals?.map((d) => d.assigned_to) ?? [])
      .filter(Boolean) as string[];

    const agentsByUserId: Record<string, { id: string; full_name: string }> =
      {};
    if (convAssigneeIds.length > 0) {
      const { data: convProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', convAssigneeIds);
      convProfiles?.forEach((p) => {
        agentsByUserId[p.user_id] = { id: p.user_id, full_name: p.full_name };
      });
    }

    const agentsByProfileId: Record<string, { id: string; full_name: string }> =
      {};
    if (dealAssigneeProfileIds.length > 0) {
      const { data: dealProfiles } = await supabase
        .from('profiles')
        .select('id, user_id, full_name')
        .in('id', dealAssigneeProfileIds);
      dealProfiles?.forEach((p) => {
        agentsByProfileId[p.id] = { id: p.user_id, full_name: p.full_name };
      });
    }

    if (seq !== fetchSeq.current) return;

    const tagsByContact: Record<string, string[]> = {};
    contactTags?.forEach((ct) => {
      if (!tagsByContact[ct.contact_id]) tagsByContact[ct.contact_id] = [];
      tagsByContact[ct.contact_id].push(ct.tag_id);
    });

    const convByContact: Record<
      string,
      { first_unanswered_at: string | null; assigned_agent_id: string | null }
    > = {};
    convData?.forEach((c) => {
      convByContact[c.contact_id] = {
        first_unanswered_at: c.first_unanswered_at,
        assigned_agent_id: c.assigned_agent_id,
      };
    });

    const dealAssigneeByContact: Record<string, string | null> = {};
    (contactRows as ContactRowWithDeals[]).forEach((c) => {
      const firstDealWithAssignee = c.deals?.find((d) => d.assigned_to);
      if (firstDealWithAssignee?.assigned_to) {
        dealAssigneeByContact[c.id] = firstDealWithAssignee.assigned_to;
      }
    });

    const enriched: ContactWithTags[] = contactRows.map((c) => {
      const conv = convByContact[c.id];
      const convAgentId = conv?.assigned_agent_id ?? null;
      const dealProfileId = dealAssigneeByContact[c.id] ?? null;
      const assignee =
        (convAgentId ? agentsByUserId[convAgentId] : null) ??
        (dealProfileId ? agentsByProfileId[dealProfileId] : null) ??
        null;
      return {
        ...c,
        tags: (tagsByContact[c.id] ?? [])
          .map((tid) => tagsMap[tid])
          .filter(Boolean),
        first_unanswered_at: conv?.first_unanswered_at,
        assignee,
      };
    });

    setContacts(enriched);
    setLoading(false);
  }, [
    supabase,
    page,
    search,
    selectedTagIds,
    tagsMap,
    t,
    user,
    profile,
    accountRole,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchTags();
      void fetchProfiles();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchTags, fetchProfiles]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchContacts();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchContacts]);

  function openAddForm() {
    setEditContact(null);
    setFormOpen(true);
  }

  function openEditForm(contact: Contact) {
    setEditContact(contact);
    setFormOpen(true);
  }

  function openDetail(contactId: string) {
    setDetailContactId(contactId);
    setDetailOpen(true);
  }

  function handleScheduleVisit(contactId: string) {
    setScheduleVisitContactId(contactId);
    setScheduleVisitOpen(true);
  }

  function confirmDelete(contact: Contact) {
    setDeleteTarget(contact);
    setDeleteConfirmOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      toast.error(t('toastFailedDelete'));
    } else {
      toast.success(t('toastDeleted'));
      vibrate([50, 100, 50]);
      fetchContacts();
    }

    setDeleting(false);
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  }

  const allOnPageSelected =
    contacts.length > 0 && contacts.every((c) => selected.has(c.id));
  const someOnPageSelected = contacts.some((c) => selected.has(c.id));

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        contacts.forEach((c) => next.delete(c.id));
      } else {
        contacts.forEach((c) => next.add(c.id));
      }
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setDeleting(true);

    const { error } = await supabase.from('contacts').delete().in('id', ids);

    if (error) {
      toast.error(t('toastBulkFailedDelete'));
    } else {
      toast.success(t('toastBulkDeleted', { count: ids.length }));
      setSelected(new Set());
      fetchContacts();
    }

    setDeleting(false);
    setBulkDeleteOpen(false);
  }

  // Role-based scoping for individual sales agents:
  // Non-manager agents only view their own assigned leads.
  const scopedContacts = useMemo(() => {
    if (!isManager && user?.id) {
      return contacts.filter(
        (c) => c.assignee?.id === user.id || c.user_id === user.id
      );
    }
    return contacts;
  }, [contacts, isManager, user]);

  // Multi-dimensional filtering across source, stage, and assignee
  const filteredContacts = useMemo(() => {
    return scopedContacts.filter((c) => {
      if (selectedSource !== 'all') {
        const src = c.lead_details?.source || 'Manual Entry';
        if (src.toLowerCase() !== selectedSource.toLowerCase()) return false;
      }
      if (selectedStage !== 'all') {
        const stageName = c.deals?.[0]?.pipeline_stages?.name;
        if (
          !stageName ||
          stageName.toLowerCase() !== selectedStage.toLowerCase()
        ) {
          return false;
        }
      }
      if (isManager && selectedAssignee !== 'all') {
        if (selectedAssignee === 'unassigned') {
          if (c.assignee) return false;
        } else {
          if (c.assignee?.id !== selectedAssignee) return false;
        }
      }
      return true;
    });
  }, [
    scopedContacts,
    isManager,
    selectedSource,
    selectedStage,
    selectedAssignee,
  ]);

  // Lead statistics for summary metrics bar
  const stats = useMemo(() => {
    const list = scopedContacts;
    const total = !isManager ? list.length : totalCount;
    const hotCount = list.filter((c) =>
      c.tags?.some((t) => t.name.toLowerCase().includes('hot'))
    ).length;
    const dealsCount = list.filter((c) =>
      c.deals?.some((d) => d.status === 'open')
    ).length;
    const attentionCount = list.filter((c) =>
      Boolean(c.first_unanswered_at)
    ).length;
    const freshCount = list.filter(
      (c) =>
        c.deals?.[0]?.pipeline_stages?.name === 'New' ||
        !c.deals ||
        c.deals.length === 0
    ).length;

    return {
      total,
      hot: hotCount,
      deals: dealsCount,
      attention: attentionCount,
      fresh: freshCount,
    };
  }, [scopedContacts, isManager, totalCount]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasNext = page < totalPages - 1;
  const hasPrev = page > 0;

  const allTags = Object.values(tagsMap).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const hasActiveFilters =
    search.trim().length > 0 ||
    selectedTagIds.length > 0 ||
    selectedSource !== 'all' ||
    selectedStage !== 'all' ||
    (isManager && selectedAssignee !== 'all');

  const activeFiltersCount =
    (search.trim().length > 0 ? 1 : 0) +
    selectedTagIds.length +
    (selectedSource !== 'all' ? 1 : 0) +
    (selectedStage !== 'all' ? 1 : 0) +
    (isManager && selectedAssignee !== 'all' ? 1 : 0);

  function toggleTagFilter(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
    setPage(0);
  }

  function clearAllFilters() {
    setSearch('');
    setSelectedTagIds([]);
    setSelectedSource('all');
    setSelectedStage('all');
    setSelectedAssignee('all');
    setPage(0);
  }

  function isHotLead(contact: ContactWithTags) {
    return contact.tags?.some((t) => t.name.toLowerCase().includes('hot'));
  }

  return (
    <PullToRefresh>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Leads"
          subtitle={
            t('subtitle', { count: totalCount }) ||
            `${totalCount} total leads in your pipeline`
          }
          action={
            <div className="flex items-center gap-2">
              {/* Desktop Actions */}
              {canEditSettings && (
                <Button
                  variant="outline"
                  onClick={() => {
                    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                    window.location.href = '/api/contacts/export';
                  }}
                  className="border-border text-muted-foreground hover:bg-muted hidden rounded-full sm:flex"
                >
                  <Download className="mr-1.5 size-4" />
                  {t('exportBtn') || 'Export'}
                </Button>
              )}
              {canEditSettings && (
                <Button
                  variant="outline"
                  onClick={() => setCustomFieldsOpen(true)}
                  className="border-border text-muted-foreground hover:bg-muted hidden rounded-full sm:flex"
                >
                  <SlidersHorizontal className="mr-1.5 size-4" />
                  {t('customFieldsBtn')}
                </Button>
              )}
              <GatedButton
                variant="outline"
                canAct={canEditSettings}
                gateReason="add or import contacts"
                onClick={() => router.push('/contacts/import')}
                className="border-border text-muted-foreground hover:bg-muted hidden rounded-full sm:flex"
              >
                <Upload className="mr-1.5 size-4" />
                {t('importBtn')}
              </GatedButton>

              {/* Mobile Actions Dropdown */}
              {canEditSettings && (
                <div className="flex sm:hidden">
                  <DropdownMenu>
                    <DropdownMenuTrigger className="border-border text-muted-foreground hover:bg-muted focus-visible:ring-ring flex h-9 w-9 items-center justify-center rounded-full border bg-transparent shadow-xs focus-visible:ring-1 focus-visible:outline-none">
                      <MoreVertical className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                          window.location.href = '/api/contacts/export';
                        }}
                      >
                        <Download className="mr-2 size-4" />
                        {t('exportBtn') || 'Export'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setCustomFieldsOpen(true)}
                      >
                        <SlidersHorizontal className="mr-2 size-4" />
                        {t('customFieldsBtn')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => router.push('/contacts/import')}
                      >
                        <Upload className="mr-2 size-4" />
                        {t('importBtn')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              <GatedButton
                canAct={canEdit}
                gateReason="add or import contacts"
                onClick={openAddForm}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-4 py-2 text-sm font-medium shadow-xs"
              >
                <Plus className="size-4 sm:mr-1" />
                <span className="hidden sm:inline">{t('addContactBtn')}</span>
              </GatedButton>
            </div>
          }
        />

        {/* Stats Overview Metric Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            onClick={() => {
              setSelectedStage('all');
              setSelectedSource('all');
            }}
            className="bg-card border-border/80 hover:border-primary/50 cursor-pointer rounded-xl border p-3.5 shadow-xs transition-all"
          >
            <div className="text-muted-foreground flex items-center justify-between">
              <span className="text-xs font-medium">
                {t('statsTotal') || 'Total Leads'}
              </span>
              <Users className="text-primary size-4" />
            </div>
            <p className="text-foreground mt-1.5 text-2xl font-bold tracking-tight">
              {stats.total}
            </p>
          </div>

          <div
            onClick={() =>
              setSelectedStage(selectedStage === 'New' ? 'all' : 'New')
            }
            className={`bg-card border-border/80 cursor-pointer rounded-xl border p-3.5 shadow-xs transition-all hover:border-blue-500/50 ${
              selectedStage === 'New'
                ? 'border-blue-500 ring-2 ring-blue-500/30'
                : ''
            }`}
          >
            <div className="text-muted-foreground flex items-center justify-between">
              <span className="text-xs font-medium">
                {t('statsNew') || 'Fresh / New'}
              </span>
              <Sparkles className="size-4 text-blue-500" />
            </div>
            <p className="text-foreground mt-1.5 text-2xl font-bold tracking-tight">
              {stats.fresh}
            </p>
          </div>

          <div
            onClick={() => {
              const hotTag = allTags.find((t) =>
                t.name.toLowerCase().includes('hot')
              );
              if (hotTag) toggleTagFilter(hotTag.id);
            }}
            className="bg-card border-border/80 cursor-pointer rounded-xl border p-3.5 shadow-xs transition-all hover:border-red-500/50"
          >
            <div className="text-muted-foreground flex items-center justify-between">
              <span className="text-xs font-medium">
                {t('statsHot') || 'Hot Leads'}
              </span>
              <Flame className="size-4 text-red-500" />
            </div>
            <p className="text-foreground mt-1.5 text-2xl font-bold tracking-tight">
              {stats.hot}
            </p>
          </div>

          <div className="bg-card border-border/80 rounded-xl border p-3.5 shadow-xs transition-all">
            <div className="text-muted-foreground flex items-center justify-between">
              <span className="text-xs font-medium">
                {t('statsDeals') || 'Active Pipeline'}
              </span>
              <TrendingUp className="size-4 text-emerald-500" />
            </div>
            <p className="text-foreground mt-1.5 text-2xl font-bold tracking-tight">
              {stats.deals}
            </p>
          </div>
        </div>

        {/* Search & Real Estate Filter Toolbar */}
        <div className="bg-card border-border/70 space-y-3 rounded-xl border p-3 shadow-xs">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Filter Group: Search + Dropdowns (Left-aligned, rock-solid stable positions) */}
            <div className="flex flex-1 flex-wrap items-center gap-2">
              {/* Search Box */}
              <div className="relative w-full sm:w-72">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  placeholder={
                    t('searchPlaceholder') ||
                    'Search by name, phone, email, location...'
                  }
                  className="bg-muted/40 border-border placeholder:text-muted-foreground focus:ring-primary/30 w-full rounded-lg border py-1.5 pr-8 pl-9 text-xs focus:ring-2 focus:outline-none"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Source Filter */}
              <Select
                value={selectedSource}
                onValueChange={(val) => setSelectedSource(val || 'all')}
              >
                <SelectTrigger
                  label={t('filterSource') || 'Source'}
                  className="bg-muted/40 border-border text-foreground h-9 min-w-[140px] text-xs"
                >
                  <SelectValue
                    placeholder={t('filterAllSources') || 'All Sources'}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectLabel>{t('filterSource') || 'Source'}</SelectLabel>
                  <SelectSeparator />
                  <SelectItem value="all">
                    {t('filterAllSources') || 'All Sources'}
                  </SelectItem>
                  {KNOWN_SOURCES.map((src) => (
                    <SelectItem key={src} value={src}>
                      {src}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Deal Stage / Status Filter */}
              <Select
                value={selectedStage}
                onValueChange={(val) => setSelectedStage(val || 'all')}
              >
                <SelectTrigger
                  label={t('filterStage') || 'Stage'}
                  className="bg-muted/40 border-border text-foreground h-9 min-w-[140px] text-xs"
                >
                  <SelectValue
                    placeholder={t('filterAllStages') || 'All Stages'}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectLabel>{t('filterStage') || 'Stage'}</SelectLabel>
                  <SelectSeparator />
                  <SelectItem value="all">
                    {t('filterAllStages') || 'All Stages'}
                  </SelectItem>
                  {KNOWN_STAGES.map((stg) => (
                    <SelectItem key={stg} value={stg}>
                      {stg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Tag Filter Popover */}
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      className="border-border text-muted-foreground hover:bg-muted h-9 shrink-0 text-xs"
                    />
                  }
                >
                  <Filter className="mr-1 size-3.5" />
                  {t('filterByTags')}
                  {selectedTagIds.length > 0 && (
                    <span className="bg-primary text-primary-foreground ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-semibold">
                      {selectedTagIds.length}
                    </span>
                  )}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-0">
                  <div className="border-border flex items-center justify-between border-b px-3 py-2">
                    <span className="text-popover-foreground text-xs font-semibold">
                      {t('filterByTags')}
                    </span>
                    {selectedTagIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedTagIds([])}
                        className="cursor-pointer rounded border border-red-200/60 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-100 hover:text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/50 dark:hover:text-red-300"
                      >
                        {t('clearAll')}
                      </button>
                    )}
                  </div>
                  {allTags.length === 0 ? (
                    <p className="text-muted-foreground px-3 py-4 text-center text-xs">
                      {t('noTagsYet')}
                    </p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto py-1">
                      {allTags.map((tag) => (
                        <label
                          key={tag.id}
                          className="hover:bg-muted/50 flex cursor-pointer items-center gap-2.5 px-3 py-1.5"
                        >
                          <Checkbox
                            checked={selectedTagIds.includes(tag.id)}
                            onCheckedChange={() => toggleTagFilter(tag.id)}
                            aria-label={`Filter by ${tag.name}`}
                          />
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="text-popover-foreground truncate text-sm">
                            {tag.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              {/* Assignee Filter (for managers / admins) */}
              {isManager && profiles.length > 0 && (
                <Select
                  value={selectedAssignee}
                  onValueChange={(val) => setSelectedAssignee(val || 'all')}
                >
                  <SelectTrigger
                    label={t('filterAssignee') || 'Assignee'}
                    className="bg-muted/40 border-border text-foreground h-9 min-w-[140px] text-xs"
                  >
                    <SelectValue
                      placeholder={t('filterAllAssignees') || 'All Agents'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectLabel>
                      {t('filterAssignee') || 'Assignee'}
                    </SelectLabel>
                    <SelectSeparator />
                    <SelectItem value="all">
                      {t('filterAllAssignees') || 'All Agents'}
                    </SelectItem>
                    <SelectItem value="unassigned">
                      {t('filterUnassigned') || 'Unassigned'}
                    </SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.user_id}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Agent Scoped Indicator (for individual sales agents) */}
              {!isManager && (
                <div
                  className="bg-primary/10 border-primary/20 text-primary flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium shadow-2xs"
                  title={t('filterMyLeads')}
                >
                  <UserCheck className="size-3.5" />
                  <span>{t('filterMyLeads')}</span>
                </div>
              )}
            </div>

            {/* Clear All Filters (Anchored on the right, prevents layout shift on dropdowns) */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-8.5 shrink-0 gap-1 self-end border border-red-200/60 bg-red-50 px-2.5 text-xs font-medium text-red-600 shadow-2xs transition-colors hover:border-red-300 hover:bg-red-100 hover:text-red-700 md:self-auto dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400 dark:hover:border-red-800 dark:hover:bg-red-900/50 dark:hover:text-red-300"
              >
                <X className="size-3.5" />
                {t('clearAll')} ({activeFiltersCount})
              </Button>
            )}
          </div>

          {/* Active Tag Filter Pills */}
          {selectedTagIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-muted-foreground mr-1 text-[11px] font-medium">
                Active tags:
              </span>
              {selectedTagIds.map((id) => {
                const tag = tagsMap[id];
                if (!tag) return null;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      backgroundColor: tag.color + '20',
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                    <button
                      onClick={() => toggleTagFilter(id)}
                      aria-label={`Remove ${tag.name} filter`}
                      className="cursor-pointer hover:opacity-70"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Bulk Action Bar */}
        {selected.size > 0 && (
          <div className="border-border bg-muted/60 flex items-center justify-between gap-4 rounded-xl border px-4 py-2.5 shadow-xs">
            <p className="text-foreground text-xs font-semibold">
              {t('selectedCount', { count: selected.size })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                {t('clearSelection')}
              </Button>
              <GatedButton
                variant="destructive"
                size="sm"
                canAct={canEdit}
                gateReason="delete contacts"
                onClick={() => setBulkDeleteOpen(true)}
                className="text-xs"
              >
                <Trash2 className="mr-1 size-3.5" />
                {t('deleteSelected')}
              </GatedButton>
              <GatedButton
                variant="outline"
                size="sm"
                canAct={canEditSettings}
                gateReason="reassign contacts"
                onClick={() => setBulkReassignOpen(true)}
                className="text-xs"
              >
                <UserCheck className="mr-1 size-3.5" />
                Reassign
              </GatedButton>
            </div>
          </div>
        )}

        <BulkReassignModal
          open={bulkReassignOpen}
          onOpenChange={setBulkReassignOpen}
          selectedIds={[...selected]}
          onSuccess={() => {
            setSelected(new Set());
            fetchContacts();
          }}
        />

        {/* Mobile View: Dedicated Real Estate Lead Cards */}
        <div className="space-y-3 md:hidden">
          {loading ? (
            <div className="flex flex-col gap-3 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-card border-border space-y-3 rounded-xl border p-4"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
              ))}
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="bg-card border-border flex flex-col items-center gap-2 rounded-xl border px-4 py-12 text-center">
              <Users className="text-muted-foreground size-8" />
              <p className="text-muted-foreground text-sm">
                {hasActiveFilters ? t('noContactsMatch') : t('noContactsYet')}
              </p>
              {!hasActiveFilters && (
                <GatedButton
                  canAct={canEdit}
                  gateReason="add or import contacts"
                  variant="outline"
                  size="sm"
                  onClick={openAddForm}
                  className="border-border text-muted-foreground hover:bg-muted mt-2"
                >
                  <Plus className="mr-1 size-3.5" />
                  {t('addFirstContact')}
                </GatedButton>
              )}
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const dealStage = contact.deals?.[0]?.pipeline_stages?.name;
              return (
                <div
                  key={contact.id}
                  className="bg-card border-border/80 hover:border-border space-y-3 rounded-xl border p-4 shadow-xs transition-colors"
                >
                  {/* Top: Avatar, Name, Phone, StatusBadge */}
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                      onClick={() => openDetail(contact.id)}
                    >
                      <Checkbox
                        checked={selected.has(contact.id)}
                        onCheckedChange={() => toggleSelect(contact.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${contact.name || contact.phone}`}
                      />
                      <Avatar className="size-10 shrink-0">
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
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-foreground truncate text-sm font-semibold">
                            {contact.name || t('unnamed')}
                          </span>
                          {isHotLead(contact) && (
                            <span className="py-0.2 rounded-sm bg-red-500/10 px-1.5 text-[10px] font-bold tracking-wide text-red-600 uppercase dark:bg-red-950/60 dark:text-red-400">
                              HOT
                            </span>
                          )}
                        </div>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {contact.phone}
                        </p>
                      </div>
                    </div>
                    {dealStage && <StatusBadge status={dealStage} />}
                  </div>

                  {/* Real Estate Info Block */}
                  <div className="bg-muted/40 space-y-1.5 rounded-lg p-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-muted-foreground flex items-center gap-1 truncate">
                        <MapPin className="text-primary size-3 shrink-0" />
                        <span className="truncate">
                          {contact.lead_details?.location_preference ||
                            'Location not specified'}
                        </span>
                      </div>
                      {contact.lead_details?.source && (
                        <SourceBadge source={contact.lead_details.source} />
                      )}
                    </div>

                    <div className="text-muted-foreground flex items-center justify-between gap-2">
                      <div className="text-foreground flex items-center gap-1 font-medium">
                        <IndianRupee className="text-primary size-3 shrink-0" />
                        <span>
                          {formatBudgetDisplay(
                            contact.lead_details?.budget_min,
                            contact.lead_details?.budget_max,
                            defaultCurrency
                          )}
                        </span>
                      </div>
                      {contact.assignee && (
                        <span className="text-muted-foreground bg-card border-border rounded border px-1.5 py-0.5 text-[11px]">
                          {contact.assignee.full_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tags & SLA Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags && contact.tags.length > 0 ? (
                        contact.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: tag.color + '20',
                              color: tag.color,
                            }}
                          >
                            {tag.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                      {(contact.tags?.length ?? 0) > 3 && (
                        <span className="text-muted-foreground text-[10px] font-medium">
                          +{contact.tags!.length - 3}
                        </span>
                      )}
                    </div>
                    {contact.first_unanswered_at && (
                      <SlaBadge
                        firstUnansweredAt={contact.first_unanswered_at}
                      />
                    )}
                  </div>

                  {/* 4-Column Quick Action Bar */}
                  <div className="border-border/60 grid grid-cols-4 gap-2 border-t pt-2">
                    <a
                      href={`tel:${contact.phone}`}
                      className="bg-muted hover:bg-muted/80 text-foreground flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors"
                      title={t('callAction') || 'Call lead'}
                    >
                      <Phone className="size-3.5 text-blue-600" />
                      <span>{t('callAction') || 'Call'}</span>
                    </a>
                    <Link
                      href={`/inbox?contact=${contact.id}`}
                      className="flex items-center justify-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
                      title={t('whatsappAction') || 'Chat on WhatsApp'}
                    >
                      <MessageCircle className="size-3.5" />
                      <span>Chat</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleScheduleVisit(contact.id)}
                      className="bg-primary/10 hover:bg-primary/20 text-primary flex cursor-pointer items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors"
                      title={t('scheduleVisitAction') || 'Schedule visit'}
                    >
                      <Calendar className="size-3.5" />
                      <span>Visit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditForm(contact)}
                      className="bg-muted hover:bg-muted/80 text-foreground flex cursor-pointer items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors"
                      title={t('editContactAction') || 'Edit details'}
                    >
                      <Pencil className="text-muted-foreground size-3.5" />
                      <span>{t('editAction') || 'Edit'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <div className="border-border bg-card hidden overflow-hidden rounded-xl border shadow-xs md:block">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={allOnPageSelected}
                    indeterminate={!allOnPageSelected && someOnPageSelected}
                    onCheckedChange={toggleSelectAll}
                    disabled={contacts.length === 0}
                    aria-label={t('selectAllOnPage')}
                  />
                </TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  LEAD
                </TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  SOURCE
                </TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  LOCATION
                </TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  BUDGET
                </TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  STATUS
                </TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  TAGS
                </TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  LAST CONTACT
                </TableHead>
                <TableHead className="text-muted-foreground w-[120px] pr-4 text-right text-xs font-semibold tracking-wider uppercase">
                  ACTIONS
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell className="w-10">
                      <Skeleton className="size-4" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Skeleton className="size-9 rounded-full" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Skeleton className="ml-auto h-7 w-20" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredContacts.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={9} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="text-muted-foreground size-8" />
                      <p className="text-muted-foreground text-sm">
                        {hasActiveFilters
                          ? t('noContactsMatch')
                          : t('noContactsYet')}
                      </p>
                      {!hasActiveFilters && (
                        <GatedButton
                          canAct={canEdit}
                          gateReason="add or import contacts"
                          variant="outline"
                          size="sm"
                          onClick={openAddForm}
                          className="border-border text-muted-foreground hover:bg-muted mt-2"
                        >
                          <Plus className="mr-1 size-3.5" />
                          {t('addFirstContact')}
                        </GatedButton>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((contact) => {
                  const dealStage = contact.deals?.[0]?.pipeline_stages?.name;
                  return (
                    <TableRow
                      key={contact.id}
                      className="border-border hover:bg-muted/40 cursor-pointer transition-colors"
                      onClick={() => openDetail(contact.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(contact.id)}
                          onCheckedChange={() => toggleSelect(contact.id)}
                          aria-label={`Select ${contact.name || contact.phone}`}
                        />
                      </TableCell>

                      {/* LEAD Cell */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9 shrink-0">
                            <AvatarFallback
                              className="text-xs font-semibold text-white"
                              style={{
                                background: avatarColorForName(contact.name),
                              }}
                            >
                              {initialsForName(contact.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="max-w-[200px] min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-foreground truncate text-sm font-semibold">
                                {contact.name || 'Unknown'}
                              </span>
                              {isHotLead(contact) && (
                                <span className="py-0.2 rounded-sm bg-red-500/10 px-1.5 text-[9px] font-bold tracking-wide text-red-600 uppercase dark:bg-red-950/60 dark:text-red-400">
                                  HOT
                                </span>
                              )}
                            </div>
                            <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                              <span>{contact.phone}</span>
                              {contact.assignee && (
                                <>
                                  <span>•</span>
                                  <span className="text-muted-foreground truncate text-[11px]">
                                    {contact.assignee.full_name}
                                  </span>
                                </>
                              )}
                            </div>
                            {contact.first_unanswered_at && (
                              <div className="mt-1">
                                <SlaBadge
                                  firstUnansweredAt={
                                    contact.first_unanswered_at
                                  }
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* SOURCE Cell */}
                      <TableCell>
                        {contact.lead_details?.source ? (
                          <SourceBadge source={contact.lead_details.source} />
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            -
                          </span>
                        )}
                      </TableCell>

                      {/* LOCATION Cell */}
                      <TableCell className="text-foreground text-xs">
                        {contact.lead_details?.location_preference ? (
                          <div className="flex max-w-[150px] items-center gap-1 truncate">
                            <MapPin className="text-primary size-3 shrink-0" />
                            <span className="truncate">
                              {contact.lead_details.location_preference}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            -
                          </span>
                        )}
                      </TableCell>

                      {/* BUDGET Cell */}
                      <TableCell className="text-foreground text-xs font-medium">
                        {formatBudgetDisplay(
                          contact.lead_details?.budget_min,
                          contact.lead_details?.budget_max,
                          defaultCurrency
                        )}
                      </TableCell>

                      {/* STATUS Cell */}
                      <TableCell>
                        {dealStage ? (
                          <StatusBadge status={dealStage} />
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            -
                          </span>
                        )}
                      </TableCell>

                      {/* TAGS Cell */}
                      <TableCell>
                        <div className="flex max-w-[160px] flex-wrap gap-1">
                          {contact.tags && contact.tags.length > 0 ? (
                            contact.tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag.id}
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                                style={{
                                  backgroundColor: tag.color + '20',
                                  color: tag.color,
                                }}
                              >
                                {tag.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              -
                            </span>
                          )}
                          {contact.tags && contact.tags.length > 2 && (
                            <span className="text-muted-foreground self-center text-[10px] font-medium">
                              +{contact.tags.length - 2}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* LAST CONTACT Cell */}
                      <TableCell className="text-muted-foreground text-xs">
                        {formatRelativeDate(contact.updated_at)}
                      </TableCell>

                      {/* ACTIONS Cell */}
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        className="pr-4 text-right"
                      >
                        <div className="flex items-center justify-end gap-1">
                          {/* Direct WhatsApp in Inbox */}
                          <Link
                            href={`/inbox?contact=${contact.id}`}
                            className="hover:bg-muted text-muted-foreground rounded-lg p-1.5 transition-colors hover:text-emerald-600"
                            onClick={(e) => e.stopPropagation()}
                            title={t('whatsappAction') || 'Chat on WhatsApp'}
                          >
                            <MessageCircle className="size-4" />
                          </Link>

                          {/* 1-Click Call */}
                          <a
                            href={`tel:${contact.phone}`}
                            className="hover:bg-muted text-muted-foreground rounded-lg p-1.5 transition-colors hover:text-blue-600"
                            onClick={(e) => e.stopPropagation()}
                            title={t('callAction') || 'Call lead'}
                          >
                            <Phone className="size-4" />
                          </a>

                          {/* Quick Schedule Site Visit */}
                          <button
                            type="button"
                            className="hover:bg-muted text-muted-foreground hover:text-primary cursor-pointer rounded-lg p-1.5 transition-colors"
                            title={
                              t('scheduleVisitAction') || 'Schedule Site Visit'
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              handleScheduleVisit(contact.id);
                            }}
                          >
                            <Calendar className="size-4" />
                          </button>

                          {/* Quick View Details */}
                          <button
                            type="button"
                            className="hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer rounded-lg p-1.5 transition-colors"
                            title={t('viewDetailsAction') || 'View Details'}
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetail(contact.id);
                            }}
                          >
                            <Eye className="size-4" />
                          </button>

                          {/* Management & Destructive Options Menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-colors focus:outline-none"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditForm(contact);
                                }}
                              >
                                <Pencil className="mr-2 size-4" />
                                {t('editContactAction') || 'Edit Details'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await navigator.clipboard.writeText(
                                    contact.phone
                                  );
                                  toast.success(
                                    t('copyPhoneAction') ||
                                      'Phone copied to clipboard'
                                  );
                                }}
                              >
                                <Copy className="mr-2 size-4" />
                                {t('copyPhoneAction') || 'Copy Phone'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  confirmDelete(contact);
                                }}
                              >
                                <Trash2 className="mr-2 size-4" />
                                {t('deleteAction') || 'Delete Lead'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-muted-foreground text-xs">
              {t('showingPagination', {
                start: page * PAGE_SIZE + 1,
                end: Math.min((page + 1) * PAGE_SIZE, totalCount),
                total: totalCount,
              })}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                disabled={!hasPrev}
                onClick={() => setPage((p) => p - 1)}
                className="border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-muted-foreground px-2 text-xs">
                {t('pageCount', { page: page + 1, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={!hasNext}
                onClick={() => setPage((p) => p + 1)}
                className="border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Modals & Sheets */}
        <ContactForm
          open={formOpen}
          onOpenChange={(isOpen) => {
            setFormOpen(isOpen);
            if (!isOpen) {
              setEditContact(null);
            }
          }}
          contact={editContact}
          contactTags={editContact?.tags || []}
          onSaved={() => {
            fetchContacts();
            fetchTags();
          }}
          onViewExisting={(id) => {
            setFormOpen(false);
            openDetail(id);
          }}
        />

        <ContactDetailView
          open={detailOpen}
          onOpenChange={setDetailOpen}
          contactId={detailContactId}
          onUpdated={fetchContacts}
          onEdit={(c) => {
            openEditForm(c);
          }}
        />

        <ScheduleVisitSheet
          open={scheduleVisitOpen}
          onOpenChange={setScheduleVisitOpen}
          defaultContactId={scheduleVisitContactId}
          onSuccess={() => {
            fetchContacts();
          }}
        />

        {canEditSettings && (
          <CustomFieldsManager
            open={customFieldsOpen}
            onOpenChange={setCustomFieldsOpen}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-popover-foreground">
                {t('deleteContactTitle')}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                {t('deleteContactDesc', {
                  name: deleteTarget?.name || deleteTarget?.phone || '',
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="bg-popover border-border">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmOpen(false)}
                className="border-border text-muted-foreground hover:bg-muted"
              >
                {t('cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
                {t('deleteBtn')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Delete Confirmation Dialog */}
        <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
          <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-popover-foreground">
                {t('deleteBulkTitle')}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                {t('deleteBulkDesc', { count: selected.size })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="bg-popover border-border">
              <Button
                variant="outline"
                onClick={() => setBulkDeleteOpen(false)}
                className="border-border text-muted-foreground hover:bg-muted"
              >
                {t('cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={deleting}
              >
                {deleting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
                {t('deleteBtn')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PullToRefresh>
  );
}
