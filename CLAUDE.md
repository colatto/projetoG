# Contexto do Projeto

## Objetivo

Construir uma aplicacao web para a GRF com:

- portal do fornecedor;
- backoffice interno;
- workflow de cotacao;
- follow-up logistico;
- gestao de avarias;
- dashboards;
- integracao com Sienge.

## Fonte de verdade

- Produto e regras de negocio: `PRDGlobal.md`
- Arquitetura inicial: `docs/architecture.md`
- Decisao de estrutura do repositorio: `docs/decisions/ADR-0001-repo-structure.md`
- Identidade visual e assets oficiais: `docs/identidade_visual.md`
- Paleta de cores de referencia para o frontend: `docs/paleta_de_cores.md`
- PRDs filhos por modulo: `docs/prd/` (9 documentos, prd-01 a prd-09) <!-- atualizado -->
- Varredura e reconhecimento do repositorio: `docs/decisions/relatorio-reconhecimento.md` <!-- atualizado -->
- Framework do backend: `docs/decisions/ADR-0002-backend-framework.md` (Fastify v5) <!-- atualizado -->
- Gerenciador de workspace: `docs/decisions/ADR-0003-workspace-manager.md` (pnpm) <!-- atualizado -->
- Runtime e framework de workers: `docs/decisions/ADR-0004-workers-runtime.md` (Node.js + pg-boss) <!-- atualizado -->

## Regras obrigatorias

- Regras criticas ficam no backend e no dominio compartilhado, nunca no frontend.
- O Sienge e a fonte principal de verdade dos dados operacionais mestres.
- Nenhuma resposta de cotacao volta ao Sienge sem aprovacao manual de `Compras`.
- Integracoes precisam de idempotencia, retry, rastreabilidade e reprocessamento.
- O sistema deve manter trilha de auditoria persistida.
- O frontend nao implementa autorizacao critica nem logica de integracao.

## Modulos esperados

- `apps/web`: portal do fornecedor e backoffice com Vite e deploy principal na Vercel.
- `apps/api`: API dedicada, autenticacao, webhooks e orquestracao.
- `supabase/`: configuracoes de banco, autenticacao e operacao de dados.
- `workers/`: processamento assincrono para follow-up, polling, retry e reprocessamento.
- `packages/domain`: entidades, status, regras e casos de uso.
- `packages/integration-sienge`: clientes e adaptadores do ERP.
- `packages/shared`: tipos compartilhados, contratos e utilitarios.

## Perfis oficiais

- `Fornecedor`
- `Compras`
- `Administrador`
- `Visualizador de Pedidos`

## Entidades centrais

- cotacao
- resposta de cotacao
- fornecedor
- pedido
- entrega
- avaria
- notificacao
- auditoria
- evento de integracao
- usuario interno

## Identificadores minimos persistidos

- `purchaseQuotationId`
- `supplierId`
- `negotiationId` ou `negotiationNumber`
- `purchaseOrderId`
- `purchaseOrderItemNumber`
- `purchaseQuotationItemId`
- `sequentialNumber`
- `invoiceItemNumber`
- `creditorId` quando homologado

## Diretriz para alteracoes

Antes de criar codigo novo, verificar se a mudanca impacta:

- contratos com Sienge;
- rastreabilidade e auditoria;
- RBAC;
- isolamento de dados por fornecedor;
- sincronizacao assincrona e reprocessamento;
- fronteira entre Vercel, API dedicada, Supabase e workers;
- criterios de aceite macro do PRD.

### Proibicoes absolutas para agentes <!-- atualizado -->

- NAO implementar logica de autorizacao critica no frontend.
- NAO escrever dados no Sienge sem aprovacao previa do perfil `Compras`.
- NAO criar entidades ou tabelas sem correspondencia com o dominio definido em `packages/domain`.
- NAO duplicar regras de negocio entre frontend, API e workers — a camada de dominio e a fonte.
- NAO ignorar idempotencia em integracao com o Sienge — toda chamada de escrita deve ser reprocessavel.
- NAO criar novos perfis de acesso sem atualizacao do RBAC em `apps/api` e `packages/domain`.
- NAO remover trilha de auditoria de eventos criticos (cotacao, aprovacao, avaria, integracao).

## Diretriz visual minima

- o favicon oficial do projeto e `src/assets/faviconGRF.png`;
- a logo oficial do projeto e `src/assets/GRFlogo.png`;
- qualquer mudanca de branding deve atualizar `docs/identidade_visual.md`.

## Convencoes de codigo <!-- atualizado -->

- Linguagem: TypeScript estrito em todos os modulos (`strict: true`).
- Nomenclatura de arquivos: kebab-case para arquivos e diretorios; PascalCase para componentes React e classes.
- Nomenclatura de variaveis e funcoes: camelCase.
- Nomenclatura de tipos e interfaces: PascalCase com prefixo `I` opcional para interfaces.
- Imports: absolutos com alias de modulo quando o monorepo estiver configurado; relativos apenas dentro do mesmo modulo.
- Idioma do codigo: ingles para identificadores, comentarios e mensagens tecnicas; portugues para mensagens de usuario na UI.
- Commit: convencional (feat, fix, chore, docs, refactor, test).
- Libs preferidas: [VERIFICAR] — confirmar na inicializacao do monorepo.

## Variaveis de ambiente esperadas <!-- atualizado -->

As variaveis abaixo sao esperadas com base na stack definida. Os valores exatos devem ser confirmados na inicializacao.

### `apps/web` (frontend)

- `VITE_SUPABASE_URL` — URL publica do projeto Supabase (projeto `dbGRF`)
- `VITE_SUPABASE_ANON_KEY` — chave publica (anon key) do Supabase
- `VITE_API_BASE_URL` — endereco base da API dedicada em `apps/api` [VERIFICAR]

### `apps/api` (backend)

- `SUPABASE_URL` — URL do projeto Supabase (projeto `dbGRF`)
- `SUPABASE_SERVICE_ROLE_KEY` — chave de servico do Supabase para operacoes privilegiadas
- `SIENGE_BASE_URL` — URL base da API do Sienge
- `SIENGE_API_KEY` ou `SIENGE_TOKEN` — credencial de acesso ao Sienge
- `JWT_SECRET` — segredo para verificacao de tokens internos
- `PORT` — porta de execucao da API

### `workers/`

- `SUPABASE_URL` — mesma instancia da API
- `SUPABASE_SERVICE_ROLE_KEY` — chave de servico
- `SIENGE_BASE_URL` — mesma instancia da API [VERIFICAR]
- `SIENGE_API_KEY` — mesma instancia da API [VERIFICAR]
- `DATABASE_URL` — string de conexao direta ao PostgreSQL, necessaria para inicializacao do pg-boss.

> `.env.example` criado na raiz com todas as variaveis documentadas por modulo.

## Projeto Supabase provisionado <!-- atualizado -->

- Nome: `dbGRF`
- Project ID: `lkfevrdhofxlmwjfhnru`
- Regiao: `sa-east-1` (South America — Sao Paulo)
- Estado: ativo, banco PostgreSQL 17 vazio.
- Referencia completa: `docs/decisions/relatorio-reconhecimento.md`

## Contexto de testes <!-- atualizado -->

- **Framework:** Vitest — para frontend (`apps/web`) e API (`apps/api`) via `fastify.inject()`.
- Localizacao: arquivos `.test.ts` ou `.spec.ts` co-localizados com o codigo de producao, ou em subpastas `__tests__/`.
- Padrao: testes unitarios para `packages/domain`; testes de integracao para `apps/api`; testes de componente para `apps/web`.
- Cobertura minima: [VERIFICAR] — definir na inicializacao.
- Comando: `pnpm -r run test`

## Comandos essenciais <!-- atualizado -->

Os comandos abaixo assumem os pacotes `@projetog/` instalados via workspace (ADR-0003):

| Acao | Comando |
|---|---|
| Instalar dependencias | `pnpm install` |
| Iniciar frontend (dev) | `pnpm --filter @projetog/web dev` |
| Iniciar API (dev) | `pnpm --filter @projetog/api dev` |
| Iniciar workers (dev) | `pnpm --filter @projetog/workers dev` |
| Build frontend | `pnpm --filter @projetog/web build` |
| Build API | `pnpm --filter @projetog/api build` |
| Build workers | `pnpm --filter @projetog/workers build` |
| Testes (todos os modulos) | `pnpm -r run test` |
| Lint (todos os modulos) | `pnpm -r run lint` |
| Autenticar Supabase | `pnpm run db:login` |
| Ligar Supabase | `pnpm run db:link` |
| Migracoes (Supabase) | `pnpm run db:push` |
| Deploy frontend | Vercel via CI/CD [VERIFICAR] |
| Adicionar dep a um modulo | `npx pnpm --filter <modulo> add <pacote>` |
| Adicionar devDep global | `npx pnpm add -D <pacote> -w` |

> As estruturas base dos diretórios já foram inicializadas. Consultar `docs/runbooks/setup.md` para as etapas faltantes.
