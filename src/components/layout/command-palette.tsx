'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import {
  Search,
  Users,
  Building,
  GitBranch,
  CalendarCheck,
  MessageSquare,
  Radio,
  Zap,
  Workflow,
  Bot,
  Settings,
  UsersRound,
  LayoutDashboard,
  ArrowRight,
  Loader2,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  category: 'navigation' | 'contacts' | 'properties';
  href: string;
  icon: typeof LayoutDashboard;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { accountId } = useAuth();
  const t = useTranslations('Header');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbResults, setDbResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Core navigation items
  const navItems: SearchResult[] = useMemo(
    () => [
      {
        id: 'nav-dashboard',
        title: t('dashboard'),
        subtitle: 'Main metrics and performance overview',
        category: 'navigation',
        href: '/dashboard',
        icon: LayoutDashboard,
      },
      {
        id: 'nav-contacts',
        title: t('contacts'),
        subtitle: 'Manage leads and buyer database',
        category: 'navigation',
        href: '/contacts',
        icon: Users,
      },
      {
        id: 'nav-pipelines',
        title: t('pipelines'),
        subtitle: 'Deal pipeline and sales stages',
        category: 'navigation',
        href: '/pipelines',
        icon: GitBranch,
      },
      {
        id: 'nav-inbox',
        title: t('inbox'),
        subtitle: 'Shared WhatsApp team chat workspace',
        category: 'navigation',
        href: '/inbox',
        icon: MessageSquare,
      },
      {
        id: 'nav-properties',
        title: t('properties'),
        subtitle: 'Inventory listings, project specs and pricing',
        category: 'navigation',
        href: '/properties',
        icon: Building,
      },
      {
        id: 'nav-visits',
        title: t('visits'),
        subtitle: 'Site visit bookings and logistics',
        category: 'navigation',
        href: '/site-visits',
        icon: CalendarCheck,
      },
      {
        id: 'nav-broadcasts',
        title: t('broadcasts'),
        subtitle: 'Bulk campaign messaging',
        category: 'navigation',
        href: '/broadcasts',
        icon: Radio,
      },
      {
        id: 'nav-automations',
        title: t('automations'),
        subtitle: 'Trigger-action workflow rules',
        category: 'navigation',
        href: '/automations',
        icon: Zap,
      },
      {
        id: 'nav-flows',
        title: t('flows'),
        subtitle: 'Interactive lead qualification flows',
        category: 'navigation',
        href: '/flows',
        icon: Workflow,
      },
      {
        id: 'nav-agents',
        title: t('aiAgents'),
        subtitle: 'AI sales bots and knowledge base',
        category: 'navigation',
        href: '/agents',
        icon: Bot,
      },
      {
        id: 'nav-team',
        title: 'Team Command Center',
        subtitle: 'Agent availability, quotas and permissions',
        category: 'navigation',
        href: '/team',
        icon: UsersRound,
      },
      {
        id: 'nav-settings',
        title: t('settings'),
        subtitle: 'Workspace preferences, WhatsApp and API keys',
        category: 'navigation',
        href: '/settings',
        icon: Settings,
      },
    ],
    [t]
  );

  // Search contacts and properties asynchronously with debounce
  useEffect(() => {
    const trimmed = query.trim();
    if (!open || !trimmed || trimmed.length < 2 || !accountId) {
      setDbResults([]);
      setLoading(false);
      return;
    }

    let isCancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const supabase = createClient();

        // Query contacts and properties in parallel
        const [contactsRes, propsRes] = await Promise.all([
          supabase
            .from('contacts')
            .select('id, name, phone, conversations(id)')
            .eq('account_id', accountId)
            .or(`name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`)
            .limit(5),
          supabase
            .from('properties')
            .select('id, title, project_name, location')
            .eq('account_id', accountId)
            .or(
              `title.ilike.%${trimmed}%,project_name.ilike.%${trimmed}%,location.ilike.%${trimmed}%`
            )
            .limit(5),
        ]);

        if (isCancelled) return;

        const results: SearchResult[] = [];

        if (contactsRes.data) {
          for (const c of contactsRes.data) {
            const convs = Array.isArray(c.conversations)
              ? c.conversations
              : c.conversations
                ? [c.conversations]
                : [];
            const convId = convs[0]?.id;
            results.push({
              id: `contact-${c.id}`,
              title: c.name || c.phone || 'Unnamed Contact',
              subtitle: c.phone ? `Contact • ${c.phone}` : 'Contact',
              category: 'contacts',
              href: convId ? `/inbox?c=${convId}` : `/contacts?q=${encodeURIComponent(c.name || '')}`,
              icon: Users,
            });
          }
        }

        if (propsRes.data) {
          for (const p of propsRes.data) {
            results.push({
              id: `prop-${p.id}`,
              title: p.title || p.project_name || 'Property Listing',
              subtitle: p.location ? `Property • ${p.location}` : 'Property',
              category: 'properties',
              href: `/properties?search=${encodeURIComponent(p.title || '')}`,
              icon: Building,
            });
          }
        }

        setDbResults(results);
      } catch (err) {
        console.error('Command search error:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }, 200);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [query, open, accountId]);

  // Combined filtered items
  const displayedItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return navItems;
    }

    const filteredNav = navItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle?.toLowerCase().includes(q)
    );

    return [...dbResults, ...filteredNav];
  }, [query, navItems, dbResults]);

  // Reset selected index when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [displayedItems]);

  const handleSelect = useCallback(
    (item: SearchResult) => {
      onOpenChange(false);
      setQuery('');
      router.push(item.href);
    },
    [router, onOpenChange]
  );

  // Keyboard navigation inside list
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (displayedItems.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < displayedItems.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : displayedItems.length - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = displayedItems[selectedIndex];
        if (selected) {
          handleSelect(selected);
        }
      }
    },
    [displayedItems, selectedIndex, handleSelect]
  );

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[25%] p-0 max-w-lg overflow-hidden border-border bg-card shadow-2xl rounded-2xl"
      >
        <DialogTitle className="sr-only">Command Search</DialogTitle>
        <div className="flex items-center border-b border-border px-4 py-3">
          <Search className="size-5 text-muted-foreground mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('searchPlaceholder') || 'Search contacts, properties, navigation...'}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {loading && <Loader2 className="size-4 animate-spin text-muted-foreground mr-2 shrink-0" />}
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-muted-foreground hover:text-foreground p-1 rounded"
            >
              <X className="size-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ESC
            </kbd>
          )}
        </div>

        <div className="max-h-[360px] overflow-y-auto p-2">
          {displayedItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="space-y-1">
              {displayedItems.map((item, index) => {
                const isSelected = index === selectedIndex;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors',
                      isSelected
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-foreground hover:bg-muted/60'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-md border',
                          isSelected
                            ? 'border-primary/30 bg-primary/20 text-primary'
                            : 'border-border bg-muted text-muted-foreground'
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1 truncate">
                        <div className="truncate text-sm font-medium">{item.title}</div>
                        {item.subtitle && (
                          <div className="truncate text-xs text-muted-foreground">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <ArrowRight className="size-4 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border bg-muted/30 px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Navigate with ↑ and ↓</span>
          <span>Select with ↵</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
