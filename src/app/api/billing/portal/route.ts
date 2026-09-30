import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/automations/admin-client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-08-26.dahlia',
});

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireRole('owner');
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const { data: account, error } = await ctx.supabase
      .from('accounts')
      .select('stripe_customer_id')
      .eq('id', ctx.accountId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!account || !account.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No active subscription found.' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const session = await stripe.billingPortal.sessions.create({
      customer: account.stripe_customer_id,
      return_url: `${baseUrl}/settings`,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error('[billing/portal] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
