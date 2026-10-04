import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { canMoveDeal } from '@/lib/auth/roles';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let ctx;
  try {
    ctx = await requireRole('agent');
  } catch (err) {
    return toErrorResponse(err);
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // deals.assigned_to stores profiles.id — join to resolve the agent's user_id
  // so canMoveDeal can compare against ctx.userId (auth UUID).
  const { data: deal, error: dealError } = await supabaseAdmin()
    .from('deals')
    .select('assigned_to, contact_id, assignee:profiles!deals_assigned_to_fkey(user_id)')
    .eq('id', id)
    .eq('account_id', ctx.accountId)
    .single();

  if (dealError || !deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  const { data: conv } = await supabaseAdmin()
    .from('conversations')
    .select('assigned_agent_id')
    .eq('contact_id', deal.contact_id)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Resolve the deal assignee's user_id from the joined profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assigneeProfile = (deal as any).assignee;
  const dealAssigneeUserId: string | null = Array.isArray(assigneeProfile)
    ? assigneeProfile[0]?.user_id ?? null
    : assigneeProfile?.user_id ?? null;

  if (
    !canMoveDeal(
      ctx.role,
      dealAssigneeUserId,
      conv?.assigned_agent_id,
      ctx.userId
    )
  ) {
    return NextResponse.json(
      {
        error: 'DEAL_NOT_YOURS',
        message:
          'You can only move your own deals. Ask your admin to reassign it first.',
      },
      { status: 403 }
    );
  }

  const { error } = await supabaseAdmin()
    .from('deals')
    .update(body)
    .eq('id', id)
    .eq('account_id', ctx.accountId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
