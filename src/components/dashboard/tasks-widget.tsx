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

function formatDueTime(dueAt: string | null | undefined) {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  if (isToday(d)) {
    return `Due today at ${format(d, 'h:mm a')}`;
  }
  if (d < new Date()) {
    return `Due ${formatDistanceToNow(d, { addSuffix: true })}`;
  }
  return `Due ${format(d, 'MMM d, h:mm a')}`;
}

interface TasksWidgetProps {
  contactId?: string;
}

export function TasksWidget({ contactId }: TasksWidgetProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    async function loadTasks() {
      try {
        const url = contactId
          ? `/api/tasks?contact_id=${contactId}`
          : '/api/tasks?due_today=true';
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load tasks');
        const data = await res.json();
        setTasks(data.tasks);
      } catch (err: unknown) {
        const error = err as Error;
        toast.error(error.message || 'Error loading tasks');
      } finally {
        setLoading(false);
      }
    }
    loadTasks();
  }, [contactId]);

  const handleToggle = async (task: Task) => {
    const updated = !task.done;

    // optimistic
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
        throw new Error('Failed to update task');
      }
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || 'Failed to update task');
      // revert
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
    if (!newTaskTitle.trim()) return;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle,
          contact_id: contactId || undefined,
          due_at: dueDate
            ? new Date(dueDate).toISOString()
            : new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      const data = await res.json();
      setTasks((prev) => [data.task, ...prev]);
      setNewTaskTitle('');
      setDueDate('');
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || 'Error creating task');
    }
  };

  const pendingTasks = tasks.filter((t) => !t.done);

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          {contactId ? 'Tasks' : "Today's Tasks"}
        </h3>
        <div className="bg-muted text-muted-foreground rounded-full px-2 py-1 text-xs">
          {pendingTasks.length} pending
        </div>
      </div>

      <div className="max-h-[300px] flex-1 space-y-3 overflow-auto">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-start space-x-3 rounded-lg border p-3 ${task.done ? 'opacity-60' : ''}`}
          >
            <Checkbox
              checked={task.done}
              onCheckedChange={() => handleToggle(task)}
              className="mt-1"
            />
            <div className="flex flex-1 flex-col gap-1">
              <span
                className={`text-sm ${task.done ? 'text-muted-foreground line-through' : ''}`}
              >
                {task.title}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {task.contact_id && !contactId && (
                  <Link
                    href={`/contacts/${task.contact_id}`}
                    className="text-primary text-xs hover:underline"
                  >
                    {task.contacts?.name || 'View Contact'}
                  </Link>
                )}
                {task.due_at && (
                  <span className="text-muted-foreground text-xs">
                    {formatDueTime(task.due_at)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {tasks.length === 0 && (
          <p className="text-muted-foreground text-sm">No tasks to show.</p>
        )}
      </div>

      <form onSubmit={handleCreate} className="flex space-x-2 pt-2">
        <Input
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="New task..."
          className="flex-1"
        />
        <Input
          type="datetime-local"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-auto shrink-0 sm:w-[180px]"
        />
        <Button type="submit" disabled={!newTaskTitle.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}
