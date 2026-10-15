'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from './skeleton';
import { Task } from '@/types';
import Link from 'next/link';
import { formatDistanceToNow, isToday, format } from 'date-fns';
import { useTranslations } from 'next-intl';
import { CheckSquare2, Plus } from 'lucide-react';

interface TasksWidgetProps {
  contactId?: string;
  initialTasks?: Task[];
  initialLoading?: boolean;
}

export function TasksWidget({
  contactId,
  initialTasks,
  initialLoading,
}: TasksWidgetProps) {
  const t = useTranslations('Dashboard.tasks');
  const [tasks, setTasks] = useState<Task[]>(initialTasks || []);
  const [loading, setLoading] = useState(initialLoading ?? true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialTasks !== undefined) {
      setTasks(initialTasks);
      setLoading(initialLoading ?? false);
    }
  }, [initialTasks, initialLoading]);

  useEffect(() => {
    if (initialTasks !== undefined) return;
    async function loadTasks() {
      try {
        const url = contactId
          ? `/api/tasks?contact_id=${contactId}`
          : '/api/tasks?due_today=true';
        const res = await fetch(url);
        if (!res.ok) throw new Error(t('taskFailed'));
        const data = await res.json();
        setTasks(data.tasks || []);
      } catch (err: unknown) {
        const error = err as Error;
        toast.error(error.message || t('taskFailed'));
      } finally {
        setLoading(false);
      }
    }
    loadTasks();
  }, [contactId, initialTasks, t]);

  const handleToggle = async (task: Task) => {
    const updated = !task.done;

    // optimistic update
    if (!contactId) {
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, done: updated } : t))
      );
    }

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: updated }),
      });
      if (!res.ok) {
        throw new Error(t('taskFailed'));
      }
    } catch {
      toast.error(t('taskFailed'));
      // revert on failure
      if (!contactId) {
        setTasks((prev) => [task, ...prev]);
      } else {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, done: task.done } : t))
        );
      }
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          contact_id: contactId || undefined,
          due_at: dueDate
            ? new Date(dueDate).toISOString()
            : new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(t('taskFailed'));
      const data = await res.json();
      setTasks((prev) => [data.task, ...prev]);
      setNewTaskTitle('');
      setDueDate('');
      toast.success(t('taskCreated'));
    } catch {
      toast.error(t('taskFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingTasks = tasks.filter((t) => !t.done);

  function formatDue(dueAt: string | null | undefined) {
    if (!dueAt) return null;
    const d = new Date(dueAt);
    if (isToday(d)) {
      return t('dueTodayAt', { time: format(d, 'h:mm a') });
    }
    if (d < new Date()) {
      return t('dueAgo', { time: formatDistanceToNow(d) });
    }
    return t('dueAt', { date: format(d, 'MMM d, h:mm a') });
  }

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="flex h-full flex-col p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare2 className="text-primary h-4 w-4" />
          <h3 className="text-foreground text-sm font-semibold">
            {contactId ? 'Tasks' : t('title')}
          </h3>
        </div>
        <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
          {t('pending', { count: pendingTasks.length })}
        </span>
      </div>

      <div className="max-h-[280px] flex-1 space-y-2.5 overflow-y-auto pr-1">
        {tasks.map((task) => {
          const isOverdue =
            !task.done && task.due_at && new Date(task.due_at) < new Date();
          return (
            <div
              key={task.id}
              className={`border-border bg-card hover:bg-muted/40 flex items-start gap-3 rounded-lg border p-2.5 transition-colors ${
                task.done ? 'opacity-60' : ''
              }`}
            >
              <Checkbox
                checked={task.done}
                onCheckedChange={() => handleToggle(task)}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`text-foreground truncate text-sm font-medium ${
                    task.done ? 'text-muted-foreground line-through' : ''
                  }`}
                >
                  {task.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {task.contact_id && !contactId && (
                    <Link
                      href={`/contacts?contactId=${task.contact_id}`}
                      className="text-primary max-w-[140px] truncate text-xs hover:underline"
                    >
                      {task.contacts?.name || t('viewContact')}
                    </Link>
                  )}
                  {task.due_at && (
                    <span
                      className={`text-xs tabular-nums ${
                        isOverdue
                          ? 'font-medium text-red-500'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {formatDue(task.due_at)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {tasks.length === 0 && (
          <div className="text-muted-foreground flex flex-col items-center justify-center py-8 text-center text-xs">
            <p>{t('noTasks')}</p>
          </div>
        )}
      </div>

      <form
        onSubmit={handleCreate}
        className="border-border mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row"
      >
        <Input
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder={t('placeholder')}
          className="text-foreground min-w-0 flex-1 text-xs sm:text-sm"
        />
        <div className="flex items-center gap-2">
          <Input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="text-muted-foreground w-full text-xs sm:w-[170px]"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!newTaskTitle.trim() || isSubmitting}
            className="shrink-0 gap-1 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t('add')}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
