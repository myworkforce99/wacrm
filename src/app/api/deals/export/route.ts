import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { createClient } from '@/lib/supabase/server';
import { hasMinRole } from '@/lib/auth/roles';

export async function GET() {
  try {
    const account = await getCurrentAccount();
    if (!account) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasMinRole(account.role, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await createClient();
    const { data: deals, error } = await supabase
      .from('deals')
      .select(`
        id,
        title,
        value,
        currency,
        status,
        expected_close_date,
        pipeline_stages ( name ),
        contacts ( name, email, phone )
      `)
      .eq('account_id', account.accountId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const csvRows = ['ID,Title,Value,Currency,Status,Stage,Expected Close,Contact Name,Contact Email,Contact Phone'];

    for (const deal of (deals || [])) {
      const stage = Array.isArray(deal.pipeline_stages)
        ? deal.pipeline_stages[0]?.name
        : (deal.pipeline_stages as Record<string, unknown> | null)?.name;
      const contact = Array.isArray(deal.contacts)
        ? deal.contacts[0]
        : (deal.contacts as Record<string, unknown> | null);

      csvRows.push([
        deal.id,
        `"${deal.title?.replace(/"/g, '""') || ''}"`,
        deal.value || 0,
        deal.currency || '',
        deal.status || '',
        `"${stage?.replace(/"/g, '""') || ''}"`,
        deal.expected_close_date || '',
        `"${contact?.name?.replace(/"/g, '""') || ''}"`,
        `"${contact?.email?.replace(/"/g, '""') || ''}"`,
        `"${contact?.phone?.replace(/"/g, '""') || ''}"`
      ].join(','));
    }

    const csvString = csvRows.join('\n');

    return new NextResponse(csvString, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="deals_export.csv"',
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to export deals' }, { status: 500 });
  }
}
