import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { canConnectSocialAccount } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { role, accountId } = await getCurrentAccount();
    if (!canConnectSocialAccount(role)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 });
    }

    const db = await createClient();
    const { error } = await db
      .from('social_accounts')
      .update({ is_active: false })
      .eq('id', id)
      .eq('account_id', accountId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
