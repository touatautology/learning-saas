import { test, expect, type Page } from '@playwright/test';

type ModuleSummary = { id: number; title: string; sourceModuleId: string };
type RunSummary = { diffSummary: string };

async function login(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await expect(page.locator('body[data-page="sign_in"]')).toBeVisible();
  await page.locator('[data-form="auth"] input[name="email"]').fill(email);
  await page.locator('[data-form="auth"] input[name="password"]').fill(password);
  await page.locator('[data-action="sign_in"]').click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test('agent -> propose -> admin approve -> promote -> learner view', async ({ browser, request }) => {
  const moduleTitle = `Agent Module ${Date.now()}`;
  let sourceModuleId: string | null = null;

  const agentContext = await browser.newContext();
  const agentPage = await agentContext.newPage();
  await login(agentPage, 'agent@test.com', 'admin123');

  await agentPage.goto('/admin/modules');
  await expect(agentPage.locator('body[data-page="admin_modules"]')).toBeVisible();
  await agentPage.locator('[data-form="create_module"] input[name="title"]').fill(moduleTitle);
  await agentPage.locator('[data-form="create_module"] input[name="summary"]').fill('Agent created module');
  await agentPage
    .locator('[data-form="create_module"] textarea[name="bodyMarkdown"]')
    .fill('# Agent content');
  await agentPage
    .locator('[data-form="create_module"] textarea[name="checklistJson"]')
    .fill(
      JSON.stringify(
        [
          {
            step: 'Create module',
            successCriteria: 'Module saved',
            commonMistakes: 'Missing rationale',
            verification: 'Check run log',
          },
        ],
        null,
        2
      )
    );
  await agentPage.locator('[data-form="create_module"] input[name="rationale"]').fill('Agent update');
  const [createResponse] = await Promise.all([
    agentPage.waitForResponse((response) => {
      return (
        response.url().endsWith('/api/modules') &&
        response.request().method() === 'POST'
      );
    }),
    agentPage.locator('[data-action="save_module"]').click(),
  ]);
  expect(createResponse.ok()).toBeTruthy();

  const stagingList = await agentContext.request.get('/api/modules?environment=staging');
  const stagingModules = (await stagingList.json()) as ModuleSummary[];
  const createdModule = stagingModules.find((module) => module.title === moduleTitle);
  sourceModuleId = createdModule?.sourceModuleId || null;

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, 'admin@test.com', 'admin123');

  const runsResponse = await adminContext.request.get('/api/runs');
  const runs = (await runsResponse.json()) as RunSummary[];
  expect(runs.some((run) => run.diffSummary.includes(moduleTitle))).toBeTruthy();

  await adminPage.goto('/admin/approvals');
  await expect(
    adminPage.locator('body[data-page="admin_approvals"]')
  ).toBeVisible();
  await adminPage
    .locator('[data-form^="approve_rationale_"]')
    .first()
    .fill('Looks good');
  await adminPage.locator('[data-action="approve_run"]').first().click();
  await expect(
    adminPage.locator('[data-status-code="APPROVE_RUN_SUCCESS"]')
  ).toBeVisible();

  await adminPage
    .locator('[data-form^="promote_rationale_"]')
    .first()
    .fill('Promote to prod');
  await adminPage.locator('[data-action="promote_run"]').first().click();
  await expect(
    adminPage.locator('[data-status-code="PROMOTE_RUN_SUCCESS"]')
  ).toBeVisible();

  await request.post('/api/test/subscription', {
    data: { email: 'learner@test.com', status: 'active' },
    headers: { 'Content-Type': 'application/json' },
  });

  const learnerContext = await browser.newContext();
  const learnerPage = await learnerContext.newPage();
  await login(learnerPage, 'learner@test.com', 'admin123');
  await learnerPage.goto('/dashboard');
  await expect(
    learnerPage.locator('body[data-page="dashboard"]')
  ).toBeVisible();
  const learnerModulesResponse = await learnerPage.request.get('/api/modules');
  const learnerModules = (await learnerModulesResponse.json()) as ModuleSummary[];
  const promotedModule = learnerModules.find(
    (module) => module.sourceModuleId === sourceModuleId
  );
  expect(promotedModule).toBeTruthy();
  if (!promotedModule) {
    throw new Error('Promoted module not found.');
  }

  await learnerPage
    .locator(
      `[data-action="view_module"][data-module-id="${promotedModule.id}"]`
    )
    .click();
  await expect(
    learnerPage.locator('body[data-page="module_detail"]')
  ).toBeVisible();

  if (sourceModuleId) {
    await expect(
      learnerPage.locator(`[data-source-module-id="${sourceModuleId}"]`)
    ).toBeVisible();
  }
});
