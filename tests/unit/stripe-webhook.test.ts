import test from 'node:test';
import assert from 'node:assert/strict';

process.env.STRIPE_MODE = 'test';
process.env.STRIPE_SECRET_KEY_TEST = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET_TEST = 'whsec_testsecret';

import { stripe } from '@/lib/payments/stripe';

test('stripe webhook signature verification rejects invalid signature', async () => {
  const payload = JSON.stringify({ id: 'evt_test', type: 'customer.subscription.updated' });
  const secret = process.env.STRIPE_WEBHOOK_SECRET_TEST as string;

  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });

  assert.doesNotThrow(() => {
    stripe.webhooks.constructEvent(payload, header, secret);
  });

  assert.throws(() => {
    stripe.webhooks.constructEvent(payload, header, 'whsec_invalid');
  });
});
