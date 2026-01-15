import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { subscriptions, users } from '@/lib/db/schema';
import { createSubscriptionForUser, updateSubscription } from '@/lib/db/queries';

const payloadSchema = z.object({
  email: z.string().email(),
  status: z.enum(['active', 'trialing', 'canceled', 'unpaid']),
});

export async function POST(request: Request) {
  if (process.env.ENABLE_TEST_ENDPOINTS !== 'true') {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const payload = await request.json();
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  let subscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, user.id))
    .limit(1);

  if (!subscription.length) {
    const created = await createSubscriptionForUser(
      user.id,
      process.env.STRIPE_MODE === 'live' ? 'live' : 'test'
    );
    subscription = [created];
  }

  await updateSubscription(subscription[0].id, {
    stripeCustomerId: subscription[0].stripeCustomerId,
    stripeSubscriptionId: subscription[0].stripeSubscriptionId,
    stripeProductId: subscription[0].stripeProductId,
    planName: subscription[0].planName,
    status: parsed.data.status,
    mode: process.env.STRIPE_MODE === 'live' ? 'live' : 'test',
  });

  return Response.json({ ok: true });
}
