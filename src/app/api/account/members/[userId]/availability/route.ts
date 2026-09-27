import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Both admin and the user themselves can change availability
    const ctx = await requireRole('viewer'); // get context
    const { userId } = await params;

    // Authorization: User must be admin, or modifying their own profile
    if (ctx.userId !== userId && ctx.role !== 'admin' && ctx.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const limit = checkRateLimit(
      `availability:${ctx.userId}`,
      RATE_LIMITS.adminAction
    );
    if (!limit.success) return rateLimitResponse(limit);

    const body = (await request.json().catch(() => null)) as {
      is_available?: boolean;
    } | null;

    if (body?.is_available === undefined) {
      return NextResponse.json(
        { error: "'is_available' is required" },
        { status: 400 }
      );
    }

    const { error } = await ctx.supabase
      .from('profiles')
      .update({ is_available: Boolean(body.is_available) })
      .eq('user_id', userId)
      .eq('account_id', ctx.accountId);

    if (error) {
      console.error('[availability route] update error:', error);
      return NextResponse.json(
        { error: 'Failed to update availability' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
