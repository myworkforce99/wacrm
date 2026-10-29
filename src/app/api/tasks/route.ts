import { NextResponse } from 'next/server';
import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account';
import { canManageMembers } from '@/lib/auth/roles';

export async function GET(request: Request) {
  try {
    const { supabase, userId, role } = await getCurrentAccount();
    const url = new URL(request.url);
    const dueToday = url.searchParams.get('due_today') === 'true';
    const contactId = url.searchParams.get('contact_id');
    const assignedTo = url.searchParams.get('assigned_to');

    let query = supabase.from('tasks').select('*, contacts(name)');

    if (dueToday) {
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      query = query.lte('due_at', endOfToday.toISOString()).eq('done', false);
    }
    if (contactId) {
      query = query.eq('contact_id', contactId);
    }

    const isManager = role ? canManageMembers(role) : false;

    if (assignedTo) {
      if (!isManager && assignedTo !== userId) {
        return NextResponse.json({ tasks: [] });
      }
      query = query.eq('assigned_to', assignedTo);
    } else if (!isManager) {
      query = query.or(`assigned_to.eq.${userId},created_by.eq.${userId}`);
    }

    const { data, error } = await query.order('due_at', { ascending: true });
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tasks: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

import { TaskInputSchema } from '@/lib/schemas/task';

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireRole('agent');
  } catch (err) {
    return toErrorResponse(err);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const parsed = TaskInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }
  const val = parsed.data;

  const { data, error } = await ctx.supabase
    .from('tasks')
    .insert({
      account_id: ctx.accountId,
      created_by: ctx.userId,
      title: val.title,
      contact_id: val.contact_id ?? null,
      site_visit_id: val.site_visit_id ?? null,
      due_at: val.due_at ?? null,
      assigned_to: val.assigned_to ?? null,
      done: val.done,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ task: data }, { status: 201 });
}
