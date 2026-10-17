import {
  useMemo,
  useState,
  useEffect,
  useRef,
  useSyncExternalStore,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';

const noopSubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCorners,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { Deal, PipelineStage } from '@/types';
import { DealCard } from './deal-card';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Trophy,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Kanban,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { formatCurrency, formatINR } from '@/lib/currency';
import { useTranslations } from 'next-intl';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { LostReasonModal } from './lost-reason-modal';

interface PipelineBoardProps {
  stages: PipelineStage[];
  deals: Deal[];
  onDealMoved: (dealId: string, newStageId: string) => void;
  onAddDeal: (stageId: string) => void;
  onEditDeal: (deal: Deal) => void;
  onScheduleVisit?: (deal: Deal) => void;
}

export function PipelineBoard({
  stages,
  deals,
  onDealMoved,
  onAddDeal,
  onEditDeal,
  onScheduleVisit,
}: PipelineBoardProps) {
  const { accountId, defaultCurrency } = useAuth();
  const t = useTranslations('Pipelines.board');
  const tCard = useTranslations('Pipelines.card');
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const [moveDealId, setMoveDealId] = useState<string | null>(null);
  const [brokeragePct, setBrokeragePct] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [lostInterceptDealId, setLostInterceptDealId] = useState<string | null>(null);
  const [lostInterceptLoading, setLostInterceptLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const isClient = useIsClient();

  useEffect(() => {
    if (!accountId) return;
    const fetchBrokerage = async () => {
      const supabase = createClient();
      const { data: accountRow } = await supabase
        .from('accounts')
        .select('settings')
        .eq('id', accountId)
        .single();

      const pct =
        ((accountRow?.settings as Record<string, unknown> | null)
          ?.brokerage_pct as number | null) ?? null;
      setBrokeragePct(pct);
    };
    fetchBrokerage();
  }, [accountId]);

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages]
  );

  const currentTab =
    activeTab !== undefined ? activeTab : sortedStages[0]?.id || '';

  const dealsByStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const stage of sortedStages) map.set(stage.id, []);
    for (const deal of deals) {
      const bucket = map.get(deal.stage_id);
      if (bucket) bucket.push(deal);
    }
    return map;
  }, [sortedStages, deals]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const activeDeal = activeDealId
    ? (deals.find((d) => d.id === activeDealId) ?? null)
    : null;

  const moveDeal = moveDealId ? deals.find((d) => d.id === moveDealId) : null;
  const isDraggingRef = useRef(false);

  // Smart Kanban collision detection:
  // 1. Pointer inside a stage column -> immediate match
  // 2. Rect intersection -> intersecting column
  // 3. Fallback -> closest corners
  const collisionDetectionStrategy: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    const rectCollisions = rectIntersection(args);
    if (rectCollisions.length > 0) {
      return rectCollisions;
    }
    return closestCorners(args);
  };

  function handleDragStart(event: DragStartEvent) {
    isDraggingRef.current = true;
    setActiveDealId(String(event.active.id));
  }

  const checkScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 8);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 8);
  }, []);

  const scrollToStage = useCallback((stageId: string) => {
    if (!scrollContainerRef.current) return;
    const target = scrollContainerRef.current.querySelector<HTMLElement>(
      `#stage-pill-${stageId}`
    );
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, []);

  useEffect(() => {
    checkScroll();
    const handleResize = () => checkScroll();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [checkScroll, sortedStages]);

  const activeStageIndex = Math.max(
    0,
    sortedStages.findIndex((s) => s.id === currentTab)
  );
  const activeStage = sortedStages[activeStageIndex] || sortedStages[0];
  const activeStageDeals = activeStage ? (dealsByStage.get(activeStage.id) ?? []) : [];
  const activeStageTotalValue = activeStageDeals.reduce(
    (sum, d) => sum + Number(d.value || 0),
    0
  );

  async function handleMarkWon(dealId: string) {
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'won' }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        toast.success(tCard('won') ? `Marked as won ✓` : 'Marked as won ✓');
        const deal = deals.find((d) => d.id === dealId);
        if (deal) onEditDeal({ ...deal, status: 'won' });
      } else {
        toast.error('Failed to update deal status');
      }
    } catch {
      toast.error('Failed to update deal status');
    } finally {
      setMoveDealId(null);
    }
  }

  async function handleLostConfirmed({
    lost_reason_id,
    lost_note,
    re_engage_on,
  }: {
    lost_reason_id: string;
    lost_note?: string;
    re_engage_on?: string;
  }) {
    if (!lostInterceptDealId) return;
    setLostInterceptLoading(true);
    try {
      const res = await fetch(`/api/deals/${lostInterceptDealId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'lost',
          lost_reason_id,
          lost_note: lost_note || null,
          re_engage_on: re_engage_on || null,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        toast.success('Marked as lost');
        const deal = deals.find((d) => d.id === lostInterceptDealId);
        if (deal) onEditDeal({ ...deal, status: 'lost' });
      } else {
        toast.error('Failed to update deal status');
      }
    } catch {
      toast.error('Failed to update deal status');
    } finally {
      setLostInterceptLoading(false);
      setLostInterceptDealId(null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDealId(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 150);

    const { active, over } = event;
    if (!over) return;
    const dealId = String(active.id);
    const targetStageId = String(over.id);

    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === targetStageId) return;
    const targetStage = sortedStages.find((s) => s.id === targetStageId);
    if (!targetStage) return;

    if (targetStage.name.toLowerCase().includes('lost')) {
      setLostInterceptDealId(dealId);
      return;
    }

    onDealMoved(dealId, targetStageId);
  }

  function handleDragCancel() {
    setActiveDealId(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 150);
  }

  const handleEditDealSafe = (deal: Deal) => {
    if (isDraggingRef.current) return;
    onEditDeal(deal);
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Desktop View (DndContext needs to wrap the layout) */}
        <div className="pipeline-scroll hidden snap-none gap-3 overflow-x-auto pb-4 lg:flex">
          {sortedStages.map((stage) => {
            const stageDeals = dealsByStage.get(stage.id) ?? [];
            const totalValue = stageDeals.reduce(
              (s, d) => s + Number(d.value || 0),
              0
            );
            return (
              <StageColumn
                key={stage.id}
                stage={stage}
                deals={stageDeals}
                totalValue={totalValue}
                currency={defaultCurrency}
                brokeragePct={brokeragePct}
                onAddDeal={onAddDeal}
                onEditDeal={handleEditDealSafe}
                onMoveDeal={(d) => setMoveDealId(d.id)}
                onScheduleVisit={onScheduleVisit}
              />
            );
          })}
        </div>

        {/* Mobile Stage Navigator & Deals View */}
        <div className="lg:hidden space-y-4">
          {/* Stage Navigator Card */}
          <div className="border-border/70 bg-card rounded-2xl border p-3.5 shadow-xs space-y-3">
            {/* Context Header: Identifies Kanban Board Pipeline Stages & Scroll hint */}
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-1.5">
                <Kanban className="size-3.5 text-primary" />
                <span className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
                  Pipeline Stages ({sortedStages.length})
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground/80 flex items-center gap-0.5">
                Swipe &bull; Jump to any stage &rarr;
              </span>
            </div>

            {/* Header: Stage Step Indicator, Quick Dropdown, and Prev/Next Chevrons */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="size-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: activeStage?.color ?? 'var(--primary)',
                  }}
                />
                <span className="text-xs font-bold text-foreground shrink-0">
                  Stage {activeStageIndex + 1} of {sortedStages.length}:
                </span>
                <span
                  className="text-xs font-semibold truncate max-w-[130px]"
                  style={{ color: activeStage?.color ?? 'var(--primary)' }}
                >
                  {activeStage?.name}
                </span>
              </div>

              {/* Controls: All Stages Dropdown + Prev/Next buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger className="border-border/70 bg-muted/40 hover:bg-muted text-foreground inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium shadow-2xs cursor-pointer">
                    <span>All Stages</span>
                    <ChevronDown className="size-3 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="bg-popover border-border w-56"
                  >
                    {sortedStages.map((s, idx) => {
                      const count = dealsByStage.get(s.id)?.length || 0;
                      const isSelected = s.id === currentTab;
                      return (
                        <DropdownMenuItem
                          key={s.id}
                          onClick={() => {
                            setActiveTab(s.id);
                            scrollToStage(s.id);
                          }}
                          className={`flex items-center justify-between text-xs cursor-pointer py-2 ${
                            isSelected
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2 rounded-full shrink-0"
                              style={{ backgroundColor: s.color }}
                            />
                            <span>
                              {idx + 1}. {s.name}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-bold rounded-full px-1.5 py-0.2 ${
                              isSelected
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {count}
                          </span>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Previous Stage */}
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={activeStageIndex <= 0}
                  onClick={() => {
                    if (activeStageIndex > 0) {
                      const prevId = sortedStages[activeStageIndex - 1].id;
                      setActiveTab(prevId);
                      scrollToStage(prevId);
                    }
                  }}
                  className="border-border/70 bg-muted/40 hover:bg-muted size-7 rounded-lg border shadow-2xs disabled:opacity-30 cursor-pointer"
                  title="Previous Stage"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>

                {/* Next Stage */}
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={activeStageIndex >= sortedStages.length - 1}
                  onClick={() => {
                    if (activeStageIndex < sortedStages.length - 1) {
                      const nextId = sortedStages[activeStageIndex + 1].id;
                      setActiveTab(nextId);
                      scrollToStage(nextId);
                    }
                  }}
                  className="border-border/70 bg-muted/40 hover:bg-muted size-7 rounded-lg border shadow-2xs disabled:opacity-30 cursor-pointer"
                  title="Next Stage"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* Visual Funnel Step Progress Bar */}
            <div
              className="grid gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${sortedStages.length}, minmax(0, 1fr))`,
              }}
            >
              {sortedStages.map((s, idx) => {
                const isCurrent = idx === activeStageIndex;
                const isPast = idx < activeStageIndex;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(s.id);
                      scrollToStage(s.id);
                    }}
                    className="group py-0.5 cursor-pointer focus:outline-none"
                    title={`${idx + 1}. ${s.name}`}
                  >
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        isCurrent
                          ? 'ring-2 ring-primary/40 ring-offset-1 ring-offset-card'
                          : 'opacity-70 group-hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: isCurrent
                          ? s.color
                          : isPast
                          ? s.color + 'aa'
                          : 'var(--muted)',
                      }}
                    />
                  </button>
                );
              })}
            </div>

            {/* Scrollable Stage Pills with gradient overflow indicators */}
            <div className="relative -mx-1">
              {canScrollLeft && (
                <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-card to-transparent z-10" />
              )}
              {canScrollRight && (
                <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card to-transparent z-10" />
              )}

              <div
                ref={scrollContainerRef}
                onScroll={checkScroll}
                className="flex gap-2 overflow-x-auto px-1 pb-1 scroll-smooth [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: 'none' }}
              >
                {sortedStages.map((s) => {
                  const isSelected = s.id === currentTab;
                  const count = dealsByStage.get(s.id)?.length || 0;
                  const stageVal = (dealsByStage.get(s.id) ?? []).reduce(
                    (sum, d) => sum + Number(d.value || 0),
                    0
                  );
                  const formattedVal =
                    defaultCurrency === 'INR'
                      ? formatINR(stageVal)
                      : formatCurrency(stageVal, defaultCurrency);

                  return (
                    <button
                      key={s.id}
                      id={`stage-pill-${s.id}`}
                      type="button"
                      onClick={() => {
                        setActiveTab(s.id);
                        scrollToStage(s.id);
                      }}
                      className={`flex flex-col gap-1 rounded-xl border p-2.5 shrink-0 text-left transition-all cursor-pointer min-w-[130px] ${
                        isSelected
                          ? 'shadow-xs'
                          : 'border-border/70 bg-muted/30 hover:bg-muted/70 text-muted-foreground'
                      }`}
                      style={
                        isSelected
                          ? {
                              borderColor: s.color,
                              backgroundColor: `${s.color}15`,
                              boxShadow: `0 0 0 1px ${s.color}40`,
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: s.color }}
                          />
                          <span
                            className="text-xs font-semibold truncate"
                            style={{ color: isSelected ? s.color : undefined }}
                          >
                            {s.name}
                          </span>
                        </div>
                        <span
                          className="text-[10px] font-bold rounded-full px-1.5 py-0.2 shrink-0"
                          style={
                            isSelected
                              ? {
                                  backgroundColor: s.color,
                                  color: '#ffffff',
                                }
                              : {
                                  backgroundColor: 'var(--muted)',
                                  color: 'var(--muted-foreground)',
                                }
                          }
                        >
                          {count}
                        </span>
                      </div>
                      <span
                        className={`text-[11px] font-medium ${
                          isSelected
                            ? 'text-foreground font-semibold'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {formattedVal}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Active Stage Deals Container */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: activeStage?.color }}
                />
                <span className="text-sm font-bold text-foreground">
                  {activeStage?.name}
                </span>
                <span
                  className="rounded-full border px-2 py-0.5 text-xs font-semibold"
                  style={{
                    backgroundColor: `${activeStage?.color}15`,
                    borderColor: `${activeStage?.color}35`,
                    color: activeStage?.color,
                  }}
                >
                  {activeStageDeals.length}{' '}
                  {activeStageDeals.length === 1 ? 'deal' : 'deals'}
                </span>
              </div>
              <p
                className="text-xs font-bold"
                style={{ color: activeStage?.color }}
              >
                {defaultCurrency === 'INR'
                  ? formatINR(activeStageTotalValue)
                  : formatCurrency(activeStageTotalValue, defaultCurrency)}
              </p>
            </div>

            {activeStageDeals.length === 0 ? (
              <div className="border-border text-muted-foreground flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 text-center">
                <Kanban className="size-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs font-medium text-foreground">
                  {t('dropDealHere')}
                </p>
                <p className="text-muted-foreground mt-1 text-[11px]">
                  No deals in {activeStage?.name}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeStageDeals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    stage={activeStage}
                    onEdit={onEditDeal}
                    onMove={() => setMoveDealId(deal.id)}
                    onScheduleVisit={onScheduleVisit}
                    brokeragePct={brokeragePct}
                  />
                ))}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddDeal(activeStage.id)}
              className="border-border text-foreground hover:bg-muted shadow-2xs h-9 w-full justify-center text-xs font-medium cursor-pointer"
            >
              <Plus className="text-primary mr-1.5 size-3.5" />
              <span>
                {t('addDeal')} to {activeStage?.name}
              </span>
            </Button>
          </div>
        </div>

        {isClient && typeof document !== 'undefined'
          ? createPortal(
              <DragOverlay
                dropAnimation={{
                  duration: 200,
                  easing: 'cubic-bezier(0.2, 0, 0, 1)',
                }}
              >
                {activeDeal ? (
                  <div className="pointer-events-none cursor-grabbing opacity-95 select-none">
                    <DealCard
                      deal={activeDeal}
                      stage={
                        sortedStages.find(
                          (s) => s.id === activeDeal.stage_id
                        ) ?? null
                      }
                      onEdit={() => {}}
                      isOverlay
                      brokeragePct={brokeragePct}
                    />
                  </div>
                ) : null}
              </DragOverlay>,
              document.body
            )
          : null}
      </DndContext>

      <Sheet
        open={!!moveDealId}
        onOpenChange={(open) => !open && setMoveDealId(null)}
      >
        <SheetContent
          side="bottom"
          className="bg-popover border-border rounded-t-xl border-t sm:mx-auto sm:max-w-md"
        >
          <SheetHeader className="mb-4">
            <SheetTitle className="text-left">{t('moveToStage')}</SheetTitle>
          </SheetHeader>
          <div className="space-y-2">
            {sortedStages.map((stage) => {
              const isActive = moveDeal?.stage_id === stage.id;
              return (
                <button
                  key={stage.id}
                  onClick={() => {
                    if (!isActive && moveDealId) {
                      if (stage.name.toLowerCase().includes('lost')) {
                        setLostInterceptDealId(moveDealId);
                        setMoveDealId(null);
                        return;
                      }
                      onDealMoved(moveDealId, stage.id);
                    }
                    setMoveDealId(null);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg border p-3 transition-colors cursor-pointer ${
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
                      {t('currentStage')}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Quick Deal Closure Actions */}
            {moveDeal && moveDeal.status === 'open' && (
              <div className="border-t border-border pt-3 mt-3 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Quick Actions
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleMarkWon(moveDeal.id)}
                    className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 font-medium text-xs transition-colors cursor-pointer min-h-[40px]"
                  >
                    <Trophy className="size-3.5" />
                    <span>{tCard('won') ? 'Mark as Won' : 'Mark as Won'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLostInterceptDealId(moveDeal.id);
                      setMoveDealId(null);
                    }}
                    className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 font-medium text-xs transition-colors cursor-pointer min-h-[40px]"
                  >
                    <XCircle className="size-3.5" />
                    <span>{tCard('lost') ? 'Mark as Lost' : 'Mark as Lost'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Lost Reason Interception Modal */}
      <LostReasonModal
        open={!!lostInterceptDealId}
        onOpenChange={(open) => !open && setLostInterceptDealId(null)}
        onConfirm={handleLostConfirmed}
        loading={lostInterceptLoading}
      />

      <style jsx>{`
        .pipeline-scroll {
          scroll-behavior: smooth;
        }
        /* On touch devices the peek/snap layout already signals there's
           more to swipe, so the scrollbar is hidden for a clean look.
           On desktop (mouse) the board can overflow with many stages
           and there is no peek hint, so keep a thin, themed scrollbar
           visible to make the overflow discoverable and usable. */
        @media (hover: none), (pointer: coarse) {
          .pipeline-scroll::-webkit-scrollbar {
            height: 0;
            display: none;
          }
          .pipeline-scroll {
            scrollbar-width: none;
          }
        }
        @media (hover: hover) and (pointer: fine) {
          .pipeline-scroll {
            scrollbar-width: thin;
            scrollbar-color: var(--border) transparent;
          }
          .pipeline-scroll::-webkit-scrollbar {
            height: 8px;
          }
          .pipeline-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .pipeline-scroll::-webkit-scrollbar-thumb {
            background-color: var(--border);
            border-radius: 9999px;
          }
          .pipeline-scroll::-webkit-scrollbar-thumb:hover {
            background-color: var(--muted-foreground);
          }
        }
      `}</style>
    </>
  );
}

function StageColumn({
  stage,
  deals,
  totalValue,
  currency,
  brokeragePct,
  onAddDeal,
  onEditDeal,
  onMoveDeal,
  onScheduleVisit,
}: {
  stage: PipelineStage;
  deals: Deal[];
  totalValue: number;
  currency: string;
  brokeragePct?: number | null;
  onAddDeal: (stageId: string) => void;
  onEditDeal: (deal: Deal) => void;
  onMoveDeal: (deal: Deal) => void;
  onScheduleVisit?: (deal: Deal) => void;
}) {
  const t = useTranslations('Pipelines.board');
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div
      ref={setNodeRef}
      className={`border-border bg-card/60 flex min-h-[460px] w-[85vw] max-w-[320px] min-w-[260px] shrink-0 snap-start flex-col rounded-xl border p-4 transition-all lg:w-auto lg:max-w-none lg:flex-1 lg:shrink lg:basis-[260px] lg:snap-none ${
        isOver
          ? 'ring-primary bg-primary/5 border-primary/50 ring-2 ring-offset-2'
          : ''
      }`}
    >
      {/* 3px colored top border — sits above the column's padding */}
      <div
        className="-mx-4 -mt-4 h-[3px] rounded-t-xl"
        style={{ backgroundColor: stage.color }}
      />
      <div className="flex items-center justify-between pt-3">
        <h3
          className="truncate text-sm font-semibold"
          style={{ color: stage.color }}
        >
          {stage.name}
        </h3>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: stage.color + '20', color: stage.color }}
        >
          {deals.length}
        </span>
      </div>
      <p className="text-muted-foreground text-xs">
        {currency === 'INR'
          ? formatINR(totalValue)
          : formatCurrency(totalValue, currency)}
      </p>

      <div className="mt-3 flex flex-1 flex-col gap-2 rounded-lg transition-all">
        {deals.length === 0 ? (
          <div
            className={`border-border text-muted-foreground flex flex-1 items-center justify-center rounded-lg border-2 border-dashed py-10 text-xs transition-colors ${
              isOver
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : ''
            }`}
          >
            {t('dropDealHere')}
          </div>
        ) : (
          deals.map((deal) => (
            <DraggableDealCard
              key={deal.id}
              deal={deal}
              stage={stage}
              brokeragePct={brokeragePct}
              onEdit={onEditDeal}
              onMove={onMoveDeal}
              onScheduleVisit={onScheduleVisit}
            />
          ))
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onAddDeal(stage.id)}
        className="border-border text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground mt-3 w-full justify-start border border-dashed bg-transparent"
      >
        <Plus className="mr-1 h-3 w-3" />
        {t('addDeal')}
      </Button>
    </div>
  );
}

function DraggableDealCard({
  deal,
  stage,
  brokeragePct,
  onEdit,
  onMove,
  onScheduleVisit,
}: {
  deal: Deal;
  stage: PipelineStage;
  brokeragePct?: number | null;
  onEdit: (deal: Deal) => void;
  onMove: (deal: Deal) => void;
  onScheduleVisit?: (deal: Deal) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: deal.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="cursor-grab select-none active:cursor-grabbing"
      style={{ opacity: isDragging ? 0.3 : 1, touchAction: 'none' }}
    >
      <DealCard
        deal={deal}
        stage={stage}
        onEdit={onEdit}
        onMove={onMove}
        onScheduleVisit={onScheduleVisit}
        brokeragePct={brokeragePct}
      />
    </div>
  );
}
