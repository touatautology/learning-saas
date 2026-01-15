import { desc, and, eq, isNull } from 'drizzle-orm';
import { db } from './drizzle';
import {
  auditLogs,
  subscriptions,
  users,
  type NewAuditLog,
} from './schema';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';

export async function getUser() {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  const sessionData = await verifyToken(sessionCookie.value);
  if (
    !sessionData ||
    !sessionData.user ||
    typeof sessionData.user.id !== 'number'
  ) {
    return null;
  }

  if (new Date(sessionData.expires) < new Date()) {
    return null;
  }

  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, sessionData.user.id), isNull(users.deletedAt)))
    .limit(1);

  if (user.length === 0) {
    return null;
  }

  return user[0];
}

export async function getSubscriptionForUser(userId: number) {
  const result = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getSubscriptionByCustomerId(customerId: string) {
  const result = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customerId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function updateSubscription(
  subscriptionId: number,
  subscriptionData: {
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    status: string;
    mode: 'test' | 'live';
  }
) {
  await db
    .update(subscriptions)
    .set({
      ...subscriptionData,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscriptionId));
}

export async function createSubscriptionForUser(userId: number, mode: 'test' | 'live') {
  const [created] = await db
    .insert(subscriptions)
    .values({
      userId,
      mode,
    })
    .returning();
  return created;
}

export async function getAuditLogsForUser(userId: number) {
  return await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      createdAt: auditLogs.createdAt,
      ipAddress: auditLogs.ipAddress,
      actorRole: auditLogs.actorRole,
    })
    .from(auditLogs)
    .where(eq(auditLogs.actorUserId, userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(20);
}

export async function logAuditEvent(entry: NewAuditLog) {
  await db.insert(auditLogs).values(entry);
}
