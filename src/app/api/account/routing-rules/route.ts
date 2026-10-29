import { NextResponse } from 'next/server';

// Let's look at `src/app/api/account/route.ts` pattern.
import { getCurrentAccount } from '@/lib/auth/account';
import { createClient } from '@/lib/supabase/server';
import { hasMinRole } from '@/lib/auth/roles';
import { toApiErrorResponse } from '@/lib/api/v1/respond';
import { LeadRoutingRuleInputSchema } from '@/lib/schemas/routing-rule';

export async function GET() {
  try {
    const account = await getCurrentAccount();
    if (!account)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check permission - S3 says admin+ only
    if (!hasMinRole(account.role, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('lead_routing_rules')
      .select('*')
      .eq('account_id', account.accountId)
      .order('priority', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ routing_rules: data });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const account = await getCurrentAccount();
    if (!account)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasMinRole(account.role, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = LeadRoutingRuleInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }
    const val = parsed.data;

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('lead_routing_rules')
      .insert({
        account_id: account.accountId,
        priority: val.priority,
        condition_type: val.condition_type,
        condition_value: val.condition_value,
        action_type: val.action_type,
        action_value: val.action_value,
        is_active: val.is_active,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
