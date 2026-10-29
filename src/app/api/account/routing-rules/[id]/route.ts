import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { createClient } from '@/lib/supabase/server';
import { hasMinRole } from '@/lib/auth/roles';
import { toApiErrorResponse } from '@/lib/api/v1/respond';

import { LeadRoutingRulePatchSchema } from '@/lib/schemas/routing-rule';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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

    const parsed = LeadRoutingRulePatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }
    const val = parsed.data;
    if (Object.keys(val).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('lead_routing_rules')
      .update(val)
      .eq('id', id)
      .eq('account_id', account.accountId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const account = await getCurrentAccount();
    if (!account)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasMinRole(account.role, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('lead_routing_rules')
      .delete()
      .eq('id', id)
      .eq('account_id', account.accountId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
