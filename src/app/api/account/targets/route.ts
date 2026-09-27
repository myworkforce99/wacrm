import { NextResponse } from 'next/server';
import { requireRole, getCurrentAccount, toErrorResponse } from '@/lib/auth/account';

export async function GET(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    const url = new URL(request.url);
    const periodStart = url.searchParams.get('period_start');

    let query = ctx.supabase
      .from('agent_targets')
      .select('*')
      .eq('account_id', ctx.accountId);

    if (periodStart) {
      query = query.eq('period_start', periodStart);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[GET /api/account/targets] error:', error);
      return NextResponse.json({ error: 'Failed to fetch targets' }, { status: 500 });
    }

    return NextResponse.json({ targets: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const body = await request.json().catch(() => null);

    if (!body || !body.agent_id || !body.period_start) {
      return NextResponse.json(
        { error: 'agent_id and period_start are required' },
        { status: 400 }
      );
    }

    const { data, error } = await ctx.supabase
      .from('agent_targets')
      .upsert({
        account_id: ctx.accountId,
        agent_id: body.agent_id,
        period_start: body.period_start,
        period_end: body.period_end || new Date(new Date(body.period_start).getFullYear(), new Date(body.period_start).getMonth() + 1, 0).toISOString().split('T')[0],
        target_visits: body.target_visits ?? 0,
        target_bookings: body.target_bookings ?? 0,
      }, { onConflict: 'account_id, agent_id, period_start' })
      .select()
      .single();

    if (error) {
      console.error('[POST /api/account/targets] error:', error);
      return NextResponse.json({ error: 'Failed to save target' }, { status: 500 });
    }

    return NextResponse.json({ target: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
