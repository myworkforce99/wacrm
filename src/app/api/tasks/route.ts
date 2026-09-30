import { NextResponse } from 'next/server';
import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account';

export async function GET(request: Request) {
  try {
    const { supabase } = await getCurrentAccount();
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
    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }

    const { data, error } = await query.order('due_at', { ascending: true });
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tasks: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireRole('agent');
  } catch (err) {
    return toErrorResponse(err);
  }

  const body = await request.json().catch(() => null);
  if (!body)
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from('tasks')
    .insert({
      account_id: ctx.accountId,
      created_by: ctx.userId,
      title,
      contact_id: body.contact_id || null,
      site_visit_id: body.site_visit_id || null,
      due_at: body.due_at || null,
      assigned_to: body.assigned_to || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ task: data }, { status: 201 });
}
