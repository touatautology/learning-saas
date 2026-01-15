import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.locator('[data-form="auth"] input[name="email"]').fill(email);
  await page.locator('[data-form="auth"] input[name="password"]').fill(password);
  await page.locator('[data-action="sign_in"]').click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function signUp(page: Page, email: string, password: string) {
  await page.goto('/sign-up');
  await page.locator('[data-form="auth"] input[name="email"]').fill(email);
  await page.locator('[data-form="auth"] input[name="password"]').fill(password);
  await page.locator('[data-action="sign_up"]').click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test('agent cannot write prod modules', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, 'agent@test.com', 'admin123');

  const response = await context.request.post('/api/modules', {
    data: {
      title: 'Forbidden prod module',
      summary: 'Should fail',
      bodyMarkdown: 'Content',
      checklistJson: [
        {
          step: 'Do thing',
          successCriteria: 'Done',
          commonMistakes: 'None',
          verification: 'Check logs',
        },
      ],
      status: 'draft',
      environment: 'prod',
      rationale: 'RBAC test',
    },
  });

  expect([400, 403]).toContain(response.status());
});

test('agent cannot access billing checkout', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, 'agent@test.com', 'admin123');

  await page.goto('/pricing');
  await expect(page.locator('body[data-page="pricing"]')).toBeVisible();
  await expect(page.locator('[data-form="checkout"]')).toHaveCount(0);
});

test('learner without subscription cannot view modules', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = `learner-${Date.now()}@test.com`;
  const password = 'testpass123';
  await signUp(page, email, password);

  await context.request.post('/api/test/subscription', {
    data: { email, status: 'canceled' },
    headers: { 'Content-Type': 'application/json' },
  });

  const response = await context.request.get('/api/modules');
  expect(response.status()).toBe(403);
});
