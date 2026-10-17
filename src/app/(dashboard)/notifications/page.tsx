'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type { Notification } from '@/types';
import {
  Bell,
  CheckCheck,
  Loader2,
  UserPlus,
  MessageSquare,
  Calendar,
  DollarSign,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

function getNotificationIcon(n: Notification) {
  const type = (n.type as string) || '';
  const text = `${n.title} ${n.body || ''}`.toLowerCase();
  if (type === 'conversation_assigned' || text.includes('assigned') || text.includes('lead')) {
    return UserPlus;
  }
  if (type === 'new_message' || text.includes('message') || text.includes('chat')) {
    return MessageSquare;
  }
  if (type === 'site_visit_reminder' || text.includes('visit') || text.includes('schedule')) {
    return Calendar;
  }
  if (
    type === 'deal_won' ||
    text.includes('deal') ||
    text.includes('won') ||
    text.includes('crore') ||
    text.includes('lakh')
  ) {
    return DollarSign;
  }
  if (text.includes('property') || text.includes('unit')) {
    return Building2;
  }
  if (text.includes('alert') || text.includes('warning')) {
    return AlertTriangle;
  }
  return Bell;
}

export default function NotificationsPage() {
  const t = useTranslations('Notifications');
  const router = useRouter();
  const { accountId } = useAuth();
  const [notifications, setNotifications] = useState<Notification[] | null>(
    null
  );
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all');
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    if (!accountId) return;
    const supabase = createClient();
    const { data, error: fetchErr } = await supabase
      .from('notifications')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (fetchErr) {
      setError(fetchErr.message);
      return;
    }
    setNotifications((data ?? []) as Notification[]);
  }, [accountId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Realtime — new assignments appear without a refresh, and a
  // "mark all read" fired from another tab/device stays in sync here.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('notifications-page')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Notification;
            setNotifications((prev) => {
              if (!prev) return [row];
              if (prev.some((n) => n.id === row.id)) return prev;
              return [row, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as Notification;
            setNotifications(
              (prev) =>
                prev?.map((n) => (n.id === row.id ? { ...n, ...row } : n)) ??
                prev
            );
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as Partial<Notification>;
            setNotifications(
              (prev) => prev?.filter((n) => n.id !== oldRow.id) ?? prev
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const markRead = useCallback(
    async (id: string) => {
      // Optimistic — the row is already visually "read" by the time the
      // request lands, so the UI doesn't wait on the round-trip.
      setNotifications(
        (prev) =>
          prev?.map((n) =>
            n.id === id && !n.read_at
              ? { ...n, read_at: new Date().toISOString() }
              : n
          ) ?? prev
      );
      const supabase = createClient();
      const { error: updateErr } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .is('read_at', null);
      if (updateErr) {
        toast.error(t('markReadFailed'));
        load();
      }
    },
    [load, t]
  );

  const handleClick = useCallback(
    (n: Notification) => {
      if (!n.read_at) markRead(n.id);
      const text = `${n.title} ${n.body || ''}`.toLowerCase();
      if (n.conversation_id) {
        router.push(`/inbox?c=${n.conversation_id}`);
      } else if (n.contact_id) {
        router.push(`/contacts?contactId=${n.contact_id}`);
      } else if (text.includes('visit') || text.includes('schedule')) {
        router.push('/site-visits');
      } else if (text.includes('deal') || text.includes('pipeline')) {
        router.push('/pipelines');
      } else if (text.includes('lead') || text.includes('assigned')) {
        router.push('/contacts');
      }
    },
    [markRead, router]
  );

  const unreadIds =
    notifications?.filter((n) => !n.read_at).map((n) => n.id) ?? [];

  const markAllRead = useCallback(async () => {
    if (unreadIds.length === 0) return;
    setMarkingAll(true);
    const now = new Date().toISOString();
    setNotifications(
      (prev) =>
        prev?.map((n) => (n.read_at ? n : { ...n, read_at: now })) ?? prev
    );
    const supabase = createClient();
    const { error: updateErr } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .is('read_at', null);
    setMarkingAll(false);
    if (updateErr) {
      toast.error(t('markAllFailed'));
      load();
    }
  }, [unreadIds.length, load, t]);

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-destructive text-sm">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  if (notifications === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-primary h-6 w-6 animate-spin" />
      </div>
    );
  }

  const filteredNotifications = notifications.filter((n) =>
    filterTab === 'unread' ? !n.read_at : true
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t('description')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={unreadIds.length === 0 || markingAll}
            onClick={markAllRead}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            {markingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4 text-emerald-500" />
            )}
            {t('markAllRead')}
          </Button>
        </div>
      </div>

      {/* Filter Tabs Strip: All vs Unread */}
      <div className="border-border bg-card flex items-center justify-between rounded-xl border p-2 shadow-xs">
        <div className="bg-muted/60 inline-flex items-center rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
              filterTab === 'all'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t('all')} ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('unread')}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
              filterTab === 'unread'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t('unread')} ({unreadIds.length})
          </button>
        </div>
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="border-border bg-muted/30 flex h-52 flex-col items-center justify-center rounded-xl border border-dashed px-4 text-center">
          <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-xl">
            {filterTab === 'unread' ? (
              <CheckCheck className="text-emerald-500 h-6 w-6" />
            ) : (
              <Bell className="text-primary h-6 w-6" />
            )}
          </div>
          <p className="text-foreground mt-3 text-sm font-semibold">
            {filterTab === 'unread' ? t('emptyUnreadTitle') : t('emptyTitle')}
          </p>
          <p className="text-muted-foreground mt-1 max-w-sm text-xs">
            {filterTab === 'unread' ? t('emptyUnreadDesc') : t('emptyDesc')}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {filteredNotifications.map((n) => {
            const Icon = getNotificationIcon(n);
            const isUnread = !n.read_at;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleClick(n)}
                  className={cn(
                    'group flex w-full items-start gap-3.5 rounded-xl border p-4 text-left transition-all',
                    isUnread
                      ? 'border-primary/40 bg-primary/5 hover:border-primary/60 hover:shadow-xs'
                      : 'border-border bg-card hover:border-border/80 hover:bg-muted/20'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105',
                      isUnread
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                    aria-hidden
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'truncate text-sm font-semibold',
                          isUnread ? 'text-foreground' : 'text-muted-foreground'
                        )}
                        title={n.title}
                      >
                        {n.title}
                      </span>
                      {isUnread && (
                        <span
                          aria-label={t('unread')}
                          className="bg-primary h-2 w-2 shrink-0 rounded-full"
                        />
                      )}
                    </div>
                    {n.body && (
                      <p
                        className="text-muted-foreground mt-0.5 line-clamp-2 text-xs"
                        title={n.body}
                      >
                        {n.body}
                      </p>
                    )}
                    <p className="text-muted-foreground/70 mt-1.5 text-[11px] font-medium">
                      {formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
