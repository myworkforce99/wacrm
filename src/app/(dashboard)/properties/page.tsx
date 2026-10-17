'use client';

/**
 * Properties & Inventory Page
 *
 * Real Estate Vertical CRM Inventory Management:
 *  - Situational awareness KPI stat cards (Total Units, Ready to Move, Under Construction, Portfolio Value in ₹ Cr)
 *  - Multi-dimensional filters (Omni-search, BHK Configuration, Possession Status, Property Type, Price Bracket)
 *  - High-density Desktop Table with clear columns, RERA badges, ₹ INR pricing, and 1-click inline actions
 *  - Native Mobile Cards layout with 1-tap action buttons (Schedule Visit, WhatsApp Share, Edit, Delete)
 *  - Full integration with PropertyFormModal, PropertyShareModal, PropertyDeleteDialog, and ScheduleVisitSheet
 *  - Full i18n support, dark & light mode styling, and React 19 safety
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import { useCan } from '@/hooks/use-can';
import { useAuth } from '@/hooks/use-auth';
import { canManageMembers } from '@/lib/auth/roles';
import { formatINR } from '@/lib/currency';
import { PullToRefresh } from '@/components/layout/pull-to-refresh';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Plus,
  Building,
  MapPin,
  IndianRupee,
  Loader2,
  Calendar,
  MessageCircle,
  MoreVertical,
  Pencil,
  Trash2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Key,
  LayoutGrid,
  TableProperties,
  Compass,
  X,
} from 'lucide-react';
import type { Property } from '@/types';
import { PROPERTY_CONFIGURATIONS } from '@/types';
import { PropertyFormModal } from '@/components/properties/property-form-modal';
import { PropertyShareModal } from '@/components/properties/property-share-modal';
import { PropertyDeleteDialog } from '@/components/properties/property-delete-dialog';
import { ScheduleVisitSheet } from '@/components/site-visits/schedule-visit-sheet';
import { cn } from '@/lib/utils';

const PROPERTY_TYPES = [
  'Apartment',
  'Villa',
  'Plot',
  'Commercial',
  'Penthouse',
  'Builder Floor',
];

export default function PropertiesPage() {
  const t = useTranslations('Properties.page');
  const tForm = useTranslations('Properties.form');
  const router = useRouter();
  const supabase = createClient();
  const isViewOnly = useCan('view-only');
  const { accountRole } = useAuth();
  const isManager = accountRole ? canManageMembers(accountRole) : false;
  const canManageInventory = isManager && !isViewOnly;

  // Data states
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [search, setSearch] = useState('');
  const [configFilter, setConfigFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [possessionFilter, setPossessionFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Modal states
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharingProperty, setSharingProperty] = useState<Property | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpenOpen] = useState(false);
  const [deletingProperty, setDeletingProperty] = useState<Property | null>(
    null
  );

  const [scheduleSheetOpen, setScheduleSheetOpen] = useState(false);
  const [selectedPropertyForVisit, setSelectedPropertyForVisit] = useState<
    string | undefined
  >(undefined);

  // Fetch properties from Supabase
  const fetchProperties = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching properties:', error);
    } else {
      setProperties((data ?? []) as Property[]);
    }
    setLoading(false);
  }, [supabase]);

  // React 19 safe deferred fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchProperties();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchProperties]);

  // KPI Calculations
  const stats = useMemo(() => {
    const totalUnits = properties.length;
    let readyToMove = 0;
    let underConstruction = 0;
    let portfolioValue = 0;

    for (const p of properties) {
      if (p.possession_status === 'ready_to_move') {
        readyToMove++;
      } else if (
        p.possession_status === 'under_construction' ||
        p.possession_status === 'nearing_possession'
      ) {
        underConstruction++;
      }
      if (p.price) {
        portfolioValue += Number(p.price);
      }
    }

    return {
      totalUnits,
      readyToMove,
      underConstruction,
      portfolioValue,
    };
  }, [properties]);

  // Multi-dimensional filtering logic
  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      // 1. Omni search
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesTitle = property.title?.toLowerCase().includes(q);
        const matchesProject = property.project_name?.toLowerCase().includes(q);
        const matchesBuilder = property.builder_name?.toLowerCase().includes(q);
        const matchesLocation = property.location?.toLowerCase().includes(q);
        const matchesRera = property.rera_id?.toLowerCase().includes(q);
        if (
          !matchesTitle &&
          !matchesProject &&
          !matchesBuilder &&
          !matchesLocation &&
          !matchesRera
        ) {
          return false;
        }
      }

      // 2. Configuration filter
      if (configFilter !== 'all') {
        if (property.configuration !== configFilter) {
          return false;
        }
      }

      // 3. Property Type filter
      if (typeFilter !== 'all') {
        if (property.property_type !== typeFilter) {
          return false;
        }
      }

      // 4. Possession Status filter
      if (possessionFilter !== 'all') {
        if (property.possession_status !== possessionFilter) {
          return false;
        }
      }

      // 5. Price Bracket filter
      if (priceFilter !== 'all') {
        const price = Number(property.price) || 0;
        if (priceFilter === 'under_50l' && price >= 5000000) return false;
        if (
          priceFilter === '50l_to_1cr' &&
          (price < 5000000 || price > 10000000)
        )
          return false;
        if (
          priceFilter === '1cr_to_2cr' &&
          (price < 10000000 || price > 20000000)
        )
          return false;
        if (
          priceFilter === '2cr_to_5cr' &&
          (price < 20000000 || price > 50000000)
        )
          return false;
        if (priceFilter === 'above_5cr' && price <= 50000000) return false;
      }

      return true;
    });
  }, [
    properties,
    search,
    configFilter,
    typeFilter,
    possessionFilter,
    priceFilter,
  ]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count++;
    if (configFilter !== 'all') count++;
    if (typeFilter !== 'all') count++;
    if (possessionFilter !== 'all') count++;
    if (priceFilter !== 'all') count++;
    return count;
  }, [search, configFilter, typeFilter, possessionFilter, priceFilter]);

  function handleClearFilters() {
    setSearch('');
    setConfigFilter('all');
    setTypeFilter('all');
    setPossessionFilter('all');
    setPriceFilter('all');
  }

  // Action handlers
  function handleOpenCreate() {
    if (!canManageInventory) return;
    setEditingProperty(null);
    setFormModalOpen(true);
  }

  function handleOpenEdit(property: Property) {
    if (!canManageInventory) return;
    setEditingProperty(property);
    setFormModalOpen(true);
  }

  function handleOpenShare(property: Property) {
    setSharingProperty(property);
    setShareModalOpen(true);
  }

  function handleOpenDelete(property: Property) {
    if (!canManageInventory) return;
    setDeletingProperty(property);
    setDeleteDialogOpenOpen(true);
  }

  function handleOpenScheduleVisit(propertyId: string) {
    setSelectedPropertyForVisit(propertyId);
    setScheduleSheetOpen(true);
  }

  function handlePropertySaved(saved: Property) {
    setProperties((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  }

  function handlePropertyDeleted(id: string) {
    setProperties((prev) => prev.filter((p) => p.id !== id));
  }

  // Helper renderer for Possession Badge
  function renderPossessionBadge(status?: string | null, date?: string | null) {
    if (!status) return null;

    if (status === 'ready_to_move') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
          <Key className="size-3" />
          {t('statReady')}
        </span>
      );
    }

    if (status === 'under_construction') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400">
          <Clock className="size-3" />
          {t('statUnderConst')}
          {date && (
            <span className="text-[10px] opacity-80">
              ({new Date(date).getFullYear()})
            </span>
          )}
        </span>
      );
    }

    if (status === 'nearing_possession') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 ring-1 ring-blue-500/20 dark:text-blue-400">
          <Clock className="size-3" />
          {t('statUnderConst')}
        </span>
      );
    }

    return (
      <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
        {status}
      </span>
    );
  }

  // Helper renderer for RERA Badge
  function renderReraBadge(reraId?: string | null) {
    if (reraId && reraId.trim()) {
      return (
        <Badge
          variant="outline"
          className="gap-1 border-emerald-500/30 bg-emerald-500/10 font-mono text-[11px] text-emerald-700 dark:text-emerald-400"
        >
          <ShieldCheck className="size-3 shrink-0" />
          <span className="max-w-[120px] truncate">{reraId}</span>
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="gap-1 border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-400"
      >
        <AlertTriangle className="size-3 shrink-0" />
        {t('reraIdMissing')}
      </Badge>
    );
  }

  return (
    <PullToRefresh onRefresh={fetchProperties}>
      <div className="space-y-6 pb-20">
        {/* Page Header */}
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle')}
          action={
            canManageInventory ? (
              <Button
                onClick={handleOpenCreate}
                className="gap-1.5 shadow-sm"
              >
                <Plus className="size-4" />
                {t('addProperty')}
              </Button>
            ) : null
          }
        />

        {/* 1. Situational Awareness KPI Strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Card 1: Total Units */}
          <Card className="border-border/60 bg-card/60 shadow-xs">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  {t('statTotal')}
                </span>
                <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
                  <Building className="size-4" />
                </div>
              </div>
              <div className="text-foreground mt-2 text-2xl font-bold tracking-tight">
                {stats.totalUnits}
              </div>
              <p className="text-muted-foreground mt-1 text-[11px]">
                {t('statTotalSub')}
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Ready to Move */}
          <Card className="border-border/60 bg-card/60 shadow-xs">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  {t('statReady')}
                </span>
                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Key className="size-4" />
                </div>
              </div>
              <div className="text-foreground mt-2 text-2xl font-bold tracking-tight">
                {stats.readyToMove}
              </div>
              <p className="text-muted-foreground mt-1 text-[11px]">
                {t('statReadySub')}
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Under Construction */}
          <Card className="border-border/60 bg-card/60 shadow-xs">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  {t('statUnderConst')}
                </span>
                <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Clock className="size-4" />
                </div>
              </div>
              <div className="text-foreground mt-2 text-2xl font-bold tracking-tight">
                {stats.underConstruction}
              </div>
              <p className="text-muted-foreground mt-1 text-[11px]">
                {t('statUnderConstSub')}
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Portfolio Value */}
          <Card className="border-border/60 bg-card/60 shadow-xs">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  {t('statPortfolio')}
                </span>
                <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <IndianRupee className="size-4" />
                </div>
              </div>
              <div className="text-foreground mt-2 text-2xl font-bold tracking-tight">
                {stats.portfolioValue > 0
                  ? formatINR(stats.portfolioValue)
                  : '₹0'}
              </div>
              <p className="text-muted-foreground mt-1 text-[11px]">
                {t('statPortfolioSub')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 2. Omni-Search Toolbar & Multi-Dimensional Filters */}
        <div className="border-border/70 bg-card/40 space-y-3 rounded-xl border p-3 shadow-xs">
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
            {/* Omni search input */}
            <div className="relative max-w-md flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="bg-card border-border text-foreground placeholder:text-muted-foreground h-9 pr-8 pl-8.5 text-xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Actions: Clear Filters & View Mode Toggle */}
            <div className="flex shrink-0 items-center gap-2 self-end md:self-auto">
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-8 gap-1 border border-red-200/60 bg-red-50 px-2.5 text-xs font-medium text-red-600 shadow-2xs transition-colors hover:border-red-300 hover:bg-red-100 hover:text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400 dark:hover:border-red-800 dark:hover:bg-red-900/50 dark:hover:text-red-300"
                >
                  <X className="size-3.5" />
                  {t('clearFilters')} ({activeFiltersCount})
                </Button>
              )}
              {/* View Mode Toggle (Table vs Grid) */}
              <div className="border-border bg-muted/40 hidden items-center rounded-lg border p-0.5 sm:flex">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-all select-none',
                    viewMode === 'table'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title={t('viewTable')}
                >
                  <TableProperties className="size-3.5" />
                  <span>{t('viewTable')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-all select-none',
                    viewMode === 'grid'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title={t('viewGrid')}
                >
                  <LayoutGrid className="size-3.5" />
                  <span>{t('viewGrid')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filter dropdowns row (Fixed width, zero layout shift) */}
          <div className="border-border/50 flex flex-wrap items-center gap-2 border-t pt-2">
            {/* BHK / Config */}
            <Select
              value={configFilter}
              onValueChange={(val) => setConfigFilter(val || 'all')}
            >
              <SelectTrigger
                label={t('filterConfig')}
                className="bg-card h-9 min-w-[140px] text-xs"
              >
                <SelectValue placeholder={t('allConfigs')} />
              </SelectTrigger>
              <SelectContent>
                <SelectLabel>{t('filterConfig')}</SelectLabel>
                <SelectSeparator />
                <SelectItem value="all">
                  {t('allConfigs')}
                </SelectItem>
                {PROPERTY_CONFIGURATIONS.map((cfg) => (
                  <SelectItem key={cfg} value={cfg}>
                    {cfg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Property Type */}
            <Select
              value={typeFilter}
              onValueChange={(val) => setTypeFilter(val || 'all')}
            >
              <SelectTrigger
                label={t('filterType')}
                className="bg-card h-9 min-w-[140px] text-xs"
              >
                <SelectValue placeholder={t('allTypes')} />
              </SelectTrigger>
              <SelectContent>
                <SelectLabel>{t('filterType')}</SelectLabel>
                <SelectSeparator />
                <SelectItem value="all">
                  {t('allTypes')}
                </SelectItem>
                {PROPERTY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Possession Status */}
            <Select
              value={possessionFilter}
              onValueChange={(val) => setPossessionFilter(val || 'all')}
            >
              <SelectTrigger
                label={t('filterPossession')}
                className="bg-card h-9 min-w-[155px] text-xs"
              >
                <SelectValue placeholder={t('allPossessions')} />
              </SelectTrigger>
              <SelectContent>
                <SelectLabel>{t('filterPossession')}</SelectLabel>
                <SelectSeparator />
                <SelectItem value="all">
                  {t('allPossessions')}
                </SelectItem>
                <SelectItem value="ready_to_move">
                  {t('statReady')}
                </SelectItem>
                <SelectItem value="under_construction">
                  {t('statUnderConst')}
                </SelectItem>
                <SelectItem value="nearing_possession">
                  {tForm('possessionNearing')}
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Price Bracket */}
            <Select
              value={priceFilter}
              onValueChange={(val) => setPriceFilter(val || 'all')}
            >
              <SelectTrigger
                label={t('filterPrice')}
                className="bg-card h-9 min-w-[150px] text-xs"
              >
                <SelectValue placeholder={t('allPrices')} />
              </SelectTrigger>
              <SelectContent>
                <SelectLabel>{t('filterPrice')}</SelectLabel>
                <SelectSeparator />
                <SelectItem value="all">
                  {t('allPrices')}
                </SelectItem>
                <SelectItem value="under_50l">
                  {t('priceUnder50L')}
                </SelectItem>
                <SelectItem value="50l_to_1cr">
                  {t('price50Lto1Cr')}
                </SelectItem>
                <SelectItem value="1cr_to_2cr">
                  {t('price1Crto2Cr')}
                </SelectItem>
                <SelectItem value="2cr_to_5cr">
                  {t('price2Crto5Cr')}
                </SelectItem>
                <SelectItem value="above_5cr">
                  {t('priceAbove5Cr')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 3. Content Display (Loading / Empty / Table / Grid) */}
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <Loader2 className="text-primary size-7 animate-spin" />
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="border-border flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-16 text-center">
            <div className="bg-muted flex size-12 items-center justify-center rounded-full">
              <Building className="text-muted-foreground size-6" />
            </div>
            <div>
              <p className="text-foreground font-semibold">
                {t('noProperties')}
              </p>
              <p className="text-muted-foreground mt-1 max-w-sm text-xs">
                {t('noPropertiesSub')}
              </p>
            </div>
            {activeFiltersCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="mt-2 gap-1 border border-red-200/60 bg-red-50 text-xs font-medium text-red-600 shadow-2xs transition-colors hover:border-red-300 hover:bg-red-100 hover:text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400 dark:hover:border-red-800 dark:hover:bg-red-900/50 dark:hover:text-red-300"
              >
                <X className="size-3.5" />
                {t('clearFilters')} ({activeFiltersCount})
              </Button>
            ) : (
              canManageInventory && (
                <Button
                  size="sm"
                  onClick={handleOpenCreate}
                  className="mt-2 gap-1.5 text-xs"
                >
                  <Plus className="size-3.5" />
                  {t('addProperty')}
                </Button>
              )
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View (Hidden on mobile or when grid selected) */}
            {viewMode === 'table' ? (
              <div className="border-border bg-card hidden overflow-x-auto rounded-xl border shadow-xs md:block">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[320px] text-xs font-semibold">
                        {t('colProperty')}
                      </TableHead>
                      <TableHead className="w-[180px] text-xs font-semibold">
                        {t('colConfig')}
                      </TableHead>
                      <TableHead className="w-[200px] text-xs font-semibold">
                        {t('colLocation')}
                      </TableHead>
                      <TableHead className="w-[140px] text-xs font-semibold">
                        {t('colPrice')}
                      </TableHead>
                      <TableHead className="w-[160px] text-xs font-semibold">
                        {t('colPossession')}
                      </TableHead>
                      <TableHead className="w-[150px] text-xs font-semibold">
                        {t('colRera')}
                      </TableHead>
                      <TableHead className="w-[130px] text-right text-xs font-semibold">
                        {t('colActions')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProperties.map((property) => (
                      <TableRow
                        key={property.id}
                        className="group hover:bg-muted/40 transition-colors"
                      >
                        {/* Column 1: Property & Project */}
                        <TableCell className="py-3 align-top">
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(`/properties/${property.id}`)
                              }
                              className="text-foreground hover:text-primary line-clamp-1 block text-left text-sm font-medium transition-colors"
                            >
                              {property.title}
                            </button>
                            {(property.project_name ||
                              property.builder_name) && (
                              <p className="text-muted-foreground truncate text-xs">
                                {[property.project_name, property.builder_name]
                                  .filter(Boolean)
                                  .join(' • ')}
                              </p>
                            )}
                            {property.tags && property.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {property.tags.slice(0, 2).map((tag, i) => (
                                  <span
                                    key={i}
                                    className="bg-muted text-muted-foreground py-0.2 rounded px-1.5 text-[10px]"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {property.tags.length > 2 && (
                                  <span className="text-muted-foreground text-[10px]">
                                    +{property.tags.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Column 2: Configuration & Area */}
                        <TableCell className="py-3 align-top">
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center gap-1.5">
                              {property.configuration && (
                                <span className="text-primary font-semibold">
                                  {property.configuration}
                                </span>
                              )}
                              {property.carpet_area && (
                                <span className="text-muted-foreground">
                                  • {property.carpet_area} {t('sqft')}
                                </span>
                              )}
                            </div>
                            {property.facing && (
                              <p className="text-muted-foreground flex items-center gap-1 text-[11px]">
                                <Compass className="size-3" />
                                {property.facing} {t('facingSuffix')}
                              </p>
                            )}
                          </div>
                        </TableCell>

                        {/* Column 3: Location */}
                        <TableCell className="py-3 align-top">
                          {property.location ? (
                            <div className="text-muted-foreground flex items-start gap-1 text-xs">
                              <MapPin className="mt-0.5 size-3.5 shrink-0" />
                              <span className="line-clamp-2">
                                {property.location}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              -
                            </span>
                          )}
                        </TableCell>

                        {/* Column 4: Price */}
                        <TableCell className="py-3 align-top">
                          {property.price ? (
                            <span className="text-foreground text-xs font-semibold whitespace-nowrap">
                              {formatINR(property.price)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              -
                            </span>
                          )}
                        </TableCell>

                        {/* Column 5: Possession */}
                        <TableCell className="py-3 align-top">
                          {renderPossessionBadge(
                            property.possession_status,
                            property.possession_date
                          )}
                        </TableCell>

                        {/* Column 6: RERA */}
                        <TableCell className="py-3 align-top">
                          {renderReraBadge(property.rera_id)}
                        </TableCell>

                        {/* Column 7: Actions */}
                        <TableCell className="py-3 text-right align-top">
                          <div className="flex items-center justify-end gap-1">
                            {/* Schedule Site Visit */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                handleOpenScheduleVisit(property.id)
                              }
                              title={t('actionScheduleVisit')}
                              className="text-muted-foreground hover:text-primary size-8"
                            >
                              <Calendar className="size-3.5" />
                            </Button>

                            {/* Share on WhatsApp */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenShare(property)}
                              title={t('actionShare')}
                              className="text-muted-foreground size-8 hover:text-emerald-600 dark:hover:text-emerald-400"
                            >
                              <MessageCircle className="size-3.5" />
                            </Button>

                            {/* More Actions Dropdown */}
                            <DropdownMenu>
                              <DropdownMenuTrigger className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors">
                                <MoreVertical className="size-3.5" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                  onClick={() =>
                                    router.push(`/properties/${property.id}`)
                                  }
                                  className="cursor-pointer gap-2 text-xs"
                                >
                                  <ExternalLink className="size-3.5" />
                                  {t('actionViewDetails')}
                                </DropdownMenuItem>
                                {canManageInventory && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => handleOpenEdit(property)}
                                      className="cursor-pointer gap-2 text-xs"
                                    >
                                      <Pencil className="size-3.5" />
                                      {t('actionEdit')}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleOpenDelete(property)}
                                      className="text-destructive focus:text-destructive cursor-pointer gap-2 text-xs"
                                    >
                                      <Trash2 className="size-3.5" />
                                      {t('actionDelete')}
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            {/* Native Mobile Cards Layout (or Desktop Grid View) */}
            <div
              className={cn(
                'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
                viewMode === 'table' ? 'md:hidden' : ''
              )}
            >
              {filteredProperties.map((property) => (
                <Card
                  key={property.id}
                  className="border-border/70 hover:border-primary/50 flex h-full flex-col justify-between overflow-hidden shadow-xs transition-colors"
                >
                  {/* Property Visual Header / Thumbnail Placeholder */}
                  <div className="bg-muted/40 border-border/50 group relative flex h-32 w-full items-center justify-center overflow-hidden border-b">
                    <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] opacity-30 [background-size:14px_14px] dark:bg-[radial-gradient(#475569_1px,transparent_1px)]" />
                    <div className="text-muted-foreground/60 z-10 flex flex-col items-center justify-center gap-1 transition-transform duration-200 group-hover:scale-105">
                      <Building className="size-7" />
                      <span className="text-[10px] font-semibold tracking-wider uppercase">
                        {property.property_type || 'Residential'}
                      </span>
                    </div>

                    {/* Possession Badge overlay (top-left) */}
                    <div className="absolute top-2.5 left-2.5 z-10">
                      {renderPossessionBadge(
                        property.possession_status,
                        property.possession_date
                      )}
                    </div>

                    {/* Price Badge overlay (top-right) */}
                    {property.price && (
                      <div className="absolute top-2.5 right-2.5 z-10">
                        <Badge
                          variant="secondary"
                          className="border-border/60 bg-background/90 text-foreground text-xs font-bold shadow-xs backdrop-blur-xs"
                        >
                          {formatINR(property.price)}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <CardContent className="flex flex-1 flex-col justify-between space-y-3 p-4">
                    <div className="space-y-2.5">
                      {/* Header: Title & Project */}
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/properties/${property.id}`)
                          }
                          className="text-foreground hover:text-primary line-clamp-1 block text-left text-base font-semibold transition-colors"
                        >
                          {property.title}
                        </button>
                        {(property.project_name || property.builder_name) && (
                          <p className="text-muted-foreground mt-0.5 truncate text-xs">
                            {[property.project_name, property.builder_name]
                              .filter(Boolean)
                              .join(' • ')}
                          </p>
                        )}
                      </div>

                      {/* Specs row */}
                      <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                        {property.configuration && (
                          <span className="text-primary font-semibold">
                            {property.configuration}
                          </span>
                        )}
                        {property.carpet_area && (
                          <span>
                            • {property.carpet_area} {t('sqft')}
                          </span>
                        )}
                        {property.facing && (
                          <span>
                            • {property.facing} {t('facingSuffix')}
                          </span>
                        )}
                      </div>

                      {/* Location */}
                      {property.location && (
                        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                          <MapPin className="text-muted-foreground size-3.5 shrink-0" />
                          <span className="truncate">{property.location}</span>
                        </div>
                      )}

                      {/* RERA Badge */}
                      <div className="pt-0.5">
                        {renderReraBadge(property.rera_id)}
                      </div>

                      {/* Tags */}
                      {property.tags && property.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {property.tags.slice(0, 3).map((tag, i) => (
                            <span
                              key={i}
                              className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                          {property.tags.length > 3 && (
                            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
                              +{property.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>

                  {/* 1-Tap Mobile Action Bar */}
                  <div className="border-border/60 bg-muted/20 flex items-center justify-between gap-1 border-t px-3 py-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenScheduleVisit(property.id)}
                      className="h-8 flex-1 gap-1.5 text-xs font-medium"
                    >
                      <Calendar className="text-primary size-3.5" />
                      {t('actionScheduleVisit')}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenShare(property)}
                      className="h-8 gap-1.5 px-3 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                    >
                      <MessageCircle className="size-3.5" />
                      {t('actionShare')}
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger className="border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors">
                        <MoreVertical className="size-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/properties/${property.id}`)
                          }
                          className="cursor-pointer gap-2 text-xs"
                        >
                          <ExternalLink className="size-3.5" />
                          {t('actionViewDetails')}
                        </DropdownMenuItem>
                        {canManageInventory && (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleOpenEdit(property)}
                              className="cursor-pointer gap-2 text-xs"
                            >
                              <Pencil className="size-3.5" />
                              {t('actionEdit')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleOpenDelete(property)}
                              className="text-destructive focus:text-destructive cursor-pointer gap-2 text-xs"
                            >
                              <Trash2 className="size-3.5" />
                              {t('actionDelete')}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* 4. Modals & Sheets Integration */}
        {/* Create / Edit Property Modal */}
        <PropertyFormModal
          open={formModalOpen}
          onOpenChange={setFormModalOpen}
          property={editingProperty}
          onSaved={handlePropertySaved}
        />

        {/* WhatsApp Brochure Share Modal */}
        <PropertyShareModal
          open={shareModalOpen}
          onOpenChange={setShareModalOpen}
          property={sharingProperty}
        />

        {/* Safe Property Deletion Dialog */}
        <PropertyDeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpenOpen}
          property={deletingProperty}
          onDeleted={handlePropertyDeleted}
        />

        {/* Schedule Visit Sheet with pre-filled property */}
        <ScheduleVisitSheet
          open={scheduleSheetOpen}
          onOpenChange={setScheduleSheetOpen}
          defaultPropertyId={selectedPropertyForVisit}
          onSuccess={() => {
            // Visit scheduled callback
          }}
        />
      </div>
    </PullToRefresh>
  );
}
