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

## Pontos de entrada reais

- `src/server.ts`: bootstrap do servidor
- `src/app.ts`: factory usada em runtime e testes

## Plugins registrados

- `supabasePlugin`
- `authPlugin`
- `pgBossPlugin` quando `DATABASE_URL` está presente

## Rotas reais

- `/health`
- `/api/auth/*`
- `/api/users/*`
- `/webhooks/sienge`
- `/api/integration/*`

## Dependências principais

- `fastify 5.8.4`
- `@fastify/jwt 9.0.1`
- `@fastify/swagger 9.4.0`
- `@fastify/swagger-ui 5.2.0`
- `@supabase/supabase-js 2.102.1`
- `fastify-type-provider-zod 4.0.2`
- `pg-boss 9.0.3`

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

- testes: passam
- build: passa
- lint: falha

Principais débitos atuais:

- `no-explicit-any`
- `no-unused-vars`
- tipagem frouxa em testes e plugin de auth
