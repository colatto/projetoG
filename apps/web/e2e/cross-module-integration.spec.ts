import { test, expect } from '@playwright/test';
import { installMockAuthLogin } from './auth-fixtures';

test.describe('E2E cross-module: auth + monitor de integração (API mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await installMockAuthLogin(page, 'compras');

    await page.route('**/api/integration/events**', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: '00000000-0000-0000-0000-0000000000aa',
              event_type: 'sync_orders',
              status: 'completed',
              direction: 'inbound',
              endpoint: '/sync/orders',
              created_at: '2026-05-02T12:00:00.000Z',
              retry_count: 0,
              max_retries: 3,
              next_retry_at: null,
            },
          ],
          pagination: { total: 1, page: 1, limit: 20 },
        }),
      });
    });
  });

  test('login then integration monitor lists mocked event', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill('e2e@test.com');
    await page.getByLabel('Senha').fill('senha123456');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/?$/);
    await page.getByRole('link', { name: 'Integração Sienge' }).click();

    await expect(page).toHaveURL(/\/admin\/integration$/);
    await expect(page.getByRole('heading', { name: 'Monitor de Integração' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Sync de pedidos' })).toBeVisible();
  });
});
