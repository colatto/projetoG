# Runbook de Setup Inicial

## Objetivo

Transformar esta base documental em um workspace executavel com frontend em Vite, backend dedicado, Supabase e pacotes compartilhados.

## Estado atual da base

- o monorepo esta inicializado com `pnpm`;
- `apps/web`, `apps/api`, `packages/*` e `workers/` estao com seus scaffolds e dependencias basicas configurados e interligados no workspace;
- o projeto Supabase `dbGRF` ja esta linkado (via db:login e db:link) e pronto para gerenciamento de migrations local;
- as decisoes de stack ja foram tomadas:
  - workspace com `pnpm`;
  - `apps/api` com Fastify v5;
  - `workers/` com Node.js + TypeScript + `pg-boss`.

## Pre-requisitos

Antes de iniciar o setup:

1. Garantir Node.js com `corepack` disponivel.
2. Habilitar `pnpm` com `corepack enable` ou instalar `pnpm` globalmente.
3. Confirmar acesso ao projeto Supabase `dbGRF`.
4. Preencher as variaveis necessarias a partir de `.env.example`.
5. Confirmar credenciais e ambiente de homologacao do Sienge antes de qualquer integracao.

## Ordem sugerida

1. (CONCLUÍDO) Garantir que `pnpm` esta disponivel.
2. (CONCLUÍDO) Inicializar o monorepo com:
   - `package.json` na raiz;
   - `pnpm-workspace.yaml`;
   - `package.json` em `apps/web`, `apps/api`, `packages/domain`, `packages/integration-sienge`, `packages/shared` e `workers`;
   - `pnpm install` na raiz.
3. (CONCLUÍDO) Inicializar `apps/web` com React + TypeScript + Vite.
4. (CONCLUÍDO) Inicializar `apps/api` com TypeScript + Fastify v5 para API interna, webhooks e orquestracao.
5. (CONCLUÍDO) Inicializar `workers/` com Node.js + TypeScript + `pg-boss` para polling, retries, scheduler e reprocessamentos.
6. (CONCLUÍDO) Configurar o projeto Supabase `dbGRF` ja provisionado:
   - autenticacao;
   - conexao de ambiente;
   - migracoes;
   - convencoes operacionais em `supabase/`.
7. (CONCLUÍDO) Configurar lint, formatacao, testes e CI.
8. (CONCLUÍDO) Modelar o banco relacional.
9. (CONCLUÍDO) Implementar autenticação, gestão CRUD de usuários e RBAC (Sprints A e B concluídas).
   9.1 (CONCLUÍDO) Implementar Frontend Autenticação e Gestão React/Vite (Sprint C concluída).
10. Configurar deploy principal do web na Vercel.
11. Definir estrategia de deploy standalone para `apps/api` e `workers/`.
12. (CONCLUÍDO) Implementar integracao inicial com Sienge (Cliente HTTP Base e Resiliência).

## Variaveis e configuracao inicial

Usar `.env.example` como referencia obrigatoria durante o bootstrap.

Minimo esperado por modulo:

- `apps/web`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`;
- `apps/api`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SIENGE_BASE_URL`, `SIENGE_API_KEY`, `JWT_SECRET`, `PORT`, `NODE_ENV`;
- `workers/`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SIENGE_BASE_URL`, `SIENGE_API_KEY` e a string de conexao PostgreSQL usada pelo runtime de jobs.

Preferir `.env` fragmentado por modulo (`apps/web/.env`, `apps/api/.env`, `workers/.env`) para evitar exposicao acidental de segredos do backend ao processo do frontend.

## Validacoes antes de codificar integracoes

- definir a fronteira entre o que roda em `apps/api`, no Supabase e nos workers;
- confirmar credenciais e ambientes do Sienge;
- confirmar a estrategia de conexao PostgreSQL usada pelos workers;
- validar webhooks disponiveis em homologacao;
- validar correspondencia entre `supplierId` e `creditorId`;
- validar estrategia de retry e reprocessamento;
- definir politica de logs com mascaramento de dados sensiveis.
