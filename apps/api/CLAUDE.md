# Contexto do Módulo API

## Objetivo

Servir o backend dedicado do projeto com Fastify 5.

## Escopo atual implementado

- autenticação por e-mail/senha
- JWT próprio da aplicação
- RBAC por perfil
- CRUD administrativo de usuários
- auditoria persistida
- recebimento de webhooks do Sienge
- listagem e retry manual de eventos de integração
- leitura e atualização de credenciais Sienge
- enfileiramento de negociação outbound via `pg-boss`
- fluxo completo de cotações para backoffice (listagem, detalhe, envio, revisão de resposta, retry de integração)
- portal do fornecedor (listagem, detalhe, marcação de leitura, resposta com itens e entregas)
- aliases de compatibilidade PRD-09 para rotas de cotação
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
- `helmet`, `cors`, `sensible`
- `swagger` + `swagger-ui`

## Módulos de rotas reais

| Módulo          | Prefixo                                                       | Rotas                                                               |
| --------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| health          | `/`                                                           | `GET /health`                                                       |
| auth            | `/api/auth`                                                   | login, logout, forgot-password, reset-password, me                  |
| users           | `/api/users`                                                  | CRUD completo + block/reactivate/reset-password                     |
| webhooks        | `/webhooks`                                                   | `POST /webhooks/sienge`                                             |
| integration     | `/api/integration`                                            | events, events/:id/retry, credentials (GET/PUT), negotiations/write |
| quotations (bo) | `/api/quotations`, `/api/backoffice/quotations`               | listagem, detalhe, send, review, retry-integration                  |
| quotations (sp) | `/api/supplier/quotations`, `/api/supplier-portal/quotations` | listagem, detalhe, read, respond                                    |

## Dependências principais

- `fastify 5.8.5`
- `@fastify/jwt 10.0.0`
- `@fastify/swagger 9.4.0`
- `@fastify/swagger-ui 5.2.0`
- `@supabase/supabase-js ^2.45.0`
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

## Estado de qualidade

- testes: 40 passando (6 suítes)
- build: passa
- lint: passa

## Funcionalidades ainda não implementadas

- testes para o módulo de cotações
- endpoints de pedidos, entregas, follow-up, avarias e dashboard
