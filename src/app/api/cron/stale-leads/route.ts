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
    // Logic: for each account, find contacts where the latest deal stage is New or Contacted
    // and deals.updated_at < now() - interval '48 hours'
    // and conversations.assigned_agent_id IS NOT NULL.

    // Actually, joining all these is easier in SQL or using supabase JS eq.
    // Let's do a direct Supabase query. We can query deals that are stale.
    const fortyEightHoursAgo = new Date(
      Date.now() - 48 * 60 * 60 * 1000
    ).toISOString();

    // We need to fetch deals where updated_at < 48 hours ago, stage is New or Contacted.
    // We also need conversations to check assigned_agent_id.
    const { data: staleDeals, error: dealsErr } = await db
      .from('deals')
      .select(
        '*, stage:pipeline_stages(name), contact:contacts(id, name, conversations!inner(assigned_agent_id))'
      )
      .lt('updated_at', fortyEightHoursAgo)
      .in('stage.name', ['New', 'Contacted'])
      .not('contact.conversations', 'is', null);

    if (dealsErr) {
      console.error('[cron/stale-leads] Failed to fetch deals', dealsErr);
      return NextResponse.json({ error: dealsErr.message }, { status: 500 });
    }

    if (!staleDeals) {
      return NextResponse.json({ processed: 0, stale: 0 });
    }

    processed = staleDeals.length;

    for (const deal of staleDeals) {
      // Check if conversation assigned
      const conversations = Array.isArray(deal.contact?.conversations)
        ? deal.contact?.conversations
        : [deal.contact?.conversations];
      const conversation = conversations.find((c: { assigned_agent_id?: string | null }) => c?.assigned_agent_id);

      if (conversation?.assigned_agent_id) {
        stale++;
        const agentId = conversation.assigned_agent_id;
        const contactName = deal.contact?.name || 'Unknown Contact';

        // (a) create a task
        // TODO(SectionP): implement task creation
        // await db.from('tasks').insert({ ... })

        // (b) send a push notification
        // Just an insert to notifications table for now, since web push might not be fully available to call server-side here.
        await db.from('notifications').insert({
          account_id: deal.account_id,
          user_id: agentId,
          type: 'conversation_assigned', // Reusing existing type as fallback if no stale_lead type
          contact_id: deal.contact_id,
          title: `Follow up: ${contactName} — no activity for 2+ days`,
          body: `Deal: ${deal.title}`,
        });

        // Notify all admins in the account
        const { data: admins } = await db
          .from('profiles')
          .select('user_id')
          .eq('account_id', deal.account_id)
          .eq('account_role', 'admin');

        if (admins) {
          for (const admin of admins) {
            await db.from('notifications').insert({
              account_id: deal.account_id,
              user_id: admin.user_id,
              type: 'conversation_assigned',
              contact_id: deal.contact_id,
              title: `Stale Lead Alert: ${contactName} assigned to ${agentId}`,
              body: `No activity for 2+ days`,
            });
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
