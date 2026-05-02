# E2E Playwright — auth e fluxos cross-módulo

Testes em [`apps/web/e2e/`](../../apps/web/e2e/) usam o navegador com **`page.route`** para mockar chamadas a `VITE_API_BASE_URL` (por omissão `http://localhost:3000/api`). Não é necessário API nem Supabase reais.

## Ficheiros

| Ficheiro                                                                                    | Cobertura                                                        |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [`login.spec.ts`](../../apps/web/e2e/login.spec.ts)                                         | PRD-01 — login → shell autenticado                               |
| [`cross-module-admin-orders.spec.ts`](../../apps/web/e2e/cross-module-admin-orders.spec.ts) | Login + navegação para `/admin/orders` + `GET /orders` mockado   |
| [`cross-module-integration.spec.ts`](../../apps/web/e2e/cross-module-integration.spec.ts)   | Login + `/admin/integration` + `GET /integration/events` mockado |
| [`auth-fixtures.ts`](../../apps/web/e2e/auth-fixtures.ts)                                   | Helper `installMockAuthLogin` (evita duplicação de rotas)        |

## Pré-requisitos

- Chromium do Playwright (uma vez por máquina):

```bash
pnpm --filter @projetog/web run test:e2e:install
```

## Execução local

Na raiz do monorepo ou em `apps/web`:

```bash
pnpm --filter @projetog/web run test:e2e
```

O [`playwright.config.ts`](../../apps/web/playwright.config.ts) sobe o Vite em `http://127.0.0.1:5173` quando nenhum servidor está a ouvir nessa URL (`reuseExistingServer` quando `CI` não está definido).

## CI

O workflow [`.github/workflows/e2e.yml`](../../.github/workflows/e2e.yml) corre em `push` e `pull_request` para `main`: instala dependências, executa `playwright install chromium --with-deps` e `pnpm --filter @projetog/web run test:e2e` com `CI=true` (retries activos conforme config).

O workflow principal [`ci.yml`](../../.github/workflows/ci.yml) mantém-se focado em lint/typecheck/test/build sem browser.
