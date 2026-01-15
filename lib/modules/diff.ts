import type { LearningModule } from '@/lib/db/schema';

export function buildModuleDiff(
  before: LearningModule | null,
  after: LearningModule
) {
  if (!before) {
    return {
      summary: `Created module "${after.title}"`,
      diff: {
        before: null,
        after,
      },
    };
  }

  const changedFields = Object.keys(after).filter((key) => {
    return (after as Record<string, unknown>)[key] !==
      (before as Record<string, unknown>)[key];
  });

  return {
    summary: `Updated module "${after.title}" (${changedFields.join(', ')})`,
    diff: {
      before,
      after,
      changedFields,
    },
  };
}
