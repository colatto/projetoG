# Contexto do Modulo API

## Objetivo

Implementar o backend dedicado em TypeScript para API interna, autenticacao, webhooks e orquestracao do sistema.

## Responsabilidades

- RBAC por perfil oficial;
- autenticacao por e-mail e senha;
- links seguros de primeiro acesso e redefinicao;
- auditoria persistida;
- workflow de cotacao;
- workflow de follow-up;
- gestao de avarias;
- reprocessamento de integracao;
- coordenacao com Supabase para persistencia e autenticacao;
- despacho de tarefas assincronas para workers e jobs fora do ciclo HTTP.

## Regras locais

- toda aprovacao de cotacao ocorre aqui;
- toda regra de prazo, status e follow-up ocorre aqui ou em `packages/domain`;
- integracoes com Sienge devem ser idempotentes e rastreaveis;
- jobs nao dependem do frontend;
- a API pode ser exposta na Vercel para fluxos sincronos, mas o processamento demorado nao deve depender do tempo de vida de uma requisicao serverless.

## Framework e deploy <!-- atualizado -->

- **Framework:** Fastify v5 — decisao registrada em `docs/decisions/ADR-0002-backend-framework.md`.
- **Estrategia de deploy:** servidor standalone dedicado (Railway, Fly.io, VPS ou container). A API NAO deve rodar exclusivamente como funcao serverless de curta duracao, pois processa webhooks e coordena jobs de longa duracao.
- **Entrypoint:** `apps/api/src/server.ts` (inicializa Fastify e registra plugins); `apps/api/src/app.ts` (factory exportavel para testes via `fastify.inject()`).
- **Estrutura esperada de pastas:**
  - `src/routes/` — rotas agrupadas por modulo de dominio
  - `src/plugins/` — plugins globais (jwt, cors, helmet, sensible)
  - `src/hooks/` — lifecycle hooks (RBAC, auditoria)
  - `src/schemas/` — JSON Schemas de request/response

## Dependencias principais esperadas <!-- atualizado -->

| Pacote                              | Finalidade                     |
| ----------------------------------- | ------------------------------ |
| `fastify`                           | Core do framework              |
| `@fastify/jwt`                      | Verificacao de JWT             |
| `@fastify/cors`                     | Politica CORS                  |
| `@fastify/helmet`                   | Headers de seguranca           |
| `@fastify/sensible`                 | Utilitarios de respostas HTTP  |
| `@fastify/swagger`                  | Documentacao automatica de API |
| `@supabase/supabase-js`             | Cliente Supabase               |
| `zod` e `fastify-type-provider-zod` | Validacao de schemas           |

## Variaveis de ambiente esperadas <!-- atualizado -->

- `SUPABASE_URL` — URL do projeto `dbGRF`
- `SUPABASE_SERVICE_ROLE_KEY` — chave de servico do Supabase
- `SIENGE_BASE_URL` — URL base da API do Sienge
- `SIENGE_API_KEY` ou `SIENGE_TOKEN` — credencial de acesso ao Sienge
- `JWT_SECRET` — segredo para `@fastify/jwt`
- `PORT` — porta de execucao do servidor (padrao: 3000)

## Contexto de testes <!-- atualizado -->

- **Framework:** Vitest — compativel com `fastify.inject()` para testes de rotas sem servidor HTTP real.
- **Padrao:** testes de integracao via `fastify.inject()` por rota/endpoint; testes unitarios para hooks, plugins e orquestracao.
- **Localizacao:** `apps/api/src/**/*.test.ts` ou subpastas `__tests__/`.
- **Referencia:** `docs/decisions/ADR-0002-backend-framework.md`.
