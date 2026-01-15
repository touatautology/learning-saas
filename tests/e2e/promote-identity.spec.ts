import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await expect(page.locator('body[data-page="sign_in"]')).toBeVisible();
  await page.locator('[data-form="auth"] input[name="email"]').fill(email);
  await page.locator('[data-form="auth"] input[name="password"]').fill(password);
  await page.locator('[data-action="sign_in"]').click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test('promote uses sourceModuleId even with duplicate titles', async ({ browser }) => {
  const moduleTitle = `Duplicate Title ${Date.now()}`;

  const agentContext = await browser.newContext();
  const agentPage = await agentContext.newPage();
  await login(agentPage, 'agent@test.com', 'admin123');

  const createPayload = {
    title: moduleTitle,
    summary: 'Duplicate title test',
    bodyMarkdown: '# Module body',
    checklistJson: [
      {
        step: 'Create module',
        successCriteria: 'Saved',
        commonMistakes: 'None',
        verification: 'Check ID',
      },
    ],
    status: 'draft',
    environment: 'staging',
    rationale: 'Identity test',
  };

  const firstResponse = await agentContext.request.post('/api/modules', {
    data: createPayload,
  });
  expect(firstResponse.ok()).toBeTruthy();
  const firstModule = await firstResponse.json();

  const secondResponse = await agentContext.request.post('/api/modules', {
    data: createPayload,
  });
  expect(secondResponse.ok()).toBeTruthy();
  const secondModule = await secondResponse.json();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, 'admin@test.com', 'admin123');

  const runsResponse = await adminContext.request.get('/api/runs');
  const runs = (await runsResponse.json()) as Array<{
    id: number;
    changedEntityIdsJson: number[] | null;
  }>;
  const targetRun = runs.find((run) =>
    Array.isArray(run.changedEntityIdsJson) &&
    run.changedEntityIdsJson.includes(secondModule.id)
  );
  expect(targetRun).toBeTruthy();
  if (!targetRun) {
    throw new Error('Expected run for second module');
  }

  const approveResponse = await adminContext.request.post(
    `/api/approvals/${targetRun.id}`,
    {
      data: { decision: 'approve', rationale: 'Approve for promote' },
    }
  );
  expect(approveResponse.ok()).toBeTruthy();

  const promoteResponse = await adminContext.request.post(
    `/api/promote/${targetRun.id}`,
    {
      data: { rationale: 'Promote selected module' },
    }
  );
  expect(promoteResponse.ok()).toBeTruthy();

  const prodResponse = await adminContext.request.get(
    '/api/modules?environment=prod'
  );
  const prodModules = (await prodResponse.json()) as Array<{
    id: number;
    sourceModuleId: string | null;
  }>;

  const hasSecond = prodModules.some(
    (module) => module.sourceModuleId === secondModule.sourceModuleId
  );
  const hasFirst = prodModules.some(
    (module) => module.sourceModuleId === firstModule.sourceModuleId
  );

  expect(hasSecond).toBeTruthy();
  expect(hasFirst).toBeFalsy();
});
