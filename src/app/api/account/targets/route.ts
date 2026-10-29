import { NextResponse } from 'next/server';
import {
  requireRole,
  getCurrentAccount,
  toErrorResponse,
} from '@/lib/auth/account';
import { AgentTargetInputSchema } from '@/lib/schemas/agent-target';

function computeMonthEnd(dateStr: string): string {
  const [yearStr, monthStr] = dateStr.split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${yearStr}-${monthStr.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

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
      return NextResponse.json(
        { error: 'Failed to fetch targets' },
        { status: 500 }
      );
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

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = AgentTargetInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }
    const val = parsed.data;

    const periodEnd = val.period_end || computeMonthEnd(val.period_start);

    const { data, error } = await ctx.supabase
      .from('agent_targets')
      .upsert(
        {
          account_id: ctx.accountId,
          agent_id: val.agent_id,
          period_start: val.period_start,
          period_end: periodEnd,
          target_visits: val.target_visits,
          target_bookings: val.target_bookings,
        },
        { onConflict: 'account_id, agent_id, period_start' }
      )
      .select()
      .single();

    if (error) {
      console.error('[POST /api/account/targets] error:', error);
      return NextResponse.json(
        { error: 'Failed to save target' },
        { status: 500 }
      );
    }

    return NextResponse.json({ target: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
