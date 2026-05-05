# Contexto do Módulo Web

## Objetivo

Fornecer a SPA do portal/backoffice em React + Vite.

## Escopo atual implementado

- login, recuperação e redefinição de senha
- rotas protegidas por autenticação e perfil (RBAC)
- shell administrativo com navegação lateral dinâmica por perfil
- gestão de usuários (listagem, criação, edição/bloqueio)
- monitoramento de eventos de integração em `/admin/integration`: filtros (`status`, `event_type`, `direction`, datas), paginação interativa, colunas tentativas/próximo retry, **Reprocessar** com modal (Compras) e **cooldown ~30s** entre retries manuais (PRD-09); ver `IntegrationEvents.tsx` e `IntegrationEvents.test.tsx`
- trilha de auditoria operacional em `/admin/audit` (Compras, Administrador): filtros, paginação, expansão de metadata; `AuditTrail.tsx` + `AuditTrail.test.tsx`
- listagem e detalhe de cotações (backoffice — Administrador/Compras), com filtro **Exigem ação** (`require_action`) para Compras/Administrador (PRD-09)
- portal do fornecedor com listagem e detalhe de cotações, marcação de leitura e resposta
- gestão de templates e histórico de notificações (PRD-03)
- listagem e detalhe de pedidos (backoffice e portal do fornecedor, PRD-05): Visualizador usa as mesmas rotas `/admin/orders` com copy somente leitura e sem filtro "Exigem ação"; Compras/Administrador têm checkbox que envia `require_action` e listagem ordenada por prioridade operacional (`sort_priority` na API, PRD-09 RN-09); backoffice exibe 10 colunas (§14.1: cotação, fornecedor, obra, status, data prometida, criado em, última ent., faturado, pendente); portal do fornecedor exibe 8 colunas com badges visuais de atraso 🔴 e avaria 🛠️
- follow-up logístico com listagem, detalhe, aprovação/reprovação de datas e ações de fornecedor (PRD-04)
- dashboards analíticos (PRD-08) em `/admin/dashboard/*` com filtros de período, **filtros globais** (fornecedor, obra, pedido, item) em todos os painéis e gráficos (Recharts)

## Componentes reutilizáveis

- `ProtectedRoute`: guard de rota com checagem por perfil
- `AuthContext`: context API com persistência de token em `localStorage`
- `AdminLayout`: shell com sidebar responsiva e navegação por perfil
- `Button`: componente UI genérico
- `Input`: componente UI de formulário
- `IntegrationStatusBadge`: badge de status de integração

## Rotas existentes

| Rota                                    | Componente                     | Perfis permitidos                                                    |
| --------------------------------------- | ------------------------------ | -------------------------------------------------------------------- |
| `/login`                                | `Login`                        | público                                                              |
| `/esqueci-senha`                        | `ForgotPassword`               | público                                                              |
| `/reset-password`                       | `ResetPassword`                | público                                                              |
| `/`                                     | `PlaceholderDashboard`         | qualquer autenticado                                                 |
| `/admin/users`                          | `UserList`                     | Administrador                                                        |
| `/admin/users/new`                      | `UserCreate`                   | Administrador                                                        |
| `/admin/users/:id`                      | `UserManage`                   | Administrador                                                        |
| `/admin/integration`                    | `IntegrationEvents`            | Administrador, Compras                                               |
| `/admin/audit`                          | `AuditTrail`                   | Administrador, Compras                                               |
| `/admin/quotations`                     | `QuotationList`                | Administrador, Compras                                               |
| `/admin/quotations/:id`                 | `QuotationDetail`              | Administrador, Compras                                               |
| `/admin/notifications/templates`        | `NotificationTemplates`        | Administrador                                                        |
| `/admin/notifications/logs`             | `NotificationLogs`             | Administrador, Compras                                               |
| `/admin/orders`                         | `OrderList`                    | Administrador, Compras, Visualizador (consulta)                      |
| `/admin/orders/:purchaseOrderId`        | `OrderDetail`                  | Administrador, Compras, Visualizador (consulta; sem validar entrega) |
| `/admin/followup`                       | `FollowUpList`                 | Administrador, Compras                                               |
| `/admin/followup/:purchaseOrderId`      | `FollowUpDetail`               | Administrador, Compras                                               |
| `/admin/damages`                        | `DamageList`                   | Administrador, Compras                                               |
| `/admin/damages/new`                    | `DamageCreate`                 | Administrador, Compras                                               |
| `/admin/damages/:damageId`              | `DamageDetail`                 | Administrador, Compras                                               |
| `/admin/dashboard`                      | `DashboardHome`                | Administrador, Compras                                               |
| `/admin/dashboard/lead-time`            | `DashboardLeadTime`            | Administrador, Compras                                               |
| `/admin/dashboard/atrasos`              | `DashboardAtrasos`             | Administrador, Compras                                               |
| `/admin/dashboard/criticidade`          | `DashboardCriticidade`         | Administrador, Compras                                               |
| `/admin/dashboard/ranking-fornecedores` | `DashboardRankingFornecedores` | Administrador, Compras                                               |
| `/admin/dashboard/avarias`              | `DashboardAvarias`             | Administrador, Compras                                               |
| `/supplier/quotations`                  | `SupplierQuotationList`        | Fornecedor                                                           |
| `/supplier/quotations/:id`              | `SupplierQuotationDetail`      | Fornecedor                                                           |
| `/supplier/orders`                      | `SupplierOrderList`            | Fornecedor                                                           |
| `/supplier/orders/:purchaseOrderId`     | `SupplierOrderDetail`          | Fornecedor                                                           |
| `/supplier/followup`                    | `SupplierFollowUpList`         | Fornecedor                                                           |
| `/supplier/followup/:purchaseOrderId`   | `SupplierFollowUpDetail`       | Fornecedor                                                           |

## Regras locais

- nenhuma lógica crítica de negócio fica no cliente
- o cliente fala apenas com `apps/api`
- o frontend não integra diretamente com o Sienge
- mensagens para usuário permanecem em português

## Arquivos centrais

- `src/App.tsx`
- `src/contexts/AuthContext.tsx`
- `src/lib/api.ts`
- `src/lib/rbac-ui.ts` (helpers de UI para RBAC, ex.: ações operacionais de pedido)
- `src/lib/error-utils.ts`
- `src/pages/auth/*`
- `src/pages/admin/*`
- `src/pages/supplier/*`
- `src/components/auth/ProtectedRoute.tsx`
- `src/components/ui/*`

## Ambiente

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL`

## Estado de qualidade

- build: passa
- testes: Vitest — `QuotationList.test.tsx`, `AuditTrail.test.tsx` (6 cenários: load, empty state, filtros, RN-12, error, metadata), `quotation-helpers.test.ts`, `AdminLayout.test.tsx`, `OrderList.test.tsx` (3 cenários: viewer, compras, §14.1 columns), `OrderDetail.test.tsx`, `orders-helpers.test.ts`, `NotificationLogs.test.tsx`, `IntegrationEvents.test.tsx`, `DashboardHome.test.tsx`
- E2E: Playwright — `pnpm --filter @projetog/web run test:e2e` (login + fluxos cross-módulo mockados em [`e2e/`](e2e/); CI em [`.github/workflows/e2e.yml`](../../.github/workflows/e2e.yml)); runbook [`docs/runbooks/e2e-playwright-auth.md`](../../docs/runbooks/e2e-playwright-auth.md)
- lint: passa (0 errors, 0 warnings; ESLint 9 + `eslint-plugin-react-hooks` 7.x `flat.recommended` — loaders iniciados em `useEffect` via `queueMicrotask`, ref de filtros em `IntegrationEvents` só em efeito, `SupplierQuotationDetail` sem `Date.now()` no render, `UserCreate` com `useWatch` para o papel)

## Funcionalidades ainda não implementadas

- notificações in-app
- campos faltantes nas listas de follow-up (obra, saldo pendente, cotação vinculada)
- avarias: gestão de avarias com badges e timeline no portal do fornecedor (`/supplier/damages`, `/supplier/damages/:damageId`) — telas existem, mas sem teste unitário específico
