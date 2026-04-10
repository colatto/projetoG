# ADR-0002: Framework do Backend — apps/api

## Status

Aceito

## Contexto

O modulo `apps/api` e o backend dedicado em TypeScript responsavel por:

- autenticacao e RBAC;
- API interna do sistema;
- aprovacao de respostas de cotacao;
- workflow de follow-up;
- auditoria;
- webhooks;
- orquestracao de integracoes com Sienge;
- despacho de tarefas assincronas para workers.

A escolha do framework HTTP impacta diretamente performance, suporte a TypeScript, ecossistema de plugins, estrategia de deploy e compatibilidade com a camada de testes.

Tres opcoes foram avaliadas: **Fastify**, **Hono** e **Express**.

## Decisao

Adotar **Fastify** como framework HTTP do backend em `apps/api`.

### Justificativa

- TypeScript nativo com tipagem via `@fastify/type-provider-typebox` ou Zod, sem adapters externos.
- Alta performance por design (benchmarks consistentemente acima de Express e comparaveis a Hono em cenarios de servidor standalone).
- Ecossistema maduro de plugins oficiais: `@fastify/jwt`, `@fastify/cors`, `@fastify/helmet`, `@fastify/sensible`, `@fastify/swagger`.
- Schema validation integrado via JSON Schema, reduzindo boilerplate de validacao de request/response.
- Suporte nativo a lifecycle hooks (onRequest, preHandler, onSend, onError), essencial para RBAC, auditoria e logging.
- Deploy como servidor standalone dedicado (Railway, Fly.io, VPS, container), alinhado com a necessidade de processar webhooks e coordenar jobs de longa duracao que nao dependem do request lifecycle da Vercel.
- Comunidade ativa, versao estavel (v5.x), amplamente adotada em producao.

## Consequencias

### Positivas

- Tipagem forte de routes, schemas e replies sem overhead de configuracao.
- Plugin system baseado em encapsulamento (`fastify-plugin`) facilita modularizacao por dominio.
- Validation automatica de request/response reduz erros de contrato de API.
- Logging estruturado por padrão via `pino`, com suporte a masked fields para dados sensiveis.
- Testabilidade nativa via `fastify.inject()` sem necessidade de servidor HTTP real em testes.
- Compatiblidade direta com Vitest e Jest para testes unitarios e de integracao.

### Negativas

- Curva de aprendizado ligeiramente maior que Express para quem nao conhece o plugin system do Fastify.
- Deploy na Vercel como funcao serverless e possivel mas nao e o caso de uso otimizado — preferir servidor standalone.
- Documentacao e exemplos no ecossistema mais escassos que Express (mas crescendo com v5).

## Alternativas consideradas

### Hono

Nao adotado como primeira escolha porque:

- Melhor otimizado para ambientes Edge (Vercel Edge Functions, Cloudflare Workers, Deno Deploy).
- Ecossistema de plugins ainda menor para cenarios de servidor standalone complexo.
- O produto exige processamento de longa duracao (polling, retry, reconciliacao) que nao se beneficia do modelo stateless de Edge.

### Express

Nao adotado porque:

- Sem tipos nativos — requer `@types/express` e adapters para TypeScript estrito.
- Design mais antigo e menos performatico que Fastify.
- Sem schema validation integrada — validacao manual ou dependencia de libs externas (Joi, Zod) sem integracao nativa.

## Entrypoint esperado

```
apps/api/
├── src/
│   ├── server.ts        # inicializa a instancia Fastify e registra plugins
│   ├── app.ts           # factory function exportavel para testes (fastify.inject)
│   ├── routes/          # rotas agrupadas por modulo de dominio
│   ├── plugins/         # plugins globais (auth, cors, helmet, sensible)
│   ├── hooks/           # lifecycle hooks (RBAC, auditoria)
│   └── schemas/         # JSON Schemas de request/response compartilhados
└── package.json
```

## Dependencias principais esperadas

| Pacote                              | Finalidade                                     |
| ----------------------------------- | ---------------------------------------------- |
| `fastify`                           | Core do framework                              |
| `@fastify/jwt`                      | Verificacao de JWT para autenticacao           |
| `@fastify/cors`                     | Politica CORS                                  |
| `@fastify/helmet`                   | Headers de seguranca                           |
| `@fastify/sensible`                 | Utilitarios de respostas HTTP                  |
| `@fastify/swagger`                  | Documentacao automatica de API                 |
| `@supabase/supabase-js`             | Cliente Supabase (autenticacao e dados)        |
| `pino`                              | Logging estruturado (incluso no Fastify)       |
| `zod` e `fastify-type-provider-zod` | Validacao e tipagem de schemas                 |
| `vitest`                            | Framework de testes isolado (node environment) |

## Referencias

- `docs/decisions/ADR-0001-repo-structure.md` — decisao de monorepo e fronteiras de modulos
- `apps/api/CLAUDE.md` — contexto operacional do modulo
- `CLAUDE.md` — regras obrigatorias e diretriz para alteracoes
- `docs/decisions/relatorio-reconhecimento.md` — estado atual do repositorio
