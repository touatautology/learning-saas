import Stripe from 'stripe';
import { handleSubscriptionChange, stripe } from '@/lib/payments/stripe';
import { NextRequest, NextResponse } from 'next/server';
import { logAuditEvent } from '@/lib/db/queries';
import { AuditAction } from '@/lib/db/schema';

const webhookSecret =
  process.env.STRIPE_MODE === 'live'
    ? process.env.STRIPE_WEBHOOK_SECRET_LIVE
    : process.env.STRIPE_WEBHOOK_SECRET_TEST;

if (!webhookSecret) {
  throw new Error('Missing Stripe webhook secret for configured STRIPE_MODE.');
}
const webhookSecretValue = webhookSecret;

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecretValue
    );
  } catch (err) {
    console.error('Webhook signature verification failed.', err);
    await logAuditEvent({
      action: AuditAction.STRIPE_WEBHOOK_FAILURE,
      entityType: 'stripe',
      environment: 'prod',
      success: false,
      detailsJson: {
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    });
    return NextResponse.json(
      { error: 'Webhook signature verification failed.' },
      { status: 400 }
    );
  }

  switch (event.type) {
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionChange(subscription);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
