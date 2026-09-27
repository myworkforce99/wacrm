import { NextResponse } from 'next/server';
import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/automations/admin-client';

export async function GET(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const url = new URL(request.url);
    const unassigned = url.searchParams.get('unassigned') === 'true';

    let query = ctx.supabase
      .from('contacts')
      .select('*, conversations(status, assigned_agent_id)')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false });

    if (unassigned) {
      // Supabase direct filter for nested array can be tricky.
      // We will fetch and filter in memory, or use a better query.
      // Better to fetch up to 100 recent and filter, or use an inner join.
      query = ctx.supabase
        .from('contacts')
        .select('*, conversations(status, assigned_agent_id), lead_details(source)')
        .eq('account_id', ctx.accountId)
        .order('created_at', { ascending: false })
        .limit(200);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[GET /api/contacts] error:', error);
      return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
    }

    let results = data;
    if (unassigned) {
      results = data.filter((c: { conversations?: { status?: string, assigned_agent_id?: string | null } | { status?: string, assigned_agent_id?: string | null }[] }) => {
        const convs = Array.isArray(c.conversations) ? c.conversations : (c.conversations ? [c.conversations] : []);
        const openConv = convs.find((conv) => conv.status === 'open');
        return !openConv || openConv.assigned_agent_id === null;
      });
    }

    return NextResponse.json({ contacts: results });
  } catch (err) {
    return toErrorResponse(err);
  }
}
