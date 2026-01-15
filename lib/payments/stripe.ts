import Stripe from 'stripe';
import { redirect } from 'next/navigation';
import { User } from '@/lib/db/schema';
import {
  createSubscriptionForUser,
  getSubscriptionByCustomerId,
  getSubscriptionForUser,
  getUser,
  logAuditEvent,
  updateSubscription,
} from '@/lib/db/queries';
import { AuditAction } from '@/lib/db/schema';

const stripeSecretKey =
  process.env.STRIPE_MODE === 'live'
    ? process.env.STRIPE_SECRET_KEY_LIVE
    : process.env.STRIPE_SECRET_KEY_TEST;

if (!stripeSecretKey) {
  throw new Error('Missing Stripe secret key for configured STRIPE_MODE.');
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-04-30.basil'
});

export async function createCheckoutSession({
  user,
  priceId,
}: {
  user: User | null;
  priceId: string;
}) {
  const authenticatedUser = user ?? (await getUser());

  if (!authenticatedUser) {
    redirect(`/sign-up?redirect=checkout&priceId=${priceId}`);
  }

  if (authenticatedUser.role === 'AGENT') {
    await logAuditEvent({
      actorUserId: authenticatedUser.id,
      actorRole: authenticatedUser.role,
      action: AuditAction.ACCESS_DENIED,
      entityType: 'stripe',
      environment: 'prod',
      success: false,
      detailsJson: { attemptedAction: 'CHECKOUT' },
    });
    throw new Error('AGENT_STRIPE_FORBIDDEN');
  }

  let subscription = await getSubscriptionForUser(authenticatedUser.id);
  if (!subscription) {
    subscription = await createSubscriptionForUser(
      authenticatedUser.id,
      process.env.STRIPE_MODE === 'live' ? 'live' : 'test'
    );
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],
    mode: 'subscription',
    success_url: `${process.env.BASE_URL}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.BASE_URL}/pricing`,
    customer: subscription.stripeCustomerId || undefined,
    customer_email: subscription.stripeCustomerId ? undefined : authenticatedUser.email,
    client_reference_id: authenticatedUser.id.toString(),
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: 14
    }
  });

  redirect(session.url!);
}

export async function createCustomerPortalSession(user: User) {
  if (user.role === 'AGENT') {
    await logAuditEvent({
      actorUserId: user.id,
      actorRole: user.role,
      action: AuditAction.ACCESS_DENIED,
      entityType: 'stripe',
      environment: 'prod',
      success: false,
      detailsJson: { attemptedAction: 'CUSTOMER_PORTAL' },
    });
    redirect('/dashboard');
  }

  const subscription = await getSubscriptionForUser(user.id);
  if (!subscription?.stripeCustomerId || !subscription.stripeProductId) {
    redirect('/pricing');
  }

  let configuration: Stripe.BillingPortal.Configuration;
  const configurations = await stripe.billingPortal.configurations.list();

  if (configurations.data.length > 0) {
    configuration = configurations.data[0];
  } else {
    const product = await stripe.products.retrieve(subscription.stripeProductId);
    if (!product.active) {
      throw new Error("Subscription's product is not active in Stripe");
    }

    const prices = await stripe.prices.list({
      product: product.id,
      active: true
    });
    if (prices.data.length === 0) {
      throw new Error("No active prices found for the subscription's product");
    }

    configuration = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: 'Manage your subscription'
      },
      features: {
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price', 'quantity', 'promotion_code'],
          proration_behavior: 'create_prorations',
          products: [
            {
              product: product.id,
              prices: prices.data.map((price) => price.id)
            }
          ]
        },
        subscription_cancel: {
          enabled: true,
          mode: 'at_period_end',
          cancellation_reason: {
            enabled: true,
            options: [
              'too_expensive',
              'missing_features',
              'switched_service',
              'unused',
              'other'
            ]
          }
        },
        payment_method_update: {
          enabled: true
        }
      }
    });
  }

  return stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${process.env.BASE_URL}/dashboard`,
    configuration: configuration.id
  });
}

export async function handleSubscriptionChange(
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  const status = subscription.status;

  const existing = await getSubscriptionByCustomerId(customerId);

  if (!existing) {
    console.error('Subscription not found for Stripe customer:', customerId);
    return;
  }

  if (status === 'active' || status === 'trialing') {
    const plan = subscription.items.data[0]?.plan;
    await updateSubscription(existing.id, {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripeProductId: plan?.product as string,
      planName: (plan?.product as Stripe.Product).name,
      status,
      mode: process.env.STRIPE_MODE === 'live' ? 'live' : 'test',
    });
  } else if (status === 'canceled' || status === 'unpaid') {
    await updateSubscription(existing.id, {
      stripeCustomerId: customerId,
      stripeSubscriptionId: null,
      stripeProductId: null,
      planName: null,
      status,
      mode: process.env.STRIPE_MODE === 'live' ? 'live' : 'test',
    });
  }
}

export async function getStripePrices() {
  if (process.env.SKIP_STRIPE_FETCH === 'true') {
    return [];
  }

  const prices = await stripe.prices.list({
    expand: ['data.product'],
    active: true,
    type: 'recurring'
  });

  return prices.data.map((price) => ({
    id: price.id,
    productId:
      typeof price.product === 'string' ? price.product : price.product.id,
    unitAmount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring?.interval,
    trialPeriodDays: price.recurring?.trial_period_days
  }));
}

export async function getStripeProducts() {
  if (process.env.SKIP_STRIPE_FETCH === 'true') {
    return [];
  }

  const products = await stripe.products.list({
    active: true,
    expand: ['data.default_price']
  });

  return products.data.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    defaultPriceId:
      typeof product.default_price === 'string'
        ? product.default_price
        : product.default_price?.id
  }));
}
