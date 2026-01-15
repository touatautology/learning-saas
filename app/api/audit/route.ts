import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { auditLogs, users } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { requireRole } from '@/lib/auth/rbac';

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const entityType = url.searchParams.get('entityType');
  const entityId = url.searchParams.get('entityId');
  const action = url.searchParams.get('action');

  const filters = [];
  if (entityType) {
    filters.push(eq(auditLogs.entityType, entityType));
  }
  if (entityId) {
    filters.push(eq(auditLogs.entityId, entityId));
  }
  if (action) {
    filters.push(eq(auditLogs.action, action));
  }

  const baseQuery = db
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
    .leftJoin(users, eq(auditLogs.actorUserId, users.id));

  const results = await (filters.length
    ? baseQuery.where(and(...filters))
    : baseQuery
  )
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);

  return Response.json(results);
}
