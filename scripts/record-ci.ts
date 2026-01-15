import { desc, eq } from 'drizzle-orm';
import { client, db } from '@/lib/db/drizzle';
import { runs } from '@/lib/db/schema';

async function main() {
  const e2eStatus = process.env.CI_E2E_STATUS || 'unknown';
  const rbacStatus = process.env.CI_RBAC_STATUS || 'unknown';
  const commitHash =
    process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || null;
  const executedAt = process.env.CI_RUN_AT || new Date().toISOString();
  let targetRun = null;

  if (commitHash) {
    const [match] = await db
      .select()
      .from(runs)
      .where(eq(runs.commitHash, commitHash))
      .orderBy(desc(runs.createdAt))
      .limit(1);
    targetRun = match || null;
  }

  if (!targetRun) {
    const [latest] = await db
      .select()
      .from(runs)
      .orderBy(desc(runs.createdAt))
      .limit(1);
    targetRun = latest || null;
  }

  if (!targetRun) {
    console.log('No runs found to update.');
    return;
  }

  const ciStatus =
    e2eStatus === 'passed' && rbacStatus === 'passed' ? 'passed' : 'failed';

  const updatedEvaluation = {
    ...(targetRun.evaluationJson || {}),
    ci: {
      status: ciStatus,
      commitHash,
      executedAt,
      e2e: e2eStatus,
      rbac: rbacStatus,
    },
  };

  await db
    .update(runs)
    .set({
      evaluationJson: updatedEvaluation,
    })
    .where(eq(runs.id, targetRun.id));

  console.log(`Updated run ${targetRun.id} with CI evaluation.`);
  await client.end({ timeout: 5 });
}

main().catch((error) => {
  console.error('Failed to record CI evaluation', error);
  process.exit(1);
});
