import { z } from 'zod';
import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db/drizzle';
import {
  AuditAction,
  learningModules,
  runs,
  type NewLearningModule,
} from '@/lib/db/schema';
import { getSubscriptionForUser, getUser, logAuditEvent } from '@/lib/db/queries';
import { buildModuleDiff } from '@/lib/modules/diff';
import { buildEvaluationResult } from '@/lib/runs/evaluation';
import { requireEnvironmentWrite, requireRole } from '@/lib/auth/rbac';

const moduleSchema = z.object({
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

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role === 'LEARNER') {
    const subscription = await getSubscriptionForUser(user.id);
    if (!subscription || !['active', 'trialing'].includes(subscription.status || '')) {
      return Response.json({ error: 'Subscription required' }, { status: 403 });
    }

    const modules = await db
      .select()
      .from(learningModules)
      .where(and(eq(learningModules.environment, 'prod'), eq(learningModules.status, 'published')));

    return Response.json(modules);
  }

  const environment = request.nextUrl.searchParams.get('environment') as
    | 'staging'
    | 'prod'
    | null;

  if (user.role === 'AGENT') {
    const modules = await db
      .select()
      .from(learningModules)
      .where(eq(learningModules.environment, 'staging'));
    return Response.json(modules);
  }

  if (environment) {
    const modules = await db
      .select()
      .from(learningModules)
      .where(eq(learningModules.environment, environment));
    return Response.json(modules);
  }

  const modules = await db.select().from(learningModules);
  return Response.json(modules);
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = moduleSchema.safeParse(payload);
  if (!parsed.success) {
    await logAuditEvent({
      actorUserId: user.id,
      actorRole: user.role,
      action: AuditAction.VALIDATION_FAILED,
      entityType: 'learning_module',
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
      action: 'CREATE_MODULE',
      entityType: 'learning_module',
      environment: data.environment,
    });

    await requireEnvironmentWrite(user, data.environment, {
      action: 'CREATE_MODULE',
      entityType: 'learning_module',
    });
  } catch (error) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const newModule: NewLearningModule = {
    sourceModuleId: randomUUID(),
    title: data.title,
    summary: data.summary,
    bodyMarkdown: data.bodyMarkdown,
    checklistJson: data.checklistJson,
    status: data.status,
    environment: data.environment,
  };

  const [created] = await db.insert(learningModules).values(newModule).returning();
  const diff = buildModuleDiff(null, created);
  const evaluation = buildEvaluationResult({
    actionType: 'CREATE_MODULE',
    environment: created.environment,
  });
  const runStatus = user.role === 'AGENT' ? 'proposed' : 'applied';

  await db.insert(runs).values({
    actorUserId: user.id,
    actorRole: user.role,
    environment: created.environment,
    actionType: 'CREATE_MODULE',
    changedEntityIdsJson: [created.id],
    diffSummary: diff.summary,
    diffJson: diff.diff,
    evaluationJson: evaluation,
    rationale: data.rationale,
    status: runStatus,
  });

  await logAuditEvent({
    actorUserId: user.id,
    actorRole: user.role,
    action:
      user.role === 'AGENT' ? AuditAction.PROPOSE_RUN : AuditAction.CREATE_MODULE,
    entityType: 'learning_module',
    entityId: created.id.toString(),
    environment: created.environment,
    success: true,
  });

  return Response.json(created);
}
