import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { startOfDay, subDays } from 'date-fns';
import { formatINR as formatINRCurrency } from '@/lib/currency';

function formatINR(value: number | null | undefined): string {
  if (value == null) return '₹0';
  return formatINRCurrency(value);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const authHeader = request.headers.get('authorization');
    const token =
      authHeader?.split('Bearer ')[1] || url.searchParams.get('token');

    if (
      token !== process.env.CRON_SECRET &&
      process.env.NODE_ENV !== 'development'
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = supabaseAdmin();

    const { data: accounts, error: accErr } = await admin
      .from('accounts')
      .select('id, name')
      .in('subscription_status', ['active', 'trialing']);

    if (accErr) {
      console.error('[cron/weekly-report] fetch accounts error:', accErr);
      return NextResponse.json({ error: accErr.message }, { status: 500 });
    }

    const now = new Date();
    const sevenDaysAgo = startOfDay(subDays(now, 7)).toISOString();
    const fourteenDaysAgo = startOfDay(subDays(now, 14)).toISOString();
    const todayStr = startOfDay(now).toISOString();

    const reports = [];

    for (const account of accounts || []) {
      // 1. New Leads
      const { count: newLeadsThisWeek } = await admin
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', account.id)
        .gte('created_at', sevenDaysAgo);

      const { count: newLeadsLastWeek } = await admin
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', account.id)
        .gte('created_at', fourteenDaysAgo)
        .lt('created_at', sevenDaysAgo);

      // 2. Site Visits
      const { data: visits } = await admin
        .from('site_visits')
        .select('status, created_at, scheduled_at, contact_id')
        .eq('account_id', account.id)
        .gte('updated_at', sevenDaysAgo);

      const scheduledVisits =
        visits?.filter(
          (v) => v.status === 'pending' || v.status === 'confirmed'
        ).length || 0;
      const completedVisits =
        visits?.filter((v) => v.status === 'completed').length || 0;
      const noShowVisits =
        visits?.filter((v) => v.status === 'no_show').length || 0;

      // 3. Deals Closed
      const { data: closedDeals } = await admin
        .from('deals')
        .select('value')
        .eq('status', 'won')
        .eq('account_id', account.id)
        .gte('updated_at', sevenDaysAgo);

      const dealsCount = closedDeals?.length || 0;
      const dealsValue =
        closedDeals?.reduce((sum, d) => sum + (d.value || 0), 0) || 0;

      // 4. Top Agent
      let topAgentName = 'None';
      const completedVisitContacts =
        visits
          ?.filter((v) => v.status === 'completed' && v.contact_id)
          .map((v) => v.contact_id as string) || [];
      if (completedVisitContacts.length > 0) {
        const { data: convs } = await admin
          .from('conversations')
          .select('contact_id, assigned_agent_id')
          .in('contact_id', completedVisitContacts)
          .not('assigned_agent_id', 'is', null);

        if (convs && convs.length > 0) {
          const contactToAgent = new Map<string, string>();
          convs.forEach((c) => {
            if (c.assigned_agent_id) contactToAgent.set(c.contact_id, c.assigned_agent_id);
          });
          
          const counts: Record<string, number> = {};
          completedVisitContacts.forEach((cid) => {
            const agentId = contactToAgent.get(cid);
            if (agentId) {
              counts[agentId] = (counts[agentId] || 0) + 1;
            }
          });

          const sortedAgents = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
          const topAgentId = sortedAgents.length > 0 ? sortedAgents[0] : null;
          
          if (topAgentId) {
            const { data: prof } = await admin
              .from('profiles')
              .select('full_name')
              .eq('user_id', topAgentId)
              .single();
            if (prof) topAgentName = prof.full_name;
          }
        }
      }

      // 5. Stale Leads
      const { count: overdueTasks } = await admin
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', account.id)
        .eq('done', false)
        .lt('due_at', todayStr);

      const { count: overdueConvs } = await admin
        .from('conversations')
        .select('id, contacts!inner(account_id)', {
          count: 'exact',
          head: true,
        })
        .eq('contacts.account_id', account.id)
        .not('first_unanswered_at', 'is', null)
        .lt(
          'first_unanswered_at',
          new Date(Date.now() - 30 * 60000).toISOString()
        );

      const staleLeadsCount = (overdueTasks || 0) + (overdueConvs || 0);

      const report = {
        accountId: account.id,
        accountName: account.name,
        date: todayStr,
        newLeadsThisWeek: newLeadsThisWeek || 0,
        newLeadsLastWeek: newLeadsLastWeek || 0,
        scheduledVisits,
        completedVisits,
        noShowVisits,
        dealsCount,
        dealsValueFormatted: formatINR(dealsValue),
        topAgentName,
        staleLeadsCount,
      };

      reports.push(report);

      console.log(
        `[weekly-report] Sending to account ${account.name}:`,
        JSON.stringify(report, null, 2)
      );
    }

    return NextResponse.json({ success: true, processed: reports.length });
  } catch (err) {
    console.error('[cron/weekly-report] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
