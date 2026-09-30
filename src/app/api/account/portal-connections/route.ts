import { NextResponse } from 'next/server';
import {
  requireRole,
  getCurrentAccount,
  toErrorResponse,
} from '@/lib/auth/account';

export async function GET() {
  try {
    const ctx = await getCurrentAccount();

    // Check if INBOUND_EMAIL_DOMAIN is set, fallback to a dummy if not in dev
    const domain = process.env.INBOUND_EMAIL_DOMAIN || 'capture.example.com';
    const capture_email = `leads+${ctx.accountId.slice(0, 8)}@${domain}`;

    return NextResponse.json({
      portal_connections: ctx.account.portal_connections || {},
      capture_email,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRole('admin');

    const body = (await request.json().catch(() => null)) as {
      portal?: string;
      connected?: boolean;
    } | null;

    if (
      !body ||
      typeof body.portal !== 'string' ||
      typeof body.connected !== 'boolean'
    ) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const { portal, connected } = body;
    const currentConnections = ctx.account.portal_connections || {};

    const updatedConnections = {
      ...currentConnections,
      [portal]: {
        ...currentConnections[portal],
        connected,
        connected_at: new Date().toISOString(),
      },
    };

    const { data, error } = await ctx.supabase
      .from('accounts')
      .update({ portal_connections: updatedConnections })
      .eq('id', ctx.accountId)
      .select('portal_connections')
      .single();

    if (error) {
      console.error(
        '[PATCH /api/account/portal-connections] update error:',
        error
      );
      return NextResponse.json(
        { error: 'Failed to update portal connections' },
        { status: 500 }
      );
    }

    return NextResponse.json({ portal_connections: data.portal_connections });
  } catch (err) {
    return toErrorResponse(err);
  }
}
