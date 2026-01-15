export function buildEvaluationResult(context: {
  actionType: string;
  environment: string;
}) {
  return {
    actionType: context.actionType,
    environment: context.environment,
    tests: [],
    navigation: [],
    rbacChecks: [],
    ci: {
      status: 'pending',
      commitHash: null,
      executedAt: null,
      e2e: null,
      rbac: null,
    },
    createdAt: new Date().toISOString(),
  };
}
