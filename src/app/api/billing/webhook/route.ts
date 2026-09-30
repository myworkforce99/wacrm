import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/automations/admin-client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-08-26.dahlia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error(
      '[billing/webhook] signature verification failed:',
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const accountId = session.client_reference_id;

        if (!accountId) {
          console.error(
            '[billing/webhook] Missing client_reference_id in session',
            session.id
          );
          break;
        }

        const plan_tier = session.metadata?.plan_tier || 'starter';

        // Expand the subscription to get the period end
        let current_period_end: Date | null = null;
        if (session.subscription) {
          const subscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id;
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          current_period_end = new Date(subscription.current_period_end * 1000);
        }

        const { error } = await supabase
          .from('accounts')
          .update({
            subscription_status: 'active',
            stripe_customer_id:
              typeof session.customer === 'string'
                ? session.customer
                : session.customer?.id,
            stripe_subscription_id:
              typeof session.subscription === 'string'
                ? session.subscription
                : session.subscription?.id,
            plan_tier: plan_tier,
            ...(current_period_end && {
              current_period_end: current_period_end.toISOString(),
            }),
          })
          .eq('id', accountId);

        if (error) {
          console.error(
            '[billing/webhook] Database update error:',
            error.message
          );
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const sub = invoice.subscription;
        const subscriptionId =
          typeof sub === 'string'
            ? sub
            : typeof sub === 'object' && sub
              ? sub.id
              : null;

        if (!subscriptionId) break;

        const periodEnd = invoice.lines.data[0]?.period?.end;
        if (!periodEnd) break;

        const { error } = await supabase
          .from('accounts')
          .update({
            current_period_end: new Date(periodEnd * 1000).toISOString(),
            subscription_status: 'active',
          })
          .eq('stripe_subscription_id', subscriptionId);

        if (error) {
          console.error(
            '[billing/webhook] Database update error (payment_succeeded):',
            error.message
          );
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const sub = invoice.subscription;
        const subscriptionId =
          typeof sub === 'string'
            ? sub
            : typeof sub === 'object' && sub
              ? sub.id
              : null;

        if (!subscriptionId) break;

        const { error } = await supabase
          .from('accounts')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_subscription_id', subscriptionId);

        if (error)
          console.error(
            '[billing/webhook] DB error (payment_failed):',
            error.message
          );
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const { error } = await supabase
          .from('accounts')
          .update({ subscription_status: 'canceled' })
          .eq('stripe_subscription_id', subscription.id);

        if (error)
          console.error('[billing/webhook] DB error (deleted):', error.message);
        break;
      }

      case 'customer.subscription.paused': {
        const subscription = event.data.object as Stripe.Subscription;
        const { error } = await supabase
          .from('accounts')
          .update({ subscription_status: 'paused' })
          .eq('stripe_subscription_id', subscription.id);

        if (error)
          console.error('[billing/webhook] DB error (paused):', error.message);
        break;
      }

      default:
        console.log('[billing/webhook] unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[billing/webhook] processing error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
