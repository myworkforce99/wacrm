import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/automations/admin-client';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireRole('admin');
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: 'Missing body' }, { status: 400 });
    }

    // Only allow updating is_available for now
    const updates: any = {};
    if (typeof body.is_available === 'boolean') {
      updates.is_available = body.is_available;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { error } = await supabaseAdmin()
      .from('profiles')
      .update(updates)
      .eq('user_id', id)
      .eq('account_id', ctx.accountId);

    if (error) {
      console.error('[PATCH /api/account/members/[id]] error:', error);
      return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
