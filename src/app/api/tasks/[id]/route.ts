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

import { TaskPatchSchema } from '@/lib/schemas/task';

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
  if (!body || typeof body !== 'object')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const parsed = TaskPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }
  const val = parsed.data;

  const updates: Record<string, string | boolean | null> = {};
  if (val.title !== undefined) updates.title = val.title;
  if (val.due_at !== undefined) updates.due_at = val.due_at;
  if (val.assigned_to !== undefined) updates.assigned_to = val.assigned_to;
  if (val.contact_id !== undefined) updates.contact_id = val.contact_id;
  if (val.site_visit_id !== undefined)
    updates.site_visit_id = val.site_visit_id;

  if (val.done !== undefined) {
    updates.done = val.done;
    if (val.done) updates.done_at = new Date().toISOString();
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
  const { error } = await ctx.supabase.from('tasks').delete().eq('id', id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
