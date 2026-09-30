import { NextResponse } from 'next/server';
import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const { supabase } = await getCurrentAccount();
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ task: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await requireRole('agent');
  } catch (err) {
    return toErrorResponse(err);
  }

  const { id } = await props.params;
  const body = await request.json().catch(() => null);
  if (!body)
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const updates: Record<string, string | boolean | null> = {};
  if (typeof body.title === 'string') updates.title = body.title.trim();
  if (body.due_at !== undefined) updates.due_at = body.due_at;
  if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to;

  if (typeof body.done === 'boolean') {
    updates.done = body.done;
    if (body.done) updates.done_at = new Date().toISOString();
    else updates.done_at = null;
  }

  const { data, error } = await ctx.supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await requireRole('agent');
  } catch (err) {
    return toErrorResponse(err);
  }

  const { id } = await props.params;
  const { error } = await ctx.supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
