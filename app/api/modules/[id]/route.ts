import { z } from 'zod';
import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  AuditAction,
  learningModules,
  runs,
} from '@/lib/db/schema';
import { getSubscriptionForUser, getUser, logAuditEvent } from '@/lib/db/queries';
import { buildModuleDiff } from '@/lib/modules/diff';
import { buildEvaluationResult } from '@/lib/runs/evaluation';
import { requireEnvironmentWrite, requireRole } from '@/lib/auth/rbac';

const updateSchema = z.object({
  title: z.string().min(3).max(200),
  summary: z.string().max(500).optional(),
  bodyMarkdown: z.string().min(10),
  checklistJson: z.array(
    z.object({
      step: z.string(),
      successCriteria: z.string(),
      commonMistakes: z.string(),
      verification: z.string(),
    })
  ),
  status: z.enum(['draft', 'published']),
  environment: z.enum(['staging', 'prod']),
  rationale: z.string().min(3).max(500),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const moduleId = Number(id);
  if (Number.isNaN(moduleId)) {
    return Response.json({ error: 'Invalid module id' }, { status: 400 });
  }

  if (user.role === 'LEARNER') {
    const subscription = await getSubscriptionForUser(user.id);
    if (!subscription || !['active', 'trialing'].includes(subscription.status || '')) {
      return Response.json({ error: 'Subscription required' }, { status: 403 });
    }

    const [module] = await db
      .select()
      .from(learningModules)
      .where(
        and(
          eq(learningModules.id, moduleId),
          eq(learningModules.environment, 'prod'),
          eq(learningModules.status, 'published')
        )
      )
      .limit(1);
    if (!module) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    return Response.json(module);
  }

  const [module] = await db
    .select()
    .from(learningModules)
    .where(eq(learningModules.id, moduleId))
    .limit(1);

  if (!module) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  if (user.role === 'AGENT' && module.environment !== 'staging') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  return Response.json(module);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const moduleId = Number(id);
  if (Number.isNaN(moduleId)) {
    return Response.json({ error: 'Invalid module id' }, { status: 400 });
  }

  const payload = await request.json();
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    await logAuditEvent({
      actorUserId: user.id,
      actorRole: user.role,
      action: AuditAction.VALIDATION_FAILED,
      entityType: 'learning_module',
      entityId: id,
      environment:
        typeof payload?.environment === 'string' ? payload.environment : 'staging',
      success: false,
      detailsJson: { issues: parsed.error.issues },
    });
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  const data = parsed.data;

  try {
    await requireRole(user, ['ADMIN', 'AGENT'], {
      action: 'UPDATE_MODULE',
      entityType: 'learning_module',
      entityId: id,
      environment: data.environment,
    });
    await requireEnvironmentWrite(user, data.environment, {
      action: 'UPDATE_MODULE',
      entityType: 'learning_module',
      entityId: id,
    });
  } catch (error) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [existing] = await db
    .select()
    .from(learningModules)
    .where(eq(learningModules.id, moduleId))
    .limit(1);

  if (!existing) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const [updated] = await db
    .update(learningModules)
    .set({
      title: data.title,
      summary: data.summary,
      bodyMarkdown: data.bodyMarkdown,
      checklistJson: data.checklistJson,
      status: data.status,
      environment: data.environment,
      updatedAt: new Date(),
    })
    .where(eq(learningModules.id, moduleId))
    .returning();

  const diff = buildModuleDiff(existing, updated);
  const evaluation = buildEvaluationResult({
    actionType: 'UPDATE_MODULE',
    environment: updated.environment,
  });
  const runStatus = user.role === 'AGENT' ? 'proposed' : 'applied';
  const commitHash =
    process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || null;

  const [createdRun] = await db.insert(runs).values({
    actorUserId: user.id,
    actorRole: user.role,
    environment: updated.environment,
    actionType: 'UPDATE_MODULE',
    changedEntityIdsJson: [updated.id],
    diffSummary: diff.summary,
    diffJson: diff.diff,
    evaluationJson: evaluation,
    rationale: data.rationale,
    status: runStatus,
    commitHash,
  }).returning();

  if (createdRun) {
    await logAuditEvent({
      actorUserId: user.id,
      actorRole: user.role,
      action: AuditAction.CREATE_RUN,
      entityType: 'run',
      entityId: createdRun.id.toString(),
      environment: updated.environment,
      success: true,
      detailsJson: { actionType: createdRun.actionType, status: createdRun.status },
    });
  }

  await logAuditEvent({
    actorUserId: user.id,
    actorRole: user.role,
    action:
      user.role === 'AGENT' ? AuditAction.PROPOSE_RUN : AuditAction.UPDATE_MODULE,
    entityType: 'learning_module',
    entityId: updated.id.toString(),
    environment: updated.environment,
    success: true,
  });

  return Response.json(updated);
}
