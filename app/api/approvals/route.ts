import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { runs } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { requireRole } from '@/lib/auth/rbac';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await requireRole(user, ['ADMIN'], {
      action: 'LIST_APPROVALS',
      entityType: 'run',
    });
  } catch (error) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const results = await db
    .select()
    .from(runs)
    .where(and(eq(runs.status, 'proposed')))
    .orderBy(desc(runs.createdAt));

  return Response.json(results);
}
