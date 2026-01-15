import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  AuditAction,
  learningModules,
  runs,
} from '@/lib/db/schema';
import { getUser, logAuditEvent } from '@/lib/db/queries';
import { buildModuleDiff } from '@/lib/modules/diff';
import { buildEvaluationResult } from '@/lib/runs/evaluation';
import { requireRole } from '@/lib/auth/rbac';

const promoteSchema = z.object({
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
      action: 'PROMOTE_RUN',
      entityType: 'run',
      entityId: runIdParam,
    });
  } catch (error) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = promoteSchema.safeParse(payload);
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

  if (run.status !== 'approved') {
    return Response.json({ error: 'Run is not approved' }, { status: 409 });
  }

  const moduleIds = Array.isArray(run.changedEntityIdsJson)
    ? run.changedEntityIdsJson.map((id) => Number(id)).filter((id) => !Number.isNaN(id))
    : [];
  if (moduleIds.length === 0) {
    return Response.json({ error: 'No modules to promote' }, { status: 400 });
  }

  const updatedModules = [];
  for (const moduleId of moduleIds) {
    const [stagingModule] = await db
      .select()
      .from(learningModules)
      .where(eq(learningModules.id, Number(moduleId)))
      .limit(1);

    if (!stagingModule || stagingModule.environment !== 'staging') {
      continue;
    }

    const [existingProd] = await db
      .select()
      .from(learningModules)
      .where(
        and(
          eq(learningModules.sourceModuleId, stagingModule.sourceModuleId),
          eq(learningModules.environment, 'prod')
        )
      )
      .limit(1);

    if (existingProd && existingProd.environment === 'prod') {
      const [updated] = await db
        .update(learningModules)
        .set({
          summary: stagingModule.summary,
          bodyMarkdown: stagingModule.bodyMarkdown,
          checklistJson: stagingModule.checklistJson,
          status: 'published',
          environment: 'prod',
          updatedAt: new Date(),
        })
        .where(eq(learningModules.id, existingProd.id))
        .returning();
      updatedModules.push(updated);
      continue;
    }

    const [created] = await db
      .insert(learningModules)
      .values({
        sourceModuleId: stagingModule.sourceModuleId,
        title: stagingModule.title,
        summary: stagingModule.summary,
        bodyMarkdown: stagingModule.bodyMarkdown,
        checklistJson: stagingModule.checklistJson,
        status: 'published',
        environment: 'prod',
      })
      .returning();
    updatedModules.push(created);
  }

  const [promotedRun] = await db
    .update(runs)
    .set({ status: 'promoted', rationale: parsed.data.rationale })
    .where(eq(runs.id, runId))
    .returning();

  if (updatedModules.length === 0) {
    return Response.json({ error: 'No modules promoted' }, { status: 400 });
  }

  const diff = buildModuleDiff(null, updatedModules[0]);
  const evaluation = buildEvaluationResult({
    actionType: 'PROMOTE',
    environment: 'prod',
  });

  await db.insert(runs).values({
    actorUserId: user.id,
    actorRole: user.role,
    environment: 'prod',
    actionType: 'PROMOTE',
    changedEntityIdsJson: updatedModules.map((m) => m.id),
    diffSummary: diff.summary,
    diffJson: diff.diff,
    evaluationJson: evaluation,
    rationale: parsed.data.rationale,
    status: 'promoted',
  });

  await logAuditEvent({
    actorUserId: user.id,
    actorRole: user.role,
    action: AuditAction.PROMOTE_RUN,
    entityType: 'run',
    entityId: promotedRun.id.toString(),
    environment: 'prod',
    success: true,
  });

  return Response.json({ promotedRun, updatedModules });
}
