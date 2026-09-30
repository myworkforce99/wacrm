import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import Stripe from 'stripe';

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

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const plan_tier = body.plan_tier;
  if (!['starter', 'growth', 'pro'].includes(plan_tier)) {
    return NextResponse.json({ error: 'Invalid plan_tier' }, { status: 400 });
  }

  let priceId = '';
  if (plan_tier === 'starter')
    priceId = process.env.STRIPE_STARTER_PRICE_ID || '';
  if (plan_tier === 'growth')
    priceId = process.env.STRIPE_GROWTH_PRICE_ID || '';
  if (plan_tier === 'pro') priceId = process.env.STRIPE_PRO_PRICE_ID || '';

  if (!priceId) {
    return NextResponse.json(
      { error: 'Price ID not configured' },
      { status: 500 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      client_reference_id: ctx.accountId,
      metadata: {
        plan_tier,
      },
      success_url: `${baseUrl}/settings?billing=success`,
      cancel_url: `${baseUrl}/settings`,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    console.error('[billing/checkout] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
