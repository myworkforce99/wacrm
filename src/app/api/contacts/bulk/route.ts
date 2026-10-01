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

    if (!hasMinRole(account.role, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action, target_agent_id, contact_ids, tag_ids } = body;

    const validActions = ['reassign', 'close', 'tag'];
    if (
      !validActions.includes(action) ||
      !Array.isArray(contact_ids) ||
      contact_ids.length === 0
    ) {
      return NextResponse.json(
        {
          error: `Invalid request. action must be one of: ${validActions.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // ----------------------------------------------------------------
    // reassign — bulk move conversations to a different agent
    // ----------------------------------------------------------------
    if (action === 'reassign') {
      if (!target_agent_id) {
        return NextResponse.json(
          { error: 'target_agent_id is required for reassign action' },
          { status: 400 }
        );
      }

      const { data: convs, error: convsError } = await supabase
        .from('conversations')
        .select('contact_id, assigned_agent_id')
        .eq('account_id', account.accountId)
        .in('contact_id', contact_ids);

      if (convsError) throw convsError;

      const { error: updateError } = await supabase
        .from('conversations')
        .update({ assigned_agent_id: target_agent_id })
        .eq('account_id', account.accountId)
        .in('contact_id', contact_ids);

      if (updateError) throw updateError;

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

      return NextResponse.json({
        success: true,
        updated: historyPayload.length,
      });
    }

    // ----------------------------------------------------------------
    // close — bulk resolve open conversations for the given contacts
    // ----------------------------------------------------------------
    if (action === 'close') {
      const { error: closeError, count } = await supabase
        .from('conversations')
        .update({ status: 'resolved' })
        .eq('account_id', account.accountId)
        .in('contact_id', contact_ids)
        .eq('status', 'open');

      if (closeError) throw closeError;

      return NextResponse.json({ success: true, updated: count ?? 0 });
    }

    // ----------------------------------------------------------------
    // tag — bulk add tags to contacts
    // ----------------------------------------------------------------
    if (action === 'tag') {
      if (!Array.isArray(tag_ids) || tag_ids.length === 0) {
        return NextResponse.json(
          { error: 'tag_ids array is required for tag action' },
          { status: 400 }
        );
      }

      // Scope-check: only tags owned by this account may be applied.
      const { data: validTags, error: tagVerifyErr } = await supabase
        .from('tags')
        .select('id')
        .eq('account_id', account.accountId)
        .in('id', tag_ids);

      if (tagVerifyErr) throw tagVerifyErr;

      const validTagIds = (validTags || []).map((t) => t.id);
      if (validTagIds.length === 0) {
        return NextResponse.json(
          { error: 'No valid tags found for this account' },
          { status: 400 }
        );
      }

      const tagRows = contact_ids.flatMap((contactId: string) =>
        validTagIds.map((tagId: string) => ({
          contact_id: contactId,
          tag_id: tagId,
        }))
      );

      const { error: tagErr } = await supabase
        .from('contact_tags')
        .upsert(tagRows, {
          onConflict: 'contact_id,tag_id',
          ignoreDuplicates: true,
        });

      if (tagErr) throw tagErr;

      return NextResponse.json({ success: true, updated: contact_ids.length });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
