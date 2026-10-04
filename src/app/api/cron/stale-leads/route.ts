import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/automations/admin-client';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = supabaseAdmin();
  let processed = 0;
  let stale = 0;

  try {
    const fortyEightHoursAgo = new Date(
      Date.now() - 48 * 60 * 60 * 1000
    ).toISOString();

    // Step 1: Resolve stage IDs for 'New' and 'Contacted'.
    // Cannot use .in('stage.name', ...) on a joined column — PostgREST
    // ignores that filter silently (audit QUALITY-01). Filter on the
    // scalar stage_id FK instead.
    const { data: earlyStages, error: stageErr } = await db
      .from('pipeline_stages')
      .select('id')
      .in('name', ['New', 'Contacted']);

    if (stageErr) {
      console.error('[cron/stale-leads] Failed to fetch stage ids', stageErr);
      return NextResponse.json({ error: stageErr.message }, { status: 500 });
    }

    const earlyStageIds = (earlyStages || []).map((s: { id: string }) => s.id);
    if (earlyStageIds.length === 0) {
      return NextResponse.json({ processed: 0, stale: 0 });
    }

    // Step 2: Fetch deals in early stages not updated in 48h.
    // Include deals.assigned_to so we can escalate even when no
    // WhatsApp conversation exists yet (manually-added leads).
    // Join the assignee profile to resolve profiles.id → user_id,
    // since tasks.assigned_to and notifications.user_id expect user_id.
    const { data: staleDeals, error: dealsErr } = await db
      .from('deals')
      .select(
        'id, title, account_id, contact_id, stage_id, assigned_to, assignee:profiles!deals_assigned_to_fkey(user_id), contact:contacts(id, name, conversations(assigned_agent_id))'
      )
      .lt('updated_at', fortyEightHoursAgo)
      .in('stage_id', earlyStageIds);

    if (dealsErr) {
      console.error('[cron/stale-leads] Failed to fetch deals', dealsErr);
      return NextResponse.json({ error: dealsErr.message }, { status: 500 });
    }

    if (!staleDeals || staleDeals.length === 0) {
      return NextResponse.json({ processed: 0, stale: 0 });
    }

    processed = staleDeals.length;

    for (const deal of staleDeals) {
      const contactObj = Array.isArray(deal.contact)
        ? deal.contact[0]
        : deal.contact;

      // Resolve user_id from the joined profile (deals.assigned_to is profiles.id).
      // tasks.assigned_to and notifications.user_id both require user_id.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dealAssignee = (deal as any).assignee;
      const dealAgentUserId: string | null = Array.isArray(dealAssignee)
        ? dealAssignee[0]?.user_id ?? null
        : dealAssignee?.user_id ?? null;

      // Fall back to conversation assignee (already user_id) for legacy data
      const conversations = Array.isArray(contactObj?.conversations)
        ? contactObj?.conversations
        : [contactObj?.conversations];
      const convAgentId = conversations.find(
        (c: { assigned_agent_id?: string | null }) => c?.assigned_agent_id
      )?.assigned_agent_id;
      const agentId = dealAgentUserId ?? convAgentId ?? null;

      if (agentId) {
        stale++;
        const contactName = contactObj?.name || 'Unknown Contact';

        // (a) Create a follow-up task.
        const { error: taskErr } = await db.from('tasks').insert({
          account_id: deal.account_id,
          contact_id: deal.contact_id,
          title: `Follow up: ${contactName} — no activity for 2+ days`,
          due_at: new Date().toISOString(),
          assigned_to: agentId,
          created_by: agentId,
        });
        if (taskErr) {
          console.error(
            '[cron/stale-leads] task insert failed:',
            taskErr.message
          );
        }

        // (b) Notify the assigned agent.
        await db.from('notifications').insert({
          account_id: deal.account_id,
          user_id: agentId,
          type: 'conversation_assigned',
          contact_id: deal.contact_id,
          title: `Follow up: ${contactName} — no activity for 2+ days`,
          body: `Deal: ${deal.title}`,
        });

        // (c) Notify admins (deduplicated — skip if admin is the agent).
        const { data: admins } = await db
          .from('profiles')
          .select('user_id')
          .eq('account_id', deal.account_id)
          .eq('account_role', 'admin');

        if (admins) {
          const adminNotifs = admins
            .filter((a: { user_id: string }) => a.user_id !== agentId)
            .map((a: { user_id: string }) => ({
              account_id: deal.account_id,
              user_id: a.user_id,
              type: 'conversation_assigned' as const,
              contact_id: deal.contact_id,
              title: `Stale Lead Alert: ${contactName}`,
              body: `No activity for 2+ days. Deal: ${deal.title}`,
            }));
          if (adminNotifs.length > 0) {
            await db.from('notifications').insert(adminNotifs);
          }
        }
      }
    }

    return NextResponse.json({ processed, stale });
  } catch (error) {
    console.error('[cron/stale-leads] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
