import { NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/auth/api-context'; // wait, for dashboard routes we usually use try/catch -> toErrorResponse with getCurrentAccount.
// Let's look at `src/app/api/account/route.ts` pattern.
import { getCurrentAccount } from '@/lib/auth/account';
import { createClient } from '@/lib/supabase/server';
import { hasMinRole } from '@/lib/auth/roles';
import { toApiErrorResponse } from '@/lib/api/v1/respond';

export async function GET(request: Request) {
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

    const body = await request.json();
    const supabase = await createClient();

    // Using service-role or user-client? The migration sets RLS so user client is fine.
    // wait, supabaseServer is the user client.

    const { data, error } = await supabase
      .from('lead_routing_rules')
      .insert({
        account_id: account.accountId,
        priority: body.priority ?? 0,
        condition_type: body.condition_type,
        condition_value: body.condition_value,
        action_type: body.action_type,
        action_value: body.action_value,
        is_active: body.is_active ?? true,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
