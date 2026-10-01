import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

import { formatINR as formatINRCurrency } from '@/lib/currency';

function formatINR(value: number | null | undefined): string {
  if (value == null) return '';
  return formatINRCurrency(value);
}

function escapeCSV(val: string | null | undefined): string {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = any;

export async function GET(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const agentId = url.searchParams.get('agent_id');

    let query = ctx.supabase
      .from('contacts')
      .select(
        `
        id, name, phone, created_at,
        lead_details ( source, budget_max, location_preference, configuration_preference ),
        conversations ( id, status, assigned_agent_id, last_message_at, updated_at ),
        deals ( status, stage:pipeline_stages(name) ),
        site_visits ( status, property:properties(rera_id) )
      `
      )
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false });

    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    let allData: AnyRecord[] = [];
    let page = 0;
    const limit = 1000;

    while (true) {
      const { data, error } = await query.range(
        page * limit,
        (page + 1) * limit - 1
      );

      if (error) {
        console.error('[GET /api/contacts/export] error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch contacts for export' },
          { status: 500 }
        );
      }

      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < limit) break;
      page++;
    }

    const agentIds = new Set<string>();
    allData.forEach((c: AnyRecord) => {
      const convs = Array.isArray(c.conversations)
        ? c.conversations
        : c.conversations
          ? [c.conversations]
          : [];
      const activeConv =
        convs.find(
          (cv: AnyRecord) => cv.status === 'open' || cv.status === 'pending'
        ) || convs[0];
      if (activeConv?.assigned_agent_id) {
        agentIds.add(activeConv.assigned_agent_id);
      }
    });

    const profilesMap: Record<string, string> = {};
    if (agentIds.size > 0) {
      const { data: profiles } = await ctx.supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', Array.from(agentIds));
      if (profiles) {
        profiles.forEach((p) => {
          profilesMap[p.user_id] = p.full_name;
        });
      }
    }

    let filteredData = allData;
    if (agentId) {
      filteredData = allData.filter((c: AnyRecord) => {
        const convs = Array.isArray(c.conversations)
          ? c.conversations
          : c.conversations
            ? [c.conversations]
            : [];
        const activeConv =
          convs.find(
            (cv: AnyRecord) => cv.status === 'open' || cv.status === 'pending'
          ) || convs[0];
        return activeConv?.assigned_agent_id === agentId;
      });
    }

    const csvRows = [];
    csvRows.push(
      [
        'Lead Name',
        'Mobile',
        'Source',
        'Stage',
        'Assigned Agent',
        'Budget (INR)',
        'Location',
        'BHK Config',
        'RERA Property',
        'Visits Completed',
        'Last Activity',
        'Created At',
      ].join(',')
    );

    filteredData.forEach((c: AnyRecord) => {
      const ld = Array.isArray(c.lead_details)
        ? c.lead_details[0]
        : c.lead_details;

      const convs = Array.isArray(c.conversations)
        ? c.conversations
        : c.conversations
          ? [c.conversations]
          : [];
      const activeConv =
        convs.find(
          (cv: AnyRecord) => cv.status === 'open' || cv.status === 'pending'
        ) || convs[0];

      const deals = Array.isArray(c.deals) ? c.deals : c.deals ? [c.deals] : [];
      const openDeal =
        deals.find((d: AnyRecord) => d.status === 'open') || deals[0];

      const visits = Array.isArray(c.site_visits)
        ? c.site_visits
        : c.site_visits
          ? [c.site_visits]
          : [];
      const completedVisits = visits.filter(
        (v: AnyRecord) => v.status === 'completed'
      );

      const reraIds = Array.from(
        new Set(
          visits.map((v: AnyRecord) => v.property?.rera_id).filter(Boolean)
        )
      );

      const name = c.name || '';
      const mobile = c.phone || '';
      const source = ld?.source || '';
      const stage = openDeal?.stage?.name || '';
      const assignedAgent = activeConv?.assigned_agent_id
        ? profilesMap[activeConv.assigned_agent_id] || 'Unknown'
        : '';
      const budget = ld?.budget_max != null ? formatINR(ld.budget_max) : '';
      const location = ld?.location_preference || '';
      const bhkConfig = Array.isArray(ld?.configuration_preference)
        ? ld.configuration_preference.join(', ')
        : '';
      const reraProperty = reraIds.join(', ');
      const visitsCompleted = completedVisits.length.toString();
      const lastActivity =
        activeConv?.last_message_at || activeConv?.updated_at || '';
      const createdAt = c.created_at || '';

      csvRows.push(
        [
          escapeCSV(name),
          escapeCSV(mobile),
          escapeCSV(source),
          escapeCSV(stage),
          escapeCSV(assignedAgent),
          escapeCSV(budget),
          escapeCSV(location),
          escapeCSV(bhkConfig),
          escapeCSV(reraProperty),
          escapeCSV(visitsCompleted),
          escapeCSV(lastActivity),
          escapeCSV(createdAt),
        ].join(',')
      );
    });

    return new NextResponse(csvRows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="contacts_export.csv"',
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
