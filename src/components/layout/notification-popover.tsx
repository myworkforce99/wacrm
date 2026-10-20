'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Loader2, UserPlus, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useUnreadNotifications } from '@/hooks/use-unread-notifications';
import type { Notification } from '@/types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export function NotificationPopover() {
  const t = useTranslations('Notifications');
  const router = useRouter();
  const { accountId } = useAuth();
  const unreadCount = useUnreadNotifications();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const loadRecent = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(6);

      if (!error && data) {
        setNotifications(data as Notification[]);
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (open) {
      loadRecent();
    }
  }, [open, loadRecent]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id && !n.read_at
          ? { ...n, read_at: new Date().toISOString() }
          : n
      )
    );
    const supabase = createClient();
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .is('read_at', null);
  }, []);

  const handleNotificationClick = useCallback(
    (n: Notification) => {
      if (!n.read_at) markRead(n.id);
      setOpen(false);
      if (n.conversation_id) {
        router.push(`/inbox?c=${n.conversation_id}`);
      } else {
        router.push('/notifications');
      }
    },
    [markRead, router]
  );

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read_at);
    if (unread.length === 0 && unreadCount === 0) return;
    setMarkingAll(true);
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: now }))
    );
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: now })
        .eq('account_id', accountId)
        .is('read_at', null);

      if (error) {
        toast.error(t('markAllFailed'));
        loadRecent();
      } else {
        toast.success('All notifications marked as read');
      }
    } catch {
      toast.error(t('markAllFailed'));
    } finally {
      setMarkingAll(false);
    }
  }, [notifications, unreadCount, accountId, t, loadRecent]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={t('title')}
            className="hover:bg-muted relative flex rounded-lg p-2 transition-colors focus:outline-none"
          />
        }
      >
        <Bell className="text-muted-foreground size-4" />
        {unreadCount > 0 && (
          <span className="bg-primary ring-background absolute top-1 right-1 h-2 w-2 rounded-full ring-2" />
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="border-border bg-card w-80 max-w-[calc(100vw-2rem)] overflow-hidden p-0 shadow-xl sm:w-96"
      >
        <div className="border-border bg-muted/40 flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-foreground text-sm font-semibold">
              {t('title')}
            </span>
            {unreadCount > 0 && (
              <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              disabled={markingAll}
              onClick={markAllRead}
              className="text-primary flex items-center gap-1 text-xs font-medium hover:underline disabled:opacity-50"
            >
              {markingAll ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <CheckCheck className="size-3" />
              )}
              {t('markAllRead')}
            </button>
          )}
        </div>

        <div className="divide-border max-h-[320px] divide-y overflow-y-auto">
          {loading ? (
            <div className="text-muted-foreground flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-muted-foreground px-4 py-8 text-center text-xs">
              {t('emptyTitle')}
            </div>
          ) : (
            notifications.map((n) => {
              const isUnread = !n.read_at;
              let timeAgo = '';
              try {
                timeAgo = formatDistanceToNow(new Date(n.created_at), {
                  addSuffix: true,
                });
              } catch {
                timeAgo = '';
              }

              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    'hover:bg-muted/50 flex w-full items-start gap-3 p-3 text-left transition-colors',
                    isUnread ? 'bg-primary/5 font-medium' : 'opacity-80'
                  )}
                >
                  <div
                    className={cn(
                      'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                      isUnread
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <UserPlus className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-xs font-medium">
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                        {n.body}
                      </p>
                    )}
                    {timeAgo && (
                      <span className="text-muted-foreground mt-1 block text-[10px]">
                        {timeAgo}
                      </span>
                    )}
                  </div>
                  {isUnread && (
                    <span className="bg-primary mt-1 size-2 shrink-0 rounded-full" />
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="border-border bg-muted/20 border-t p-2 text-center">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="text-primary inline-flex items-center gap-1 py-1 text-xs font-medium hover:underline"
          >
            <span>View all notifications</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
