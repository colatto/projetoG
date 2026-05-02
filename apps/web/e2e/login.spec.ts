import { test, expect } from '@playwright/test';
import { installMockAuthLogin } from './auth-fixtures';

test.describe('Login E2E (API mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await installMockAuthLogin(page, 'compras');
  });

  test('login redirects to home with authenticated shell', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill('e2e@test.com');
    await page.getByLabel('Senha').fill('senha123456');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/?$/);
    await expect(page.getByText('Bem-vindo ao Portal GRF')).toBeVisible();
  });
});
