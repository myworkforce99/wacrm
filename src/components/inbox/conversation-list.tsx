'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  CONVERSATION_SELECT,
  matchesAssigneeFilter,
  matchesContactFilters,
  normalizeConversations,
  type AssigneeFilter,
} from '@/lib/inbox/conversations';
import { cn } from '@/lib/utils';
import type { Conversation, ConversationStatus, Tag } from '@/types';
import { Search, ChevronDown, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { canManageMembers } from '@/lib/auth/roles';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useVirtualizer } from '@tanstack/react-virtual';
import { SlaBadge } from '@/components/ui/sla-badge';

interface ConversationListProps {
  activeConversationId: string | null;
  onSelect: (conversation: Conversation) => void;
  conversations: Conversation[];
  onConversationsLoaded: (conversations: Conversation[]) => void;
  /**
   * Increment to force the fetch effect below to refire. The parent
   * bumps this on realtime reconnect / tab visibility → visible so the
   * list catches up on any events sent while the WS was disconnected
   * or the tab was throttled. Optional so existing callers keep working.
   */
  resyncToken?: number;
  /** Current logged in user ID for "Mine" filtering. */
  currentUserId?: string | null;
}

const STATUS_COLORS: Record<ConversationStatus, string> = {
  open: 'bg-primary',
  pending: 'bg-amber-500',
  closed: 'bg-muted-foreground',
};

type InboxFilter = ConversationStatus | 'all' | 'unread';

export function ConversationList({
  activeConversationId,
  onSelect,
  conversations,
  onConversationsLoaded,
  resyncToken = 0,
  currentUserId: initialUserId,
}: ConversationListProps) {
  const t = useTranslations('Inbox.conversationList');

  const { user: authUser, accountRole } = useAuth();
  const isManager = accountRole ? canManageMembers(accountRole) : false;
  const [fetchedUserId, setFetchedUserId] = useState<string | null>(null);
  const currentUserId = initialUserId ?? authUser?.id ?? fetchedUserId;
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('mine');
  const effectiveAssigneeFilter =
    !isManager && assigneeFilter === 'all' ? 'mine' : assigneeFilter;

  // On initial mount/deep-link, align the tab to 'unassigned' if the targeted
  // conversation is unassigned. Run at most once so user tab clicks are never overridden.
  const initialDeepLinkHandledRef = useRef(false);
  useEffect(() => {
    if (
      initialDeepLinkHandledRef.current ||
      !activeConversationId ||
      conversations.length === 0
    ) {
      return;
    }
    const activeConv = conversations.find((c) => c.id === activeConversationId);
    if (!activeConv) return;
    initialDeepLinkHandledRef.current = true;
    if (!activeConv.assigned_agent_id) {
      const timer = setTimeout(() => {
        setAssigneeFilter('unassigned');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeConversationId, conversations]);

  // When an unassigned conversation is claimed by the current user, seamlessly
  // switch to 'mine' tab so the claimed conversation stays in view.
  // We track the previous assigned_agent_id for the active conversation so that
  // tab switching is triggered ONLY by the actual claim event transition (null -> currentUserId),
  // NEVER by the user clicking between tabs.
  const prevAssignedMapRef = useRef<Map<string, string | null>>(new Map());
  useEffect(() => {
    if (!activeConversationId || !currentUserId) return;
    const activeConv = conversations.find((c) => c.id === activeConversationId);
    if (!activeConv) return;

    const currentAssigned = activeConv.assigned_agent_id ?? null;
    const hasPrev = prevAssignedMapRef.current.has(activeConversationId);
    const prevAssigned = prevAssignedMapRef.current.get(activeConversationId);

    let timer: ReturnType<typeof setTimeout> | undefined;
    // Only transition when this active conversation changed from unassigned (null) to currentUserId
    if (hasPrev && prevAssigned === null && currentAssigned === currentUserId) {
      timer = setTimeout(() => {
        setAssigneeFilter('mine');
      }, 0);
    }

    prevAssignedMapRef.current.set(activeConversationId, currentAssigned);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [activeConversationId, conversations, currentUserId]);

  useEffect(() => {
    if (initialUserId || authUser?.id) return;
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user) setFetchedUserId(user.id);
    });
    return () => {
      cancelled = true;
    };
  }, [initialUserId, authUser?.id]);

  const FILTER_OPTIONS: { label: string; value: InboxFilter }[] = useMemo(
    () => [
      { label: t('filterAll'), value: 'all' },
      { label: t('filterUnread'), value: 'unread' },
      { label: t('filterOpen'), value: 'open' },
      { label: t('filterPending'), value: 'pending' },
      { label: t('filterClosed'), value: 'closed' },
    ],
    [t]
  );

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [loading, setLoading] = useState(true);
  // Contact-based filters (issue #272). Tags use OR logic (a conversation
  // matches if its contact carries any selected tag), consistent with
  // Broadcast audience filtering. Company is an exact match on the field.
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  // Keep the latest callback in a ref so the fetch effect below can
  // have a stable, empty-dep identity. Previously the fetch useCallback
  // depended on `onConversationsLoaded`, which depends on the parent's
  // `deepLinkConvId` — so every URL change (including one the parent
  // triggered via router.replace after a click) caused a fresh
  // conversations fetch. That extra refetch was the trigger for the
  // deep-link auto-select running a second time and wiping the active
  // thread's messages.
  // Mutation lives in an effect (not render) per React 19's refs rule;
  // the fetch runs once on mount so it's fine to read the slightly
  // older value — the very next render updates the ref for any
  // subsequent async completion.
  const onConversationsLoadedRef = useRef(onConversationsLoaded);
  useEffect(() => {
    onConversationsLoadedRef.current = onConversationsLoaded;
  });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select(CONVERSATION_SELECT)
        .order('last_message_at', { ascending: false });

      if (cancelled) return;

      if (error) {
        // Supabase errors have non-enumerable properties — log fields explicitly
        console.error('Failed to fetch conversations:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        setLoading(false);
        return;
      }

      onConversationsLoadedRef.current(normalizeConversations(data ?? []));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // `resyncToken` is included so the parent can force a refetch when
    // the realtime channel reconnects or the tab regains focus — catches
    // up on any events sent while the WS was disconnected or throttled.
  }, [resyncToken]);

  // Tag definitions for the filter picker — loaded once so labels/colours
  // stay stable regardless of which conversations happen to be loaded.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('tags').select('*').order('name');
      if (!cancelled && data) setTags(data as Tag[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Company options are derived from the loaded conversations — there's no
  // separate companies table, and only companies with a live conversation
  // are worth offering as an inbox filter.
  const companies = useMemo(() => {
    const set = new Set<string>();
    for (const c of conversations) {
      const co = c.contact?.company?.trim();
      if (co) set.add(co);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [conversations]);

  const tagsById = useMemo(() => {
    const m = new Map<string, Tag>();
    for (const t of tags) m.set(t.id, t);
    return m;
  }, [tags]);

  const counts = useMemo(() => {
    let mine = 0;
    let unassigned = 0;
    for (const c of conversations) {
      if (currentUserId && c.assigned_agent_id === currentUserId) {
        mine++;
      }
      if (!c.assigned_agent_id) {
        unassigned++;
      }
    }
    return {
      all: conversations.length,
      mine,
      unassigned,
    };
  }, [conversations, currentUserId]);

  const filtered = useMemo(() => {
    let result = conversations;

    if (effectiveAssigneeFilter !== 'all') {
      result = result.filter((c) =>
        matchesAssigneeFilter(c, effectiveAssigneeFilter, currentUserId)
      );
    }

    if (filter === 'unread') {
      result = result.filter((c) => c.unread_count > 0);
    } else if (filter !== 'all') {
      result = result.filter((c) => c.status === filter);
    }

    // Contact-based filters (tags via OR logic, exact company match).
    if (selectedTagIds.length > 0 || selectedCompany !== null) {
      result = result.filter((c) =>
        matchesContactFilters(c, {
          tagIds: selectedTagIds,
          company: selectedCompany,
        })
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => {
        const name = c.contact?.name?.toLowerCase() ?? '';
        const phone = c.contact?.phone?.toLowerCase() ?? '';
        const lastMsg = c.last_message_text?.toLowerCase() ?? '';
        return name.includes(q) || phone.includes(q) || lastMsg.includes(q);
      });
    }

    return result;
  }, [
    conversations,
    effectiveAssigneeFilter,
    currentUserId,
    filter,
    search,
    selectedTagIds,
    selectedCompany,
  ]);

  const toggleTag = useCallback((id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }, []);

  const clearContactFilters = useCallback(() => {
    setSelectedTagIds([]);
    setSelectedCompany(null);
  }, []);

  const hasContactFilters =
    selectedTagIds.length > 0 || selectedCompany !== null;

  const activeFiltersCount =
    selectedTagIds.length + (selectedCompany !== null ? 1 : 0);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
    },
    []
  );

  const handleSelect = useCallback(
    (conv: Conversation) => {
      onSelect(conv);
    },
    [onSelect]
  );

  const activeFilter = FILTER_OPTIONS.find((o) => o.value === filter);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
  });

  useEffect(() => {
    if (activeConversationId && filtered.length > 0) {
      const activeIndex = filtered.findIndex(
        (c) => c.id === activeConversationId
      );
      if (activeIndex >= 0) {
        rowVirtualizer.scrollToIndex(activeIndex, { align: 'auto' });
      }
    }
  }, [activeConversationId, filtered, rowVirtualizer]);

  return (
    // w-full on mobile so the list occupies the whole viewport when it's
    // the single pane showing; fixed 320px on desktop where it shares the
    // row with the thread + contact sidebar.
    <div className="border-border bg-card flex min-h-0 w-full flex-1 flex-col lg:w-[340px] lg:border-r">
      {/* Search + Filter */}
      <div className="border-border space-y-2 border-b p-3">
        {/* Assignee Filter Tabs (Mine / Unassigned for agents; + All for managers) */}
        <div
          className={cn(
            'bg-muted grid gap-1 rounded-lg p-1 text-xs',
            isManager ? 'grid-cols-3' : 'grid-cols-2'
          )}
        >
          <button
            type="button"
            onClick={() => setAssigneeFilter('mine')}
            className={cn(
              'flex min-w-0 cursor-pointer items-center justify-center gap-1 rounded-md px-1 py-1.5 font-medium transition-all sm:gap-1.5 sm:px-1.5',
              effectiveAssigneeFilter === 'mine'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="truncate">{t('tabMine')}</span>
            <span
              className={cn(
                'py-0.2 shrink-0 rounded-full px-1.5 text-[10px] font-semibold',
                effectiveAssigneeFilter === 'mine'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted-foreground/15 text-muted-foreground'
              )}
            >
              {counts.mine}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setAssigneeFilter('unassigned')}
            className={cn(
              'flex min-w-0 cursor-pointer items-center justify-center gap-1 rounded-md px-1 py-1.5 font-medium transition-all sm:gap-1.5 sm:px-1.5',
              effectiveAssigneeFilter === 'unassigned'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span>{t('tabUnassigned')}</span>
            {counts.unassigned > 0 && (
              <span
                className={cn(
                  'py-0.2 shrink-0 rounded-full px-1.5 text-[10px] font-semibold',
                  effectiveAssigneeFilter === 'unassigned'
                    ? 'bg-amber-500/15 text-amber-500'
                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                )}
              >
                {counts.unassigned}
              </span>
            )}
          </button>
          {isManager && (
            <button
              type="button"
              onClick={() => setAssigneeFilter('all')}
              className={cn(
                'flex min-w-0 cursor-pointer items-center justify-center gap-1 rounded-md px-1 py-1.5 font-medium transition-all sm:gap-1.5 sm:px-1.5',
                effectiveAssigneeFilter === 'all'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span className="truncate">{t('tabAll')}</span>
              <span
                className={cn(
                  'py-0.2 shrink-0 rounded-full px-1.5 text-[10px] font-semibold',
                  effectiveAssigneeFilter === 'all'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted-foreground/15 text-muted-foreground'
                )}
              >
                {counts.all}
              </span>
            </button>
          )}
        </div>

        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={handleSearchChange}
            placeholder={t('searchPlaceholder')}
            className="border-border bg-muted text-foreground placeholder-muted-foreground focus:border-primary/50 pl-9 text-sm"
          />
        </div>

        <div className="flex scrollbar-none items-center gap-1 overflow-x-auto py-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs">
              {activeFilter?.label ?? t('filterAll')}
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="border-border bg-popover"
            >
              {FILTER_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={cn(
                    'text-sm',
                    filter === opt.value
                      ? 'text-primary'
                      : 'text-popover-foreground'
                  )}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {tags.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  'hover:bg-muted inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs',
                  selectedTagIds.length > 0
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t('tags')}
                {selectedTagIds.length > 0 && (
                  <span className="bg-primary text-primary-foreground flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold">
                    {selectedTagIds.length}
                  </span>
                )}
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="border-border bg-popover max-h-64 w-56"
              >
                {tags.map((t) => (
                  <DropdownMenuCheckboxItem
                    key={t.id}
                    checked={selectedTagIds.includes(t.id)}
                    onCheckedChange={() => toggleTag(t.id)}
                    className="text-popover-foreground text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                      <span className="truncate">{t.name}</span>
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {companies.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  'hover:bg-muted inline-flex h-7 max-w-40 items-center justify-center gap-1 rounded-md px-2 text-xs',
                  selectedCompany
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="truncate">
                  {selectedCompany ?? t('company')}
                </span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="border-border bg-popover max-h-64 w-56"
              >
                <DropdownMenuItem
                  onClick={() => setSelectedCompany(null)}
                  className={cn(
                    'text-sm',
                    selectedCompany === null
                      ? 'text-primary'
                      : 'text-popover-foreground'
                  )}
                >
                  {t('allCompanies')}
                </DropdownMenuItem>
                {companies.map((co) => (
                  <DropdownMenuItem
                    key={co}
                    onClick={() => setSelectedCompany(co)}
                    className={cn(
                      'text-sm',
                      selectedCompany === co
                        ? 'text-primary'
                        : 'text-popover-foreground'
                    )}
                  >
                    <span className="truncate">{co}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {hasContactFilters && (
          <div className="flex flex-wrap items-center gap-1">
            {selectedTagIds.map((id) => {
              const tag = tagsById.get(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleTag(id)}
                  className="bg-muted text-foreground hover:bg-muted/70 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: tag?.color ?? 'var(--muted-foreground)',
                    }}
                  />
                  <span className="max-w-24 truncate">
                    {tag?.name ?? t('tags')}
                  </span>
                  <X className="h-3 w-3" />
                </button>
              );
            })}
            {selectedCompany && (
              <button
                onClick={() => setSelectedCompany(null)}
                className="bg-muted text-foreground hover:bg-muted/70 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
              >
                <span className="max-w-24 truncate">{selectedCompany}</span>
                <X className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              onClick={clearContactFilters}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-red-200/60 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-600 shadow-2xs transition-colors hover:border-red-300 hover:bg-red-100 hover:text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400 dark:hover:border-red-800 dark:hover:bg-red-900/50 dark:hover:text-red-300"
            >
              <X className="size-3" />
              {t('clearAll')} ({activeFiltersCount})
            </button>
          </div>
        )}
      </div>

      {/* Conversation Items.
          `min-h-0` is load-bearing: a flex child defaults to
          min-height:auto, so without it this container grows to fit
          every conversation instead of shrinking to the remaining
          space — the list then overflows and gets clipped by the
          parent's overflow-hidden with no scrollbar (issue #229). */}
      <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-muted-foreground text-sm">
              {t('noConversations')}
            </p>
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
            className="pb-20 lg:pb-0"
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const conv = filtered[virtualRow.index];
              if (!conv) return null;
              return (
                <div
                  key={conv.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <ConversationItem
                    conversation={conv}
                    isActive={conv.id === activeConversationId}
                    onSelect={handleSelect}
                    t={t}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (conversation: Conversation) => void;
  t: ReturnType<typeof useTranslations>;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  t,
}: ConversationItemProps) {
  const contact = conversation.contact;
  const displayName = contact?.name || contact?.phone || t('unknown');
  const initials = displayName.charAt(0).toUpperCase();

  const handleClick = useCallback(() => {
    onSelect(conversation);
  }, [onSelect, conversation]);

  const timeAgo = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), {
        addSuffix: false,
      })
    : '';

  return (
    <button
      onClick={handleClick}
      className={cn(
        'hover:bg-muted/50 flex w-full items-start gap-3 px-3 py-3 text-left transition-colors',
        isActive && 'border-primary bg-muted/70 border-l-2'
      )}
    >
      {/* Avatar */}
      <div className="bg-muted text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium">
        {contact?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={contact.avatar_url}
            alt={displayName}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-foreground truncate text-sm font-medium">
            {displayName}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            {conversation.first_unanswered_at && (
              <SlaBadge
                firstUnansweredAt={conversation.first_unanswered_at}
                className="h-4 px-1.5 py-0 text-[10px]"
              />
            )}
            <span className="text-muted-foreground text-[10px]">{timeAgo}</span>
          </div>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="text-muted-foreground truncate text-xs">
            {conversation.last_message_text || t('noMessagesYet')}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {!conversation.assigned_agent_id && (
              <span
                className="py-0.2 rounded-sm bg-amber-500/10 px-1 text-[10px] font-medium text-amber-600 dark:text-amber-400"
                title={t('tabUnassigned')}
              >
                {t('tabUnassigned')}
              </span>
            )}
            {conversation.unread_count > 0 && (
              <span className="bg-primary text-primary-foreground flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold">
                {conversation.unread_count}
              </span>
            )}
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                STATUS_COLORS[conversation.status]
              )}
              title={conversation.status}
            />
          </div>
        </div>
      </div>
    </button>
  );
}
