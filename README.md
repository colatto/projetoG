# projetoG

Base inicial do projeto de automacao de cotacao, follow-up logistico e integracao com Sienge descrito em `PRDGlobal.md`.

## Estrutura inicial

```text
.
├── CLAUDE.md
├── PRDGlobal.md
├── README.md
├── .env.example
├── pnpm-workspace.yaml       # gerenciador de workspace: pnpm (ADR-0003)
├── package.json              # raiz do monorepo (a criar na inicializacao)
├── pnpm-lock.yaml            # lockfile do pnpm (a criar na inicializacao)
├── apps/
│   ├── api/
│   └── web/
├── docs/
│   ├── architecture.md
│   ├── decisions/
│   ├── prd/
│   └── runbooks/
├── supabase/
├── workers/
├── packages/
│   ├── domain/
│   ├── integration-sienge/
│   └── shared/
├── tools/
│   ├── prompts/
│   └── scripts/
└── .claude/
    ├── hooks/
    ├── settings.json
    └── skills/
```

## Como esta base foi montada

- `PRDGlobal.md` continua como fonte de verdade de produto.
- `apps/web` reserva o frontend SPA em React + TypeScript com build em Vite e deploy principal na Vercel.
- `apps/api` reserva o backend dedicado em TypeScript para API interna, webhooks e orquestracao.
- `packages/domain` concentra regras de negocio e contratos internos.
- `packages/integration-sienge` concentra clientes, mapeamentos, idempotencia e reprocessamentos da integracao.
- `packages/shared` concentra tipos, utilitarios e componentes compartilhados.
- `supabase/` reserva configuracoes, migracoes e convencoes ligadas ao Supabase.
- `workers/` reserva a camada explicita de jobs e workers para polling, retries, follow-up e reprocessamentos fora do ciclo do frontend.
- `docs/` guarda arquitetura, decisoes e runbooks.
- `.claude/` guarda contexto e automacoes para assistentes de codigo.

## Stack definida

- **gerenciador de workspace:** pnpm — `pnpm-workspace.yaml` na raiz (ADR-0003);
- **frontend:** React + TypeScript + Vite em `apps/web`, com deploy principal na Vercel;
- **backend:** Fastify v5 em TypeScript em `apps/api`, servidor standalone dedicado (ADR-0002);
- **persistencia e identidade:** Supabase para PostgreSQL, autenticacao e suporte operacional (projeto `dbGRF`, `sa-east-1`);
- **integracoes e dominio:** `packages/domain` e `packages/integration-sienge`;
- **processamento assincrono:** Node.js + TypeScript standalone em `workers/`, filas e scheduling via pg-boss sobre PostgreSQL (ADR-0004).

## Qualidade de codigo

- **formatacao:** Prettier unificado na raiz do workspace;
- **lint:** ESLint 9 com Flat Config por workspace, executado no contexto de cada pacote/app;
- **pre-commit:** Husky + lint-staged na raiz para formatar arquivos staged e encaminhar o lint para o workspace correspondente.

## Proximos passos

1. ~~Escolher o gerenciador do workspace~~ **pnpm** (ADR-0003).
2. Inicializar o monorepo com `pnpm init` + `pnpm-workspace.yaml` + `package.json` por modulo.
3. Inicializar `apps/web` com Vite e preparar deploy na Vercel.
4. ~~Definir o framework do backend em `apps/api`~~ **Fastify v5** (ADR-0002).
5. Inicializar `apps/api` com Fastify e definir estrategia de deploy standalone.
6. Provisionar autenticacao no Supabase (`dbGRF`).
7. ~~Definir a estrategia de jobs e workers~~ **Node.js + pg-boss** (ADR-0004).
8. Modelar entidades e fluxos em `packages/domain`.
9. Implementar a primeira fatia vertical: autenticacao, cotacao e leitura inicial do Sienge.

## Decisoes tomadas

| #   | Decisao                        | Escolha                                      | ADR      |
| --- | ------------------------------ | -------------------------------------------- | -------- |
| 1   | Estrutura do repositorio       | Monorepo com separacao explicita por camada  | ADR-0001 |
| 2   | Framework do backend           | Fastify v5 (TypeScript, servidor standalone) | ADR-0002 |
| 3   | Gerenciador de workspace       | pnpm                                         | ADR-0003 |
| 4   | Runtime e framework de workers | Node.js + TypeScript standalone, pg-boss     | ADR-0004 |
