'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { SocialPost } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { PostStatusBadge } from './post-status-badge';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  CalendarCheck,
  Ban,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { Instagram, Facebook } from '@/components/social/icons';
import { toast } from 'sonner';

interface PostCalendarProps {
  posts: SocialPost[];
  canPublish?: boolean;
  onPostUpdated?: () => void;
}

export function PostCalendar({
  posts,
  canPublish = false,
  onPostUpdated,
}: PostCalendarProps) {
  const t = useTranslations('SocialMedia');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Filter posts that have a scheduled date
  const scheduledPosts = useMemo(() => {
    return posts.filter(
      (p) =>
        Boolean(p.scheduled_at) &&
        (p.status === 'scheduled' ||
          p.status === 'draft' ||
          p.status === 'published' ||
          p.status === 'failed' ||
          p.status === 'publishing')
    );
  }, [posts]);

  // Map of YYYY-MM-DD -> SocialPost[]
  const postsByDate = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    for (const post of scheduledPosts) {
      if (!post.scheduled_at) continue;
      const dateKey = post.scheduled_at.split('T')[0];
      const existing = map.get(dateKey) ?? [];
      existing.push(post);
      map.set(dateKey, existing);
    }
    return map;
  }, [scheduledPosts]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = useMemo(() => {
    return currentDate.toLocaleString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  }, [currentDate]);

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday
    const daysInMonth = lastDayOfMonth.getDate();

    const days: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
    }[] = [];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 1, d);
      days.push({
        dateStr: prevDate.toISOString().split('T')[0],
        dayNumber: d,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
      });
    }

    // Next month padding to fill out 35 or 42 cells (multiples of 7)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({
        dateStr: nextDate.toISOString().split('T')[0],
        dayNumber: i,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [year, month]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now.toISOString().split('T')[0]);
  };

  const handleApproveAndSchedule = async (postId: string) => {
    setActionLoadingId(postId);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('social_posts')
        .update({ status: 'scheduled' })
        .eq('id', postId);

      if (error) throw error;
      toast.success(t('status.scheduled'));
      onPostUpdated?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to approve schedule'
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelSchedule = async (postId: string) => {
    setActionLoadingId(postId);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('social_posts')
        .update({ status: 'draft' })
        .eq('id', postId);

      if (error) throw error;
      toast.success(t('table.cancelSchedule'));
      onPostUpdated?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to cancel schedule'
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const selectedDayPosts = useMemo(() => {
    if (!selectedDate) return [];
    return postsByDate.get(selectedDate) ?? [];
  }, [selectedDate, postsByDate]);

  // Sorted list of all upcoming scheduled posts for mobile view
  const upcomingGroupedPosts = useMemo(() => {
    const dates = Array.from(postsByDate.keys()).sort();
    return dates.map((dateStr) => ({
      dateStr,
      posts: postsByDate.get(dateStr) ?? [],
    }));
  }, [postsByDate]);

  const weekDayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      {/* Calendar Navigation & Month Header */}
      <div className="border-border bg-card flex flex-col items-start justify-between gap-3 rounded-xl border p-4 shadow-xs sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
            <CalendarIcon className="size-5" />
          </div>
          <div>
            <h2 className="text-foreground text-lg font-bold tracking-tight">
              {monthName}
            </h2>
            <p className="text-muted-foreground text-xs">
              {t('calendar.postsCount', { count: scheduledPosts.length })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="text-xs"
          >
            {t('calendar.today')}
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handlePrevMonth}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleNextMonth}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Desktop Monthly Grid View (>= 768px) */}
      <div className="hidden space-y-4 md:block">
        <div className="border-border bg-card overflow-hidden rounded-xl border shadow-xs">
          {/* Weekday headers */}
          <div className="border-border bg-muted/40 grid grid-cols-7 border-b text-center text-xs font-semibold">
            {weekDayLabels.map((day) => (
              <div key={day} className="text-muted-foreground py-2.5">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="divide-border grid grid-cols-7 divide-x divide-y">
            {calendarDays.map((cell) => {
              const dayPosts = postsByDate.get(cell.dateStr) ?? [];
              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === selectedDate;
              const hasPosts = dayPosts.length > 0;

              return (
                <button
                  type="button"
                  key={cell.dateStr}
                  onClick={() => setSelectedDate(cell.dateStr)}
                  className={`group relative flex min-h-[105px] flex-col p-2 text-left transition-colors ${
                    cell.isCurrentMonth
                      ? 'bg-card hover:bg-muted/40'
                      : 'bg-muted/15 text-muted-foreground/60'
                  } ${isSelected ? 'ring-primary ring-1 ring-inset' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex size-6 items-center justify-center rounded-full text-xs font-medium ${
                        isToday
                          ? 'bg-primary text-primary-foreground font-bold'
                          : cell.isCurrentMonth
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {hasPosts && (
                      <span className="bg-primary/10 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                        {dayPosts.length}
                      </span>
                    )}
                  </div>

                  {/* Post preview chips */}
                  <div className="mt-1.5 flex flex-col gap-1 overflow-hidden">
                    {dayPosts.slice(0, 2).map((post) => {
                      const isPendingDraft =
                        post.status === 'draft' && Boolean(post.scheduled_at);
                      const isInstagram =
                        post.social_account?.platform === 'instagram';

                      return (
                        <div
                          key={post.id}
                          className={`flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            isPendingDraft
                              ? 'border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                              : 'bg-primary/10 text-primary'
                          }`}
                        >
                          {isInstagram ? (
                            <Instagram className="size-2.5 shrink-0 text-pink-600 dark:text-pink-400" />
                          ) : (
                            <Facebook className="size-2.5 shrink-0 text-blue-600 dark:text-blue-400" />
                          )}
                          <span className="truncate">
                            {post.caption ||
                              (isPendingDraft ? 'Draft Post' : 'Post')}
                          </span>
                        </div>
                      );
                    })}

                    {dayPosts.length > 2 && (
                      <span className="text-muted-foreground pl-1 text-[10px]">
                        +{dayPosts.length - 2} more
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Details Panel */}
        {selectedDate && (
          <div className="border-border bg-card rounded-xl border p-5 shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-foreground text-sm font-semibold">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString(
                    undefined,
                    {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    }
                  )}
                </h3>
                <p className="text-muted-foreground text-xs">
                  {t('calendar.postsCount', {
                    count: selectedDayPosts.length,
                  })}
                </p>
              </div>
            </div>

            {selectedDayPosts.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {selectedDayPosts.map((post) => {
                  const isInstagram =
                    post.social_account?.platform === 'instagram';
                  const isPendingDraft =
                    post.status === 'draft' && Boolean(post.scheduled_at);

                  return (
                    <div
                      key={post.id}
                      className="border-border bg-muted/20 hover:border-primary/40 flex flex-col justify-between gap-3 rounded-xl border p-4 transition-colors"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="bg-muted flex size-6 items-center justify-center rounded-full">
                              {isInstagram ? (
                                <Instagram className="size-3 text-pink-600 dark:text-pink-400" />
                              ) : (
                                <Facebook className="size-3 text-blue-600 dark:text-blue-400" />
                              )}
                            </div>
                            <span className="text-foreground max-w-[120px] truncate text-xs font-medium">
                              {post.social_account?.display_name ?? 'Account'}
                            </span>
                          </div>
                          <PostStatusBadge status={post.status} />
                        </div>

                        {post.media_url ? (
                          <div className="bg-muted relative aspect-video w-full overflow-hidden rounded-lg">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={post.media_url}
                              alt={post.caption ?? 'Scheduled media'}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : null}

                        {post.caption && (
                          <p className="text-foreground line-clamp-2 text-xs">
                            {post.caption}
                          </p>
                        )}

                        {post.scheduled_at && (
                          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <Clock className="text-primary size-3 shrink-0" />
                            <span>
                              {new Date(post.scheduled_at).toLocaleTimeString(
                                undefined,
                                {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                }
                              )}
                            </span>
                            {isPendingDraft && (
                              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                {t('calendar.pendingApproval')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {canPublish && (
                        <div className="border-border flex items-center justify-end gap-2 border-t pt-3">
                          {isPendingDraft && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={actionLoadingId === post.id}
                              onClick={() => handleApproveAndSchedule(post.id)}
                              className="border-primary/30 text-primary hover:bg-primary/10 h-7 text-xs"
                            >
                              {actionLoadingId === post.id ? (
                                <Loader2 className="mr-1 size-3 animate-spin" />
                              ) : (
                                <CalendarCheck className="mr-1 size-3" />
                              )}
                              {t('table.approveAndSchedule')}
                            </Button>
                          )}

                          {post.status === 'scheduled' && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={actionLoadingId === post.id}
                              onClick={() => handleCancelSchedule(post.id)}
                              className="text-muted-foreground hover:text-destructive h-7 text-xs"
                            >
                              {actionLoadingId === post.id ? (
                                <Loader2 className="mr-1 size-3 animate-spin" />
                              ) : (
                                <Ban className="mr-1 size-3" />
                              )}
                              {t('table.cancelSchedule')}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-muted-foreground py-8 text-center text-xs">
                {t('calendar.noPostsOnDay')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Date-Grouped View (< 768px) */}
      <div className="space-y-4 md:hidden">
        {upcomingGroupedPosts.length > 0 ? (
          upcomingGroupedPosts.map((group) => {
            const dateObj = new Date(group.dateStr + 'T00:00:00');
            const dateHeading = dateObj.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });

            return (
              <div key={group.dateStr} className="space-y-2">
                <div className="text-muted-foreground flex items-center justify-between px-1 text-xs font-semibold">
                  <span>{dateHeading}</span>
                  <span className="text-[11px]">
                    {t('calendar.postsCount', { count: group.posts.length })}
                  </span>
                </div>

                <div className="space-y-3">
                  {group.posts.map((post) => {
                    const isInstagram =
                      post.social_account?.platform === 'instagram';
                    const isPendingDraft =
                      post.status === 'draft' && Boolean(post.scheduled_at);

                    return (
                      <div
                        key={post.id}
                        className="border-border bg-card space-y-3 rounded-xl border p-4 shadow-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="bg-muted flex size-6 items-center justify-center rounded-full">
                              {isInstagram ? (
                                <Instagram className="size-3 text-pink-600 dark:text-pink-400" />
                              ) : (
                                <Facebook className="size-3 text-blue-600 dark:text-blue-400" />
                              )}
                            </div>
                            <span className="text-foreground max-w-[140px] truncate text-xs font-medium">
                              {post.social_account?.display_name ?? 'Account'}
                            </span>
                          </div>
                          <PostStatusBadge status={post.status} />
                        </div>

                        {post.media_url && (
                          <div className="bg-muted relative aspect-video w-full overflow-hidden rounded-lg">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={post.media_url}
                              alt={post.caption ?? 'Post media'}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}

                        {post.caption && (
                          <p className="text-foreground line-clamp-3 text-xs">
                            {post.caption}
                          </p>
                        )}

                        <div className="border-border text-muted-foreground flex items-center justify-between border-t pt-2 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <Clock className="text-primary size-3 shrink-0" />
                            <span>
                              {post.scheduled_at
                                ? new Date(
                                    post.scheduled_at
                                  ).toLocaleTimeString(undefined, {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                            {isPendingDraft && (
                              <span className="rounded bg-amber-500/10 px-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                {t('calendar.pendingApproval')}
                              </span>
                            )}
                          </div>

                          {canPublish && (
                            <div className="flex items-center gap-1.5">
                              {isPendingDraft && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={actionLoadingId === post.id}
                                  onClick={() =>
                                    handleApproveAndSchedule(post.id)
                                  }
                                  className="border-primary/30 text-primary hover:bg-primary/10 h-7 text-xs font-medium"
                                >
                                  {actionLoadingId === post.id ? (
                                    <Loader2 className="mr-1 size-3 animate-spin" />
                                  ) : (
                                    <CalendarCheck className="mr-1 size-3" />
                                  )}
                                  {t('table.approveAndSchedule')}
                                </Button>
                              )}

                              {post.status === 'scheduled' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={actionLoadingId === post.id}
                                  onClick={() => handleCancelSchedule(post.id)}
                                  className="text-muted-foreground hover:text-destructive h-7 text-xs"
                                >
                                  {actionLoadingId === post.id ? (
                                    <Loader2 className="mr-1 size-3 animate-spin" />
                                  ) : (
                                    <Ban className="mr-1 size-3" />
                                  )}
                                  {t('table.cancelSchedule')}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : (
          <div className="border-border bg-card flex h-48 flex-col items-center justify-center rounded-xl border p-6 text-center shadow-xs">
            <ImageIcon className="text-muted-foreground mb-2 size-8" />
            <p className="text-foreground text-sm font-medium">
              {t('page.noScheduledPosts')}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('page.scheduleYourFirst')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
