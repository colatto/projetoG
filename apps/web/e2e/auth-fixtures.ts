import type { Page } from '@playwright/test';

/** Role values match `UserRole` string enums from `@projetog/domain`. */
export type MockLoginRole = 'compras' | 'administrador' | 'fornecedor';

export async function installMockAuthLogin(page: Page, role: MockLoginRole = 'compras') {
  await page.route('**/api/auth/login', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: '00000000-0000-0000-0000-000000000099',
          email: 'e2e@test.com',
          name: 'E2E User',
          role,
          status: 'ativo',
          supplier_id: role === 'fornecedor' ? 42 : null,
        },
        session: { access_token: 'playwright-e2e-token' },
      }),
    });
  });
}
