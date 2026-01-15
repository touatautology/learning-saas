import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { auditLogs, users } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { requireRole } from '@/lib/auth/rbac';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await requireRole(user, ['ADMIN'], {
      action: 'LIST_AUDIT_LOGS',
      entityType: 'audit_log',
    });
  } catch (error) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const results = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      createdAt: auditLogs.createdAt,
      actorRole: auditLogs.actorRole,
      actorUserId: auditLogs.actorUserId,
      environment: auditLogs.environment,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      success: auditLogs.success,
      ipAddress: auditLogs.ipAddress,
      actorName: users.name,
      actorEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);

  return Response.json(results);
}
