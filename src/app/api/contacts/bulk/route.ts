import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { createClient } from '@/lib/supabase/server';
import { hasMinRole } from '@/lib/auth/roles';
import { toApiErrorResponse } from '@/lib/api/v1/respond';

export async function POST(request: Request) {
  try {
    const account = await getCurrentAccount();
    if (!account)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only admins can do bulk reassignment
    if (!hasMinRole(account.role, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action, target_agent_id, contact_ids } = body;

    if (
      action !== 'reassign' ||
      !target_agent_id ||
      !Array.isArray(contact_ids) ||
      contact_ids.length === 0
    ) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch existing conversations to know from_agent_id
    const { data: convs, error: convsError } = await supabase
      .from('conversations')
      .select('contact_id, assigned_agent_id')
      .eq('account_id', account.accountId)
      .in('contact_id', contact_ids);

    if (convsError) throw convsError;

    // Update conversations
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ assigned_agent_id: target_agent_id })
      .eq('account_id', account.accountId)
      .in('contact_id', contact_ids);

    if (updateError) throw updateError;

    // Insert history
    const historyPayload = (convs || []).map((conv) => ({
      account_id: account.accountId,
      contact_id: conv.contact_id,
      from_agent_id: conv.assigned_agent_id,
      to_agent_id: target_agent_id,
      actor_id: account.userId,
      reason: 'bulk_reassign',
    }));

    if (historyPayload.length > 0) {
      await supabase.from('assignment_history').insert(historyPayload);
    }

    return NextResponse.json({ success: true, updated: historyPayload.length });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
