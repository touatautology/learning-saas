import { desc, eq } from 'drizzle-orm';
import { client, db } from '@/lib/db/drizzle';
import { runs } from '@/lib/db/schema';

async function main() {
  const e2eStatus = process.env.CI_E2E_STATUS || 'unknown';
  const rbacStatus = process.env.CI_RBAC_STATUS || 'unknown';
  const commitHash = process.env.GITHUB_SHA || null;
  const executedAt = process.env.CI_RUN_AT || new Date().toISOString();

  const [latest] = await db
    .select()
    .from(runs)
    .orderBy(desc(runs.createdAt))
    .limit(1);

  if (!latest) {
    console.log('No runs found to update.');
    return;
  }

  const ciStatus =
    e2eStatus === 'passed' && rbacStatus === 'passed' ? 'passed' : 'failed';

  const updatedEvaluation = {
    ...(latest.evaluationJson || {}),
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
    .where(eq(runs.id, latest.id));

  console.log(`Updated run ${latest.id} with CI evaluation.`);
  await client.end({ timeout: 5 });
}

main().catch((error) => {
  console.error('Failed to record CI evaluation', error);
  process.exit(1);
});
