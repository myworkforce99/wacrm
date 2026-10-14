'use client';

/**
 * PipelinesPage
 *
 * Sales Pipelines & Deals view for Real Estate vertical CRM.
 * Comprehensive overhaul adhering to the 6-pillar standard:
 *  1. Situational Awareness KPI Strip: Live pipeline value in ₹ INR,
 *     active open deals, weighted win forecast, monthly closures, and win rate %.
 *  2. Real Estate Filtering & Omni-Search: Search by deal, buyer, phone, location;
 *     multi-dimensional filters by Source, Agent, Deal Value range, and Status.
 *  3. Desktop High-Density View: Smooth toggle between visual Kanban board
 *     (@dnd-kit drag & drop) and high-density Real Estate Deal Table.
 *  4. Native Mobile Experience: PullToRefresh, clean stage tabs, and 1-tap
 *     action buttons (WhatsApp, Call, Schedule Visit, Move Stage).
 *  5. Real Estate Vertical Qualification: Live budget preview, brokerage
 *     calculation, and 1-click Schedule Site Visit integration.
 *  6. Cross-Module Wiring: Deep links to WhatsApp inbox, click-to-call, and
 *     direct ScheduleVisitSheet modal triggers.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Pipeline, PipelineStage, Deal, Profile } from '@/types';
import { PipelineBoard } from '@/components/pipelines/pipeline-board';
import { PipelineSettings } from '@/components/pipelines/pipeline-settings';
import { DealForm } from '@/components/pipelines/deal-form';
import { PipelineAnalytics } from '@/components/pipelines/pipeline-analytics';
import { DealTable } from '@/components/pipelines/deal-table';
import { ScheduleVisitSheet } from '@/components/site-visits/schedule-visit-sheet';
import { PageHeader } from '@/components/layout/page-header';
import { PullToRefresh } from '@/components/layout/pull-to-refresh';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  GitBranch,
  Plus,
  ChevronDown,
  Settings,
  Download,
  Trophy,
  XCircle,
  Kanban,
  TableProperties,
  Search,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCan } from '@/hooks/use-can';
import { useAuth } from '@/hooks/use-auth';
import { GatedButton } from '@/components/ui/gated-button';
import { useTranslations } from 'next-intl';

// Default stage seeding specification
const SPEC_DEFAULT_STAGES = [
  { name: 'New Lead', color: '#3b82f6', position: 0 },
  { name: 'Qualified', color: '#eab308', position: 1 },
  { name: 'Proposal Sent', color: '#f97316', position: 2 },
  { name: 'Negotiation', color: '#8b5cf6', position: 3 },
  { name: 'Booking / Token Paid', color: '#22c55e', position: 4 },
];

type StatusFilter = 'open' | 'won' | 'lost' | 'all';
type ViewMode = 'kanban' | 'table';

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

export default function PipelinesPage() {
  const t = useTranslations('Pipelines.page');
  const tBoard = useTranslations('Pipelines.board');
  const supabase = createClient();
  const canEditSettings = useCan('edit-settings');
  const canCreateDeals = useCan('send-messages');
  const { accountId, accountRole, defaultCurrency } = useAuth();

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [brokeragePct, setBrokeragePct] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // View mode: Kanban vs High-Density Table
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');

  // Search & Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedAssignee, setSelectedAssignee] = useState('all');
  const [selectedValueRange, setSelectedValueRange] = useState('all');

  // Dialog / Sheet states
  const [newPipelineOpen, setNewPipelineOpen] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Deal form sheet
  const [dealFormOpen, setDealFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [defaultStageId, setDefaultStageId] = useState<string>('');

  // Cross-module ScheduleVisitSheet
  const [scheduleVisitOpen, setScheduleVisitOpen] = useState(false);
  const [scheduleVisitContactId, setScheduleVisitContactId] = useState<string | undefined>(undefined);

  // Move deal bottom sheet
  const [moveDealId, setMoveDealId] = useState<string | null>(null);

  // Guard against double-seeding
  const seedAttempted = useRef(false);

  const loadPipelines = useCallback(async () => {
    const { data, error } = await supabase
      .from('pipelines')
      .select('*')
      .order('created_at');
    if (error) {
      console.error('Failed to load pipelines:', error.message);
      return [];
    }
    return (data ?? []) as Pipeline[];
  }, [supabase]);

  const loadStages = useCallback(
    async (pipelineId: string) => {
      const { data } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_id', pipelineId)
        .order('position');
      return (data ?? []) as PipelineStage[];
    },
    [supabase]
  );

  const loadDeals = useCallback(
    async (pipelineId: string) => {
      const { data } = await supabase
        .from('deals')
        .select(
          '*, contact:contacts(*, lead_details(*)), assignee:profiles!deals_assigned_to_fkey(*), lost_reason:lost_reasons(*)'
        )
        .eq('pipeline_id', pipelineId)
        .order('created_at', { ascending: false });
      return (data ?? []) as Deal[];
    },
    [supabase]
  );

  const loadProfiles = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    return (data ?? []) as Profile[];
  }, [supabase]);

  const loadBrokerageSettings = useCallback(async () => {
    if (!accountId) return;
    const { data } = await supabase
      .from('accounts')
      .select('settings')
      .eq('id', accountId)
      .single();
    const pct =
      ((data?.settings as Record<string, unknown> | null)
        ?.brokerage_pct as number | null) ?? 2;
    setBrokeragePct(pct);
  }, [accountId, supabase]);

  const seedDefaultPipeline =
    useCallback(async (): Promise<Pipeline | null> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || !accountId) return null;

      const { data: pipeline, error } = await supabase
        .from('pipelines')
        .insert({
          user_id: user.id,
          account_id: accountId,
          name: 'Sales Pipeline',
        })
        .select()
        .single();

      if (error || !pipeline) {
        console.error('Failed to seed pipeline:', error?.message);
        return null;
      }

      const stagesPayload = SPEC_DEFAULT_STAGES.map((s) => ({
        pipeline_id: pipeline.id,
        name: s.name,
        color: s.color,
        position: s.position,
      }));
      await supabase.from('pipeline_stages').insert(stagesPayload);

      return pipeline as Pipeline;
    }, [supabase, accountId]);

  // Initial load + seed-if-empty (deferred to satisfy React 19 effect rules)
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setLoading(true);
        const [list, profs] = await Promise.all([
          loadPipelines(),
          loadProfiles(),
        ]);
        await loadBrokerageSettings();

        let finalPipelines = list;
        const canSeed = accountRole === 'owner' || accountRole === 'admin';
        if (list.length === 0 && canSeed && !seedAttempted.current) {
          seedAttempted.current = true;
          const seeded = await seedDefaultPipeline();
          if (seeded) finalPipelines = await loadPipelines();
        }

        if (cancelled) return;
        setPipelines(finalPipelines);
        setProfiles(profs);
        if (finalPipelines.length > 0) {
          setSelectedPipelineId((prev) =>
            prev && finalPipelines.some((p) => p.id === prev) ? prev : finalPipelines[0].id
          );
        } else {
          setSelectedPipelineId('');
        }
        setLoading(false);
      })();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadPipelines, loadProfiles, loadBrokerageSettings, seedDefaultPipeline, accountRole]);

  // Load stages + deals whenever selected pipeline changes
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!selectedPipelineId) {
        setStages([]);
        setDeals([]);
        return;
      }
      void (async () => {
        const [s, d] = await Promise.all([
          loadStages(selectedPipelineId),
          loadDeals(selectedPipelineId),
        ]);
        if (cancelled) return;
        setStages(s);
        setDeals(d);
      })();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedPipelineId, loadStages, loadDeals]);

  const refreshPipelines = useCallback(async () => {
    const list = await loadPipelines();
    setPipelines(list);
    if (list.length === 0) setSelectedPipelineId('');
    else if (!list.some((p) => p.id === selectedPipelineId))
      setSelectedPipelineId(list[0].id);
  }, [loadPipelines, selectedPipelineId]);

  const refreshStages = useCallback(async () => {
    if (!selectedPipelineId) return;
    setStages(await loadStages(selectedPipelineId));
  }, [loadStages, selectedPipelineId]);

  const refreshDeals = useCallback(async () => {
    if (!selectedPipelineId) return;
    setDeals(await loadDeals(selectedPipelineId));
  }, [loadDeals, selectedPipelineId]);

  const handleDealMoved = useCallback(
    async (dealId: string, newStageId: string) => {
      // Optimistic update
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, stage_id: newStageId } : d))
      );
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage_id: newStageId }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.error === 'DEAL_NOT_YOURS') {
          setDeals((prev) => {
            const deal = prev.find((d) => d.id === dealId);
            const ownerName =
              deal?.assignee?.full_name ||
              deal?.assignee?.email ||
              'another agent';
            toast.error(
              `This lead belongs to ${ownerName}. Contact your admin to move it.`
            );
            return prev;
          });
        } else {
          toast.error(t('toastFailedMoveDeal'));
        }
        refreshDeals();
      }
    },
    [refreshDeals, t]
  );

  const handleAddDeal = useCallback(
    (stageId?: string) => {
      setEditingDeal(null);
      setDefaultStageId(stageId ?? stages[0]?.id ?? '');
      setDealFormOpen(true);
    },
    [stages]
  );

  const handleEditDeal = useCallback((deal: Deal) => {
    setEditingDeal(deal);
    setDefaultStageId(deal.stage_id);
    setDealFormOpen(true);
  }, []);

  const handleScheduleVisitFromDeal = useCallback((deal: Deal) => {
    if (deal.contact_id) {
      setScheduleVisitContactId(deal.contact_id);
      setScheduleVisitOpen(true);
    } else {
      toast.error('This deal does not have a linked contact');
    }
  }, []);

  const handleScheduleVisitFromContactId = useCallback((contactId: string) => {
    setScheduleVisitContactId(contactId);
    setScheduleVisitOpen(true);
  }, []);

  async function handleCreatePipeline() {
    const name = newPipelineName.trim();
    if (!name) return;
    setCreating(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user || !accountId) {
      toast.error(t('toastNotLinkedToAccount'));
      setCreating(false);
      return;
    }

    const { data: pipeline, error } = await supabase
      .from('pipelines')
      .insert({ user_id: user.id, account_id: accountId, name })
      .select()
      .single();

    if (error || !pipeline) {
      toast.error(t('toastFailedCreatePipeline'));
      setCreating(false);
      return;
    }

    const stagesPayload = SPEC_DEFAULT_STAGES.map((s) => ({
      pipeline_id: pipeline.id,
      name: s.name,
      color: s.color,
      position: s.position,
    }));
    await supabase.from('pipeline_stages').insert(stagesPayload);

    setNewPipelineName('');
    setNewPipelineOpen(false);
    setSelectedPipelineId(pipeline.id);
    await refreshPipelines();
    setCreating(false);
    toast.success(t('toastPipelineCreated'));
  }

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);

  // Status counts for tabs
  const openDeals = useMemo(
    () => deals.filter((d) => d.status === 'open' || !d.status),
    [deals]
  );
  const wonDeals = useMemo(
    () => deals.filter((d) => d.status === 'won'),
    [deals]
  );
  const lostDeals = useMemo(
    () => deals.filter((d) => d.status === 'lost'),
    [deals]
  );

  const filterCounts: Record<StatusFilter, number> = {
    open: openDeals.length,
    won: wonDeals.length,
    lost: lostDeals.length,
    all: deals.length,
  };

  // Multi-dimensional filtering across omni-search, status, source, assignee, value range
  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      // 1. Status Filter
      if (statusFilter === 'open' && deal.status !== 'open' && deal.status) return false;
      if (statusFilter === 'won' && deal.status !== 'won') return false;
      if (statusFilter === 'lost' && deal.status !== 'lost') return false;

      // 2. Omni-search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const titleMatch = deal.title?.toLowerCase().includes(q);
        const contactNameMatch = deal.contact?.name?.toLowerCase().includes(q);
        const contactPhoneMatch = deal.contact?.phone?.toLowerCase().includes(q);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const locationMatch = (deal.contact as any)?.lead_details?.location_preference?.toLowerCase().includes(q);
        const notesMatch = deal.notes?.toLowerCase().includes(q);
        if (!titleMatch && !contactNameMatch && !contactPhoneMatch && !locationMatch && !notesMatch) {
          return false;
        }
      }

      // 3. Source Filter
      if (selectedSource !== 'all') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const src = (deal.contact as any)?.lead_details?.source || 'Manual Entry';
        if (src.toLowerCase() !== selectedSource.toLowerCase()) return false;
      }

      // 4. Assignee Filter
      if (selectedAssignee !== 'all') {
        if (selectedAssignee === 'unassigned') {
          if (deal.assigned_to) return false;
        } else {
          if (deal.assigned_to !== selectedAssignee) return false;
        }
      }

      // 5. Value Range Filter
      if (selectedValueRange !== 'all') {
        const v = Number(deal.value || 0);
        if (selectedValueRange === 'under_50l' && v >= 5000000) return false;
        if (selectedValueRange === '50l_to_1cr' && (v < 5000000 || v >= 10000000)) return false;
        if (selectedValueRange === '1cr_to_25cr' && (v < 10000000 || v > 25000000)) return false;
        if (selectedValueRange === 'above_25cr' && v <= 25000000) return false;
      }

      return true;
    });
  }, [deals, statusFilter, search, selectedSource, selectedAssignee, selectedValueRange]);

  const hasActiveFilters =
    search.trim() !== '' ||
    selectedSource !== 'all' ||
    selectedAssignee !== 'all' ||
    selectedValueRange !== 'all';

  const activeFiltersCount =
    (search.trim() ? 1 : 0) +
    (selectedSource !== 'all' ? 1 : 0) +
    (selectedAssignee !== 'all' ? 1 : 0) +
    (selectedValueRange !== 'all' ? 1 : 0);

  function clearAllFilters() {
    setSearch('');
    setSelectedSource('all');
    setSelectedAssignee('all');
    setSelectedValueRange('all');
  }

  const moveDeal = moveDealId ? deals.find((d) => d.id === moveDealId) : null;

  if (loading) {
    return (
      <div className="space-y-6 pb-20">
        <div className="flex items-center justify-between">
          <div className="bg-muted h-8 w-48 animate-pulse rounded" />
          <div className="bg-muted h-9 w-28 animate-pulse rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-muted/50 h-20 animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="flex gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="bg-muted/50 h-96 w-72 animate-pulse rounded-xl"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh
      onRefresh={async () => {
        await Promise.all([refreshPipelines(), refreshStages(), refreshDeals()]);
      }}
    >
      <div className="space-y-5 pb-20">
        {/* Page Header */}
        <PageHeader
          title={
            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger className="border-border bg-card text-foreground hover:bg-muted data-[popup-open]:bg-muted inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-base font-bold shadow-xs transition-colors">
                  <GitBranch className="text-primary size-4" />
                  <span>{selectedPipeline?.name ?? t('selectPipeline')}</span>
                  <ChevronDown className="text-muted-foreground size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="border-border bg-popover text-popover-foreground w-64"
                >
                  {pipelines.length === 0 && (
                    <DropdownMenuItem disabled className="text-muted-foreground">
                      {t('noPipelinesYet')}
                    </DropdownMenuItem>
                  )}
                  {pipelines.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => setSelectedPipelineId(p.id)}
                      className={
                        p.id === selectedPipelineId
                          ? 'text-primary font-semibold'
                          : 'text-popover-foreground'
                      }
                    >
                      <GitBranch className="mr-2 size-3.5" />
                      {p.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator className="bg-border" />
                  {selectedPipeline && (
                    <DropdownMenuItem
                      onClick={() => setSettingsOpen(true)}
                      className="text-popover-foreground"
                    >
                      <Settings className="mr-2 size-3.5" />
                      {t('managePipelines')}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
          subtitle={t('subtitle')}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <GatedButton
                variant="outline"
                size="sm"
                canAct={canEditSettings}
                gateReason="export deals"
                onClick={() => {
                  window.open('/api/deals/export', '_self');
                }}
                className="border-border bg-card text-foreground hover:bg-muted shadow-xs text-xs"
              >
                <Download className="mr-1 size-3.5" />
                {t('exportDeals')}
              </GatedButton>

              <GatedButton
                variant="outline"
                size="sm"
                canAct={canEditSettings}
                gateReason="create pipelines"
                onClick={() => setNewPipelineOpen(true)}
                className="border-border bg-card text-foreground hover:bg-muted shadow-xs text-xs"
              >
                <Plus className="mr-1 size-3.5" />
                {t('addPipeline')}
              </GatedButton>

              <GatedButton
                size="sm"
                canAct={canCreateDeals}
                gateReason="create deals"
                disabled={!selectedPipelineId || stages.length === 0}
                onClick={() => handleAddDeal()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs text-xs"
              >
                <Plus className="mr-1 size-3.5" />
                {t('addDeal')}
              </GatedButton>
            </div>
          }
        />

        {/* Situational Awareness KPI Strip */}
        {pipelines.length > 0 && (
          <PipelineAnalytics
            stages={stages}
            deals={deals}
            activeFilter={statusFilter}
            onFilterChange={setStatusFilter}
          />
        )}

        {/* Real Estate Filtering & Omni-Search Toolbar */}
        {pipelines.length > 0 && (
          <div className="border-border/70 bg-card rounded-xl border p-3 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row gap-2.5">
              {/* Omni-Search Box */}
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="bg-muted/40 border-border placeholder:text-muted-foreground w-full rounded-lg border py-1.5 pr-8 pl-9 text-xs focus:ring-primary/30"
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

              {/* Multi-Dimensional Filter Dropdowns */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Source Filter */}
                <Select
                  value={selectedSource}
                  onValueChange={(val) => setSelectedSource(val || 'all')}
                >
                  <SelectTrigger className="bg-muted/40 border-border text-foreground text-xs h-8.5 min-w-[130px]">
                    <SelectValue placeholder={t('filterSource')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('filterAllSources')}</SelectItem>
                    {KNOWN_SOURCES.map((src) => (
                      <SelectItem key={src} value={src}>
                        {src}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Assignee / Agent Filter */}
                {profiles.length > 0 && (
                  <Select
                    value={selectedAssignee}
                    onValueChange={(val) => setSelectedAssignee(val || 'all')}
                  >
                    <SelectTrigger className="bg-muted/40 border-border text-foreground text-xs h-8.5 min-w-[130px]">
                      <SelectValue placeholder={t('filterAssignee')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('filterAllAssignees')}</SelectItem>
                      <SelectItem value="unassigned">{t('filterUnassigned')}</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name || p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Deal Value Range Filter */}
                <Select
                  value={selectedValueRange}
                  onValueChange={(val) => setSelectedValueRange(val || 'all')}
                >
                  <SelectTrigger className="bg-muted/40 border-border text-foreground text-xs h-8.5 min-w-[130px]">
                    <SelectValue placeholder={t('filterValueRange')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('filterAllValues')}</SelectItem>
                    <SelectItem value="under_50l">{t('filterUnder50L')}</SelectItem>
                    <SelectItem value="50l_to_1cr">{t('filter50LTo1Cr')}</SelectItem>
                    <SelectItem value="1cr_to_25cr">{t('filter1CrTo25Cr')}</SelectItem>
                    <SelectItem value="above_25cr">{t('filterAbove25Cr')}</SelectItem>
                  </SelectContent>
                </Select>

                {/* Clear All Filters */}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="text-muted-foreground hover:text-foreground text-xs h-8.5 px-2.5"
                  >
                    <X className="mr-1 size-3.5" />
                    {t('clearFilters')}
                  </Button>
                )}
              </div>
            </div>

            {/* Status Tabs & Desktop View Mode Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-2.5">
              {/* Status Filter Tabs */}
              <div className="border-border bg-muted/40 flex gap-1 rounded-lg border p-0.5">
                {(
                  [
                    {
                      key: 'open' as StatusFilter,
                      label: t('filterOpen'),
                      icon: <Kanban className="size-3.5" />,
                    },
                    {
                      key: 'won' as StatusFilter,
                      label: t('filterWon'),
                      icon: <Trophy className="size-3.5" />,
                    },
                    {
                      key: 'lost' as StatusFilter,
                      label: t('filterLost'),
                      icon: <XCircle className="size-3.5" />,
                    },
                    {
                      key: 'all' as StatusFilter,
                      label: t('filterAll'),
                      icon: null,
                    },
                  ] as { key: StatusFilter; label: string; icon: React.ReactNode }[]
                ).map(({ key, label, icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatusFilter(key)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      statusFilter === key
                        ? 'bg-card text-foreground shadow-xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {icon}
                    {label}
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                        statusFilter === key
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {filterCounts[key]}
                    </span>
                  </button>
                ))}
              </div>

              {/* View Switcher: Kanban vs Table (desktop) */}
              <div className="hidden sm:flex items-center gap-1">
                {hasActiveFilters && (
                  <span className="text-muted-foreground text-xs mr-2">
                    {t('activeFiltersCount', { count: activeFiltersCount })}
                  </span>
                )}
                {statusFilter === 'open' && (
                  <div className="border-border bg-muted/40 flex items-center rounded-lg border p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode('kanban')}
                      title={t('viewKanban')}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        viewMode === 'kanban'
                          ? 'bg-card text-foreground shadow-xs font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Kanban className="size-3.5" />
                      <span>{t('viewKanban')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('table')}
                      title={t('viewTable')}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        viewMode === 'table'
                          ? 'bg-card text-foreground shadow-xs font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <TableProperties className="size-3.5" />
                      <span>{t('viewTable')}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Board or Table based on selected filter and view mode */}
        {pipelines.length === 0 ? (
          <div className="border-border flex flex-col items-center justify-center rounded-xl border border-dashed py-20">
            <GitBranch className="text-muted-foreground size-12" />
            <h3 className="text-foreground mt-4 text-lg font-medium">
              {t('noPipelinesYet')}
            </h3>
            <p className="text-muted-foreground mt-2 text-sm">
              {t('createToStartTracking')}
            </p>
            <GatedButton
              canAct={canEditSettings}
              gateReason="create pipelines"
              onClick={() => setNewPipelineOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4"
            >
              <Plus className="mr-1 size-4" />
              {t('createPipeline')}
            </GatedButton>
          </div>
        ) : statusFilter === 'open' && viewMode === 'kanban' ? (
          <PipelineBoard
            stages={stages}
            deals={filteredDeals}
            onDealMoved={handleDealMoved}
            onAddDeal={handleAddDeal}
            onEditDeal={handleEditDeal}
            onScheduleVisit={handleScheduleVisitFromDeal}
          />
        ) : (
          <DealTable
            deals={filteredDeals}
            stages={stages}
            brokeragePct={brokeragePct}
            defaultCurrency={defaultCurrency}
            onEditDeal={handleEditDeal}
            onMoveDeal={(d) => setMoveDealId(d.id)}
            onScheduleVisit={handleScheduleVisitFromDeal}
          />
        )}

        {/* New Pipeline Dialog */}
        <Dialog open={newPipelineOpen} onOpenChange={setNewPipelineOpen}>
          <DialogContent className="bg-popover border-border sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-popover-foreground">
                {t('newPipeline')}
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <Label className="text-muted-foreground">{t('pipelineName')}</Label>
              <Input
                value={newPipelineName}
                onChange={(e) => setNewPipelineName(e.target.value)}
                placeholder={t('pipelineNamePlaceholder')}
                className="bg-muted border-border text-foreground mt-2"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreatePipeline();
                }}
              />
              <p className="text-muted-foreground mt-2 text-xs">
                {t('defaultStagesDesc')}
              </p>
            </div>
            <DialogFooter className="bg-popover/50 border-border">
              <Button
                variant="outline"
                onClick={() => setNewPipelineOpen(false)}
                className="border-border text-muted-foreground hover:bg-muted"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleCreatePipeline}
                disabled={creating || !newPipelineName.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {creating ? t('creating') : t('createPipelineBtn')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Pipeline Settings */}
        {selectedPipeline && (
          <PipelineSettings
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            pipeline={selectedPipeline}
            stages={stages}
            onPipelinesChanged={refreshPipelines}
            onStagesChanged={refreshStages}
            onCreateNewPipeline={() => {
              setSettingsOpen(false);
              setNewPipelineOpen(true);
            }}
          />
        )}

        {/* Deal Form (Sheet) */}
        <DealForm
          open={dealFormOpen}
          onOpenChange={setDealFormOpen}
          deal={editingDeal}
          pipelineId={selectedPipelineId}
          stages={stages}
          defaultStageId={defaultStageId}
          onSaved={refreshDeals}
          onScheduleVisit={handleScheduleVisitFromContactId}
        />

        {/* Cross-Module Schedule Visit Sheet */}
        <ScheduleVisitSheet
          open={scheduleVisitOpen}
          onOpenChange={setScheduleVisitOpen}
          defaultContactId={scheduleVisitContactId}
          onSuccess={() => {
            setScheduleVisitOpen(false);
            refreshDeals();
          }}
        />

        {/* Move Deal Stage Bottom Sheet */}
        <Sheet
          open={!!moveDealId}
          onOpenChange={(open) => !open && setMoveDealId(null)}
        >
          <SheetContent
            side="bottom"
            className="bg-popover border-border rounded-t-xl border-t sm:mx-auto sm:max-w-md"
          >
            <SheetHeader className="mb-4">
              <SheetTitle className="text-left">{tBoard('moveToStage')}</SheetTitle>
            </SheetHeader>
            <div className="space-y-2">
              {stages.map((stage) => {
                const isActive = moveDeal?.stage_id === stage.id;
                return (
                  <button
                    key={stage.id}
                    onClick={() => {
                      if (!isActive && moveDealId) {
                        handleDealMoved(moveDealId, stage.id);
                      }
                      setMoveDealId(null);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg border p-3 transition-colors ${
                      isActive
                        ? 'bg-primary/10 border-primary/20 text-primary cursor-default'
                        : 'bg-card border-border hover:bg-muted text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="text-sm font-medium">{stage.name}</span>
                    </div>
                    {isActive && (
                      <span className="text-xs font-semibold">
                        {tBoard('currentStage')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </PullToRefresh>
  );
}
