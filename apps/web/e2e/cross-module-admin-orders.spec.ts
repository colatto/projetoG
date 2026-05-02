import { test, expect } from '@playwright/test';
import { installMockAuthLogin } from './auth-fixtures';

test.describe('E2E cross-module: auth + pedidos (API mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await installMockAuthLogin(page, 'compras');

    await page.route('**/api/orders**', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            sienge_purchase_order_id: 9001,
            supplier_id: 10,
            local_status: 'PENDENTE',
            created_at: '2026-05-02T10:00:00.000Z',
            last_delivery_date: null,
            total_quantity_ordered: '10',
            total_quantity_delivered: '0',
            pending_quantity: '10',
            has_divergence: false,
            suppliers: { name: 'Fornecedor E2E' },
          },
        ]),
      });
    });
  });

  test('login then pedidos list renders mocked row', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill('e2e@test.com');
    await page.getByLabel('Senha').fill('senha123456');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/?$/);
    await page.getByRole('link', { name: 'Pedidos' }).click();

    await expect(page).toHaveURL(/\/admin\/orders$/);
    await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible();
    await expect(page.getByRole('link', { name: '#9001' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Fornecedor E2E' })).toBeVisible();
  });
});
