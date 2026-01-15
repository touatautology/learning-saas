import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { AuditAction, runs } from '@/lib/db/schema';
import { getUser, logAuditEvent } from '@/lib/db/queries';
import { requireRole } from '@/lib/auth/rbac';

const approvalSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  rationale: z.string().min(3).max(500),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId: runIdParam } = await params;
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await requireRole(user, ['ADMIN'], {
      action: 'APPROVE_RUN',
      entityType: 'run',
      entityId: runIdParam,
    });
  } catch (error) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = approvalSchema.safeParse(payload);
  if (!parsed.success) {
    await logAuditEvent({
      actorUserId: user.id,
      actorRole: user.role,
      action: AuditAction.VALIDATION_FAILED,
      entityType: 'run',
      entityId: runIdParam,
      success: false,
      detailsJson: { issues: parsed.error.issues },
    });
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  const runId = Number(runIdParam);
  if (Number.isNaN(runId)) {
    return Response.json({ error: 'Invalid run id' }, { status: 400 });
  }

  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!run) {
    return Response.json({ error: 'Run not found' }, { status: 404 });
  }

  const newStatus = parsed.data.decision === 'approve' ? 'approved' : 'rejected';

  const [updated] = await db
    .update(runs)
    .set({
      status: newStatus,
      rationale: parsed.data.rationale,
    })
    .where(eq(runs.id, runId))
    .returning();

  await logAuditEvent({
    actorUserId: user.id,
    actorRole: user.role,
    action:
      parsed.data.decision === 'approve'
        ? AuditAction.APPROVE_RUN
        : AuditAction.REJECT_RUN,
    entityType: 'run',
    entityId: runId.toString(),
    environment: run.environment as 'staging' | 'prod',
    success: true,
  });

  return Response.json(updated);
}
