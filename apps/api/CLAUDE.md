# Contexto do Módulo API

## Objetivo

Servir o backend dedicado do projeto com Fastify 5.

## Escopo atual implementado

- autenticação por e-mail/senha
- JWT próprio da aplicação
- RBAC por perfil
- CRUD administrativo de usuários
- auditoria persistida
- recebimento de webhooks do Sienge (`WebhookController.ENTITY_TYPE_MAP` tipa ACK-only CONTRACT*/MEASUREMENT*/CLEARING\_ → PRD-07)
- listagem e retry manual de eventos de integração (`GET /api/integration/events` com filtros; UI em `/admin/integration`)
- leitura e atualização de credenciais Sienge
- enfileiramento de negociação outbound via `pg-boss`
- fluxo completo de cotações para backoffice (listagem, detalhe, envio, revisão de resposta, retry de integração)
- portal do fornecedor (listagem, detalhe, marcação de leitura, resposta com itens e entregas)
- aliases PRD-09: cotações (`/api/backoffice/quotations`, `/api/supplier-portal/quotations`), pedidos backoffice (`/api/backoffice/orders`), pedidos portal (`/api/supplier-portal/orders`), integração (`/api/backoffice/integrations` → listagem e retry como `/api/integration/events`)
- leitura da trilha de auditoria operacional em `GET /api/backoffice/audit` e `GET /api/backoffice/audit/:audit_event_id` (Compras, Administrador)
- `AuditService` centralizado (`audit.service.ts`): `registerEvent()` com `summary` obrigatório (fallback automático via `fallbackSummary()`), campos operacionais PRD-09 (`actorType`, `purchaseOrderId`, `supplierId`), e enfileiramento pg-boss (`audit:retry`) em caso de falha de escrita (§9.6). Guard externo `try/catch` captura exceções lançadas (e.g., erros de rede) além de respostas `{ error }` — auditoria nunca bloqueia o fluxo principal. Todos os módulos (orders, dashboard, quotations, damages, followup) usam exclusivamente `AuditService` — zero inserts diretos em `audit_logs`.
- módulo de entregas com validação e listagem pendente (PRD-05)
- módulo de pedidos com listagem, detalhes de entregas, cancelamento, histórico de status e recepção de avaria/reposição (PRD-05)
- módulo de notificações por e-mail com templates editáveis, logs de envio e provedor Resend (PRD-03)
- módulo de follow-up logístico com listagem, detalhe, confirmação de prazo, sugestão/aprovação/reprovação de nova data e histórico de notificações (PRD-04)
- módulo de avarias (PRD-06) e leitura de dashboards consolidados (PRD-08) em `/api/dashboard/*`
- documentação Swagger em `/docs`
- métricas via `prom-client`

## Pontos de entrada reais

- `src/server.ts`: bootstrap do servidor
- `src/app.ts`: factory usada em runtime e testes

## Plugins registrados

- `supabasePlugin`
- `authPlugin` (JWT + `authenticate` + `verifyRole`)
- `pgBossPlugin` quando `DATABASE_URL` está presente
- `metricsPlugin` (`prom-client`)
- `emailPlugin` (provedor Resend para envio de e-mail — PRD-03)
- `helmet`, `cors`, `sensible`
- `swagger` + `swagger-ui`

## Módulos de rotas reais

| Módulo          | Prefixo                                                                | Rotas                                                                                                                                                                                                                              |
| --------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| health          | `/`                                                                    | `GET /health`                                                                                                                                                                                                                      |
| auth            | `/api/auth`                                                            | login, logout, forgot-password, reset-password, me                                                                                                                                                                                 |
| users           | `/api/users`                                                           | CRUD completo + block/reactivate/reset-password                                                                                                                                                                                    |
| webhooks        | `/webhooks`                                                            | `POST /webhooks/sienge`                                                                                                                                                                                                            |
| integration     | `/api/integration`, `/api/backoffice/integrations` (alias PRD-09)      | events + `events/:id/retry` (canônico); alias: `GET /`, `POST /:id/retry`; credentials (GET/PUT), negotiations/write                                                                                                               |
| quotations (bo) | `/api/quotations`, `/api/backoffice/quotations`                        | listagem, detalhe, send, review, retry-integration                                                                                                                                                                                 |
| quotations (sp) | `/api/supplier/quotations`, `/api/supplier-portal/quotations`          | listagem, detalhe, read, respond                                                                                                                                                                                                   |
| deliveries      | `/api/deliveries`                                                      | validação de entrega, listagem pendente (PRD-05)                                                                                                                                                                                   |
| orders          | `/api/orders`, `/api/backoffice/orders`, `/api/supplier-portal/orders` | `GET` lista com `require_action`, `sort_priority` (PRD-09), ordenação RN-09 + contexto `follow_up_trackers`; entregas, cancelamento, histórico (PRD-05)                                                                            |
| audit (PRD-09)  | `/api/backoffice/audit`                                                | `GET` lista paginada com filtros; `GET /:audit_event_id` detalhe (somente leitura; Compras, Administrador)                                                                                                                         |
| notifications   | `/api/notifications`                                                   | templates (CRUD), logs (listagem) (PRD-03)                                                                                                                                                                                         |
| followup        | `/api/followup`                                                        | orders list/detail/notifications: Administrador, Compras, Fornecedor (sem `visualizador_pedidos`); mutações conforme PRD-04                                                                                                        |
| damages         | `/api/damages`                                                         | CRUD fluxo avaria, audit (PRD-06)                                                                                                                                                                                                  |
| dashboard       | `/api/dashboard`                                                       | resumo, kpis, lead-time, atrasos, criticidade, ranking, avarias (PRD-08); filtros globais fornecedor/obra/pedido/item em lead-time, atrasos, criticidade, ranking e avarias; `dashboard.access` via `AuditService.registerEvent()` |

## Dependências principais

- `fastify 5.8.5`
- `@fastify/jwt 10.0.0`
- `@fastify/swagger 9.4.0`
- `@fastify/swagger-ui 5.2.0`
- `@supabase/supabase-js ^2.105.1`
- `fastify-type-provider-zod 4.0.2`
- `pg-boss 9.0.3`
- `prom-client 15.1.3`

## Ambiente

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SIENGE_BASE_URL`
- `SIENGE_API_KEY`
- `SIENGE_API_SECRET`
- `SIENGE_WEBHOOK_SECRET`
- `SIENGE_ENCRYPTION_KEY`
- `JWT_SECRET`
- `PORT`
- `NODE_ENV`
- `DATABASE_URL` opcional
- `EMAIL_PROVIDER_API_KEY` (Resend API key — PRD-03)
- `COMPRAS_EMAIL` (endereço de e-mail para notificações de Compras)

## Estado de qualidade

- testes: inclui `audit.routes.test.ts` (PRD-09 leitura), `dashboard.routes.test.ts` (RBAC e filtros PRD-08), `notification.routes.test.ts` (PRD-03 §7.5), `followup.routes.test.ts`, `damages.routes.test.ts` (PRD-06), `webhooks.test.ts` (ACK-only), `integration.test.ts` (filtros + aliases PRD-09), `orders.test.ts` (PRD-05 + cancel/avaria via AuditService)
- build: passa
- lint: passa
- vitest runner: estável — todas as suítes fazem teardown com `app.close()`, `pool: 'forks'` sem warnings de `MaxListeners` ou `tinypool`

## Funcionalidades ainda não implementadas

- Paginação e filtros `supplier_id` / `building_id` em `GET /api/orders` (evolução futura).
- Worker `audit:retry` em `workers/src/jobs/audit-retry.ts` processa eventos enfileirados quando o insert primário na API falha (PRD-09 §9.6).
