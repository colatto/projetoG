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
- `apps/api`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SIENGE_BASE_URL`, `SIENGE_API_KEY`, `JWT_SECRET`, `PORT`, `NODE_ENV`, `SIENGE_WEBHOOK_SECRET` (segredo para validação de webhooks - deve residir unicamente no ambiente/nuvem);
- `workers/`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SIENGE_BASE_URL`, `SIENGE_API_KEY` e a string de conexao PostgreSQL usada pelo runtime de jobs.

## Rotacao de Credenciais e Segredos (API Sienge)

A integração baseia-se em `sienge_credentials`. Estas credenciais ficam criptografadas em repouso no banco. Para rotacionar:

1. O perfil **Administrador** deve atualizar as credenciais via interface de Backoffice.
2. O sistema persistirá os novos dados (`api_user`, `api_password`) de forma segura.
3. Não há necessidade de restart da aplicação, as próximas chamadas aos clientes Sienge utilizarão a nova credencial ativa.
4. Para a variável de ambiente `SIENGE_WEBHOOK_SECRET`, atualize a secret na Vercel/Infraestrutura e reinicie a aplicação (`apps/api`).

## Endpoints Expostos e Portas

- **API de Integração (Webhooks)**: O endpoint `POST /webhooks/sienge` é exposto publicamente para o Sienge.
- **Performance e Timeout**: É exigido um tempo máximo de resposta de `2,5s` para os webhooks do Sienge. A API deve apenas persistir o payload e fazer `ACK` assíncrono para os workers processarem.
- **Firewall/WAF**: Recomenda-se permitir apenas os IPs conhecidos do Sienge (se fornecidos) para a rota `/webhooks/sienge`.

## Jobs e Cronjobs (Workers)

A arquitetura de sincronização assíncrona com o Sienge baseia-se em schedulers gerenciados pelo `pg-boss` no módulo `workers/`:

- **Sincronizações de Leitura (Inbound)**: Schedulers (ex: `sienge:polling`) são ativados periodicamente para buscar atualizações em background de credores, pedidos, cotações e notas fiscais.
- **Retentativas de Falhas (Retry)**: O job dedicado `integration:retry` é responsável por buscar e processar as retentativas de falha de integração. Este cronjob garante que as falhas operacionais temporárias nas requisições outbound sejam reprocessadas respeitando os intervalos estritos de 24 horas definidos na RN-13.

## Validacoes antes de codificar integracoes

- definir a fronteira entre o que roda em `apps/api`, no Supabase e nos workers;
- confirmar credenciais e ambientes do Sienge;
- confirmar a estrategia de conexao PostgreSQL usada pelos workers;
- validar webhooks disponiveis em homologacao;
- validar correspondencia entre `supplierId` e `creditorId`;
- validar estrategia de retry e reprocessamento;
- definir politica de logs com mascaramento de dados sensiveis.
