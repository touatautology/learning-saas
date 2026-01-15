import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await expect(page.locator('body[data-page="sign_in"]')).toBeVisible();
  await page.locator('[data-form="auth"] input[name="email"]').fill(email);
  await page.locator('[data-form="auth"] input[name="password"]').fill(password);
  await page.locator('[data-action="sign_in"]').click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test('markdown sanitizer strips script tags', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, 'admin@test.com', 'admin123');

  const response = await context.request.post('/api/modules', {
    data: {
      title: `XSS Module ${Date.now()}`,
      summary: 'Malicious content test',
      bodyMarkdown: '<script>window.__xss = 1;</script><p>Safe</p>',
      checklistJson: [
        {
          step: 'Create module',
          successCriteria: 'Render safely',
          commonMistakes: 'Allowing scripts',
          verification: 'Window.__xss remains undefined',
        },
      ],
      status: 'published',
      environment: 'staging',
      rationale: 'Sanitize test',
    },
  });

  expect(response.ok()).toBeTruthy();
  const created = await response.json();

  await page.goto(`/dashboard/modules/${created.id}`);
  await expect(page.locator('body[data-page="module_detail"]')).toBeVisible();
  const hasScript = await page
    .locator('[data-section="module_body"] script')
    .count();
  expect(hasScript).toBe(0);
  const xssValue = await page.evaluate(() => (window as any).__xss);
  expect(xssValue).toBeUndefined();
});
