# Gemini Instruction Guardrails — projetoG

Este documento e a referencia canonica para agentes Gemini atuando neste repositorio. O objetivo dele e fazer o Gemini seguir rigorosamente o que ja foi definido pelo Claude, sem reinterpretar arquitetura, escopo ou fronteiras do sistema.

Leia este arquivo inteiro antes de executar qualquer tarefa. Em caso de conflito, siga a ordem de precedencia definida abaixo.

---

## 1. Ordem de precedencia obrigatoria

Quando houver duvida, consulte os documentos nesta ordem:

1. `PRDGlobal.md`
2. `CLAUDE.md`
3. `docs/architecture.md`
4. `docs/decisions/ADR-0001-repo-structure.md`
5. `docs/decisions/ADR-0002-backend-framework.md`
6. `docs/decisions/ADR-0003-workspace-manager.md`
7. `docs/decisions/ADR-0004-workers-runtime.md`
8. `docs/decisions/fronteira-integracao.md`
9. `docs/decisions/relatorio-reconhecimento.md`
10. `docs/prd/` (PRDs filhos por modulo)
11. `apps/web/CLAUDE.md`
12. `apps/api/CLAUDE.md`
13. `packages/domain/CLAUDE.md`
14. `packages/integration-sienge/CLAUDE.md`
15. `packages/shared/CLAUDE.md`
16. `docs/identidade_visual.md`
17. `docs/paleta_de_cores.md`
18. `docs/runbooks/setup.md`
19. `.claude/settings.json`

Se dois documentos parecerem conflitar, nao invente conciliacao. Priorize o de maior precedencia e registre a divergencia na resposta.

---

## 2. Estado real do repositorio

Este repositorio ja teve o seu Workspace inicializado, mas os dominios continuam sem implementacao funcional.

- O monorepo foi inicializado com `pnpm`.
- Existe `package.json` raiz e manifestos em cada submódulo.
- Existe `pnpm-workspace.yaml` criado e interligando os projetos.
- O frontend (`apps/web`) possui o scaffold completo de React/Vite com roteamento, design system (Vanilla CSS) e o módulo de Autenticação/Backoffice implementado. Módulos de domínio operacionais (como cotações) ainda não estão construídos.
- O backend (`apps/api`) possui o scaffold inicial do framework (Fastify v5 + Zod + Vitest), configurado como ECMAScript Module e pronto para orquestracao.
- O modulo de processamento assincrono (`workers/`) possui o scaffold inicial (Node.js + pg-boss + TypeScript), com os handlers registrados, porem sem regras de negocio de polling/reconciliacao implementadas.
- O diretório `supabase/` está inicializado, autenticado e linkado ao projeto real via CLI. O modelo relacional base e os gatilhos para a V1.0 foram criados via migração inicial e a infraestrutura de Autenticação/Auditoria foi estabilizada através de migrações sequenciais.
- Os tipos do Supabase (database.types.ts) estão gerados no pacote `packages/shared`.
- Foram implementadas as rotas definitivas de Autenticação e Gestão de Usuários (CRUD administrativo) e RBAC no backend (`apps/api`), bem como a criação das entidades correspondentes no Domínio. Com as Sprints A e B completas, a Fase 3 do PRD-01 (Backend) está concluída.
- Foi implementado o pacote de Autenticação e Gestão de Usuários no frontend (`apps/web`). A **Sprint C** foi concluída com as interfaces, rotas em react-router, context API e wrappers Axios, utilizando Vanilla CSS integrado com a Identidade Visual do projeto (Fases 4 e 5). O ecossistema auth + contas administrativas está operante.
- O pacote de integração (`packages/integration-sienge`) possui a infraestrutura base de cliente HTTP isolada e resiliente implementada (Axios + Retry + Mascaramento), exportada para consumo por `apps/api` e `workers/`.
  Consequencia pratica:

- nao assumir que algo ja existe;
- nao referenciar arquivos, comandos ou estruturas como se ja estivessem inicializados;
- antes de propor ou escrever codigo, verificar se isso respeita a ordem de setup em `docs/runbooks/setup.md`.

---

## 3. Missao do produto

O produto e uma aplicacao web da GRF para:

- portal do fornecedor;
- backoffice interno;
- fluxo de cotacao;
- follow-up logistico;
- gestao de avarias;
- dashboards;
- integracao com Sienge.

Principios inviolaveis:

- o Sienge e a fonte principal de verdade dos dados operacionais mestres;
- nenhuma resposta de cotacao volta ao Sienge sem aprovacao manual de `Compras`;
- o sistema local persiste controle operacional, excecoes, auditoria e rastreabilidade;
- toda integracao externa precisa ser idempotente, rastreavel e reprocessavel;
- o frontend nunca concentra regra critica de negocio, autorizacao critica ou integracao direta com o Sienge.

---

## 4. Arquitetura e fronteiras que o Gemini deve respeitar

### Monorepo

O repositorio foi definido como monorepo com estas fronteiras:

- `apps/web`: SPA em React + TypeScript + Vite, deploy principal na Vercel;
- `apps/api`: backend dedicado em TypeScript com Fastify v5;
- `supabase/`: artefatos de plataforma de dados, auth e suporte operacional;
- `workers/`: jobs e processamento assincrono em Node.js + TypeScript com `pg-boss`;
- `packages/domain`: regras de negocio, entidades, enums, validacoes e casos de uso;
- `packages/integration-sienge`: adaptadores e clientes de integracao;
- `packages/shared`: tipos, contratos e utilitarios compartilhados.

### Regra de ouro de distribuicao de logica

- regra de negocio operacional nasce em `packages/domain` ou e orquestrada por ela;
- `apps/api` aplica RBAC, autenticacao, auditoria, webhooks e fluxos sincronos;
- `workers/` executa polling, retry, reconciliacao e follow-up fora do ciclo HTTP;
- `packages/shared` nao pode virar deposito de regra de negocio complexa;
- `apps/web` apenas apresenta estados e envia comandos ao backend.

### Proibicoes arquiteturais

- nao mover regra critica para frontend;
- nao usar Supabase como substituto da API dedicada para orquestracao de negocio;
- nao duplicar regra entre `apps/web`, `apps/api`, `workers/` e `packages/domain`;
- nao criar integracao com Sienge fora de `packages/integration-sienge`;
- nao inventar nova camada sem decisao arquitetural explicita.

---

## 5. Stack definida

- frontend: React + TypeScript + Vite;
- backend: Fastify v5 em TypeScript;
- persistencia e identidade: Supabase Postgres + Supabase Auth;
- jobs e scheduling: Node.js + TypeScript + `pg-boss`;
- workspace manager: `pnpm`;
- idioma do repositorio: portugues para documentacao e UI; ingles para identificadores, comentarios e mensagens tecnicas de codigo.

Antes de sugerir tecnologia adicional, valide se ela realmente e necessaria e se nao conflita com as ADRs ja aceitas.

---

## 6. Estado de negocio que nao pode ser distorcido

Perfis oficiais do sistema:

- `Fornecedor`
- `Compras`
- `Administrador`
- `Visualizador de Pedidos`

Entidades centrais:

- cotacao;
- resposta de cotacao;
- fornecedor;
- pedido;
- entrega;
- avaria;
- notificacao;
- auditoria;
- evento de integracao;
- usuario interno.

> **Nota de implementacao:** a entidade `users` do PRD-01 foi implementada como tabela `profiles` no banco (`public.profiles`), vinculada diretamente a `auth.users(id)`. Toda referencia do PRD a "tabela users" corresponde a `profiles` no schema real. A API e o frontend já consomem `profiles` de forma consistente.

Identificadores minimos persistidos:

- `purchaseQuotationId`
- `supplierId`
- `negotiationId` ou `negotiationNumber`
- `purchaseOrderId`
- `purchaseOrderItemNumber`
- `purchaseQuotationItemId`
- `sequentialNumber`
- `invoiceItemNumber`
- `creditorId` quando homologado

Nunca proponha modelagem que elimine esses identificadores sem justificativa formal.

---

## 7. Regras obrigatorias para qualquer implementacao

- toda alteracao deve considerar contratos com Sienge, auditoria, RBAC, isolamento por fornecedor, sincronizacao assincrona e reprocessamento;
- toda acao critica precisa deixar trilha de auditoria persistida;
- toda escrita em integracao deve prever idempotencia e retry;
- webhooks sao gatilhos de sincronizacao, nao substitutos da leitura detalhada por API;
- jobs de longa duracao nao devem depender de funcoes serverless curtas;
- fornecedores acessam apenas os proprios dados;
- apenas `Compras` aprova resposta de cotacao para retorno ao Sienge;
- apenas `Administrador` gere acessos e parametrizacoes;
- o fornecedor nunca aprova a propria resposta nem a propria sugestao de nova data.

---

## 8. Proibicoes absolutas

- NAO implementar autorizacao critica no frontend.
- NAO escrever dados no Sienge sem aprovacao previa de `Compras`.
- NAO criar entidades, tabelas ou fluxos fora do dominio definido sem atualizar `packages/domain`.
- NAO duplicar regras de negocio entre camadas.
- NAO ignorar idempotencia em integracoes com o Sienge.
- NAO criar novos perfis de acesso sem atualizar RBAC e dominio.
- NAO remover ou enfraquecer trilha de auditoria.
- NAO assumir que o repositorio esta inicializado quando ele ainda nao esta.
- NAO reutilizar artefatos do projeto legado `dbOrion` para este produto sem validacao explicita.

---

## 9. Diretrizes por modulo

### `apps/web`

- SPA em portugues do Brasil;
- responsiva para desktop e mobile;
- consumir contratos filtrados pelo backend;
- nao conter regra critica nem integracao direta com Sienge;
- usar branding e paleta definidos em `docs/identidade_visual.md` e `docs/paleta_de_cores.md`.

### `apps/api`

- Fastify v5; <!-- ADR-0002: Fastify escolhido sobre Hono e Express -->
- responsavel por autenticacao, RBAC, webhooks, auditoria e orquestracao;
- pode disparar jobs para workers;
- deve ser testavel por `fastify.inject()`;
- **nao deve ser modelada como apenas funcao serverless curta** — o produto exige polling, retries e reconciliacao de longa duracao; <!-- ADR-0002: deploy na Vercel como funcao serverless nao e o caso de uso otimizado -->
- estrutura interna esperada (ADR-0002):
  ```
  apps/api/src/
  ├── server.ts   # inicializa instancia Fastify e registra plugins
  ├── app.ts      # factory exportavel para fastify.inject() em testes
  ├── routes/     # rotas agrupadas por modulo de dominio
  ├── plugins/    # plugins globais (auth, cors, helmet, sensible)
  ├── hooks/      # lifecycle hooks (RBAC, auditoria)
  └── schemas/    # JSON Schemas de request/response compartilhados
  ```

### `packages/domain`

- fonte principal das regras operacionais;
- manter entidades, enums, validacoes e casos de uso independentes de framework.

### `packages/integration-sienge`

- concentrar clientes HTTP, mapeadores, retry, idempotencia e rastreabilidade;
- ser reutilizavel por `apps/api` e `workers/`.

### `packages/shared`

- apenas tipos, schemas, contratos e utilitarios compartilhados;
- nao carregar regra complexa.

### `workers/`

- processo standalone em Node.js + TypeScript;
- usar `pg-boss` sobre PostgreSQL;
- concentrar polling, follow-up, retries e reconciliacao.

---

## 10. Convencoes de implementacao

- usar TypeScript estrito em todos os modulos;
- arquivos e diretorios em `kebab-case`;
- componentes React e classes em `PascalCase`;
- funcoes e variaveis em `camelCase`;
- preferir imports absolutos por alias quando o monorepo estiver configurado;
- usar ingles para identificadores e comentarios tecnicos;
- usar portugues para mensagens de interface;
- seguir commits convencionais: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`;
- **Formatação de Código**: O projeto usa **Prettier** unificado na raiz do workspace.
- **Lint**: O monorepo usa **ESLint 9 (Flat Config)** por workspace, executado **no contexto do pacote/app correspondente** e integrado ao `eslint-config-prettier` quando aplicavel. <!-- ADR-0003: o comando global pnpm -r run lint chama o lint de cada workspace individualmente, garantindo isolamento de config -->
- **Pre-commit**: O monorepo possui **Husky** e **Lint-Staged** configurados na raiz. Commits na linha de comando corrigem a formatação e despacham o lint automaticamente para o workspace correto.
- **Integração Contínua (CI)**: Pipeline ativa via **GitHub Actions** (`.github/workflows/ci.yml`) que barra Pull Requests que fujam aos testes, lints ou build.
- **Execucao de binarios**: usar `pnpm dlx` no lugar de `npx` para nao quebrar o `pnpm-lock.yaml`. <!-- ADR-0003: misturar npm/npx com pnpm quebra o lockfile -->

Sempre marcar incertezas ainda nao homologadas com `[VERIFICAR]` quando estiver documentando algo ainda nao confirmado.

---

## 11. Branding e identidade visual

Referencias oficiais atuais:

- favicon: `src/assets/faviconGRF.png`
- logo: `src/assets/GRFlogo.png`

Paleta oficial:

- `#324598` azul escuro;
- `#465EBE` azul medio;
- `#19B4BE` turquesa;
- `#6ED8E0` azul claro;
- `#FFFFFF` branco.

Qualquer mudanca de branding deve refletir `docs/identidade_visual.md`.

---

## 11b. Funcionalidades fora do escopo da V1.0 <!-- relatorio-reconhecimento §out of scope -->

As seguintes funcionalidades estao explicitamente excluidas da V1.0. O Gemini nao deve implementa-las nem sugerir sua adicao sem instrucao explicita:

- Alteracao automatica de data planejada no Sienge a partir de sugestao do fornecedor.
- Auto cadastro de fornecedor.
- Ativacao autonoma de credenciais sem acao do Administrador.
- Envio de anexos/documentos pelo fornecedor.
- Exposicao de propostas concorrentes entre fornecedores.
- Automacoes financeiras, fiscais ou contabeis alem do uso logistico de NF.
- Regua separada por parcela de entrega do mesmo item.
- Politicas avancadas de seguranca alem do minimo operacional.
- Notificacao por WhatsApp (planejado para V2.0).

---

## 12. Workflow esperado do agente Gemini

Antes de agir:

1. ler `CLAUDE.md` da raiz;
2. ler o `CLAUDE.md` do modulo afetado, se existir;
3. se a mudanca afetar o backend (`apps/api`), ler `ADR-0002-backend-framework.md`; <!-- ADR-0002: entrypoint, dependencias e restricoes de deploy -->
4. se a mudanca afetar o workspace ou scripts, ler `ADR-0003-workspace-manager.md`; <!-- ADR-0003: pnpm dlx, lockfile, filtros -->
5. se a mudanca afetar workers ou jobs, ler `ADR-0004-workers-runtime.md`; <!-- ADR-0004: pg-boss, variaveis de ambiente, restricoes de Edge Functions -->
6. se a mudanca envolver distribuicao de logica entre API/workers/Supabase, ler `docs/decisions/fronteira-integracao.md`;
7. validar o impacto em dominio, auditoria, RBAC, integracao e reprocessamento;
8. checar se a mudanca respeita as ADRs e o estado atual do repositorio;
9. se o tema envolver regras de produto, consultar `PRDGlobal.md` e os PRDs filhos correspondentes.

Durante a execucao:

- manter as mudancas minimas e coerentes com a fase atual do projeto;
- explicitar premissas quando algo ainda depender de homologacao com o Sienge;
- nao inventar infraestrutura fora do que ja foi decidido;
- se encontrar ambiguidade real, registrar a duvida em vez de mascarar com suposicoes fortes.

Antes de encerrar:

- confirmar se a mudanca respeita arquitetura, dominio e auditoria;
- confirmar se nao houve deslocamento indevido de regra para frontend;
- confirmar se nao houve duplicacao de regra em mais de uma camada;
- confirmar se todos os arquivos correlatos impactados pela mudanca foram atualizados para manter consistencia de contratos, tipos, documentacao, configuracoes, testes e padroes do repositorio;
- confirmar se a documentacao precisa ser atualizada junto com o codigo.

---

## 13. Ambiguidades e lacunas que o Gemini deve tratar com cuidado

O relatorio de reconhecimento registra que varias validacoes ainda dependem de homologacao com o Sienge. Logo:

- o mapeamento `supplierId` -> `creditorId` foi **confirmado** como direto (validacao V5, 30/30, 100%); <!-- validado 2026-04-10 -->
- nao assumir comportamento final dos webhooks antes da homologacao;
- nao assumir detalhes finais de payloads de escrita ou leitura ainda nao testados;
- nao fechar decisoes de infraestrutura que ja estao definidas como `[VERIFICAR]` sem evidencia nova.

Quando necessario, use linguagem explicita:

- "definido";
- "planejado";
- "ainda nao implementado";
- "depende de homologacao";
- "`[VERIFICAR]`".

---

## 14. Comandos e operacao

O workspace pnpm ja foi inicializado. Os comandos de referencia sao:

<!-- ADR-0003: usar sempre pnpm; pnpm dlx substitui npx; misturar npm/yarn quebra o pnpm-lock.yaml -->

| Acao                      | Comando                                 |
| ------------------------- | --------------------------------------- |
| Instalar dependencias     | `pnpm install`                          |
| Iniciar frontend (dev)    | `pnpm --filter @projetog/web dev`       |
| Iniciar API (dev)         | `pnpm --filter @projetog/api dev`       |
| Iniciar workers (dev)     | `pnpm --filter @projetog/workers dev`   |
| Build frontend            | `pnpm --filter @projetog/web build`     |
| Build API                 | `pnpm --filter @projetog/api build`     |
| Build workers             | `pnpm --filter @projetog/workers build` |
| Testes (todos os modulos) | `pnpm -r run test`                      |
| Lint (todos os modulos)   | `pnpm -r run lint`                      |
| Format (todos os modulos) | `pnpm run format`                       |
| Autenticar Supabase       | `pnpm run db:login`                     |
| Ligar Supabase            | `pnpm run db:link`                      |
| Migracoes (Supabase)      | `pnpm run db:push`                      |
| Adicionar dep a um modulo | `pnpm --filter <modulo> add <pacote>`   |
| Adicionar devDep global   | `pnpm add -D <pacote> -w`               |

Importante:

- trate esses comandos como alvo de arquitetura;
- apesar do workspace estar operante, a logica interna dos domínios ainda nao esta desenvolvida.

---

## 15. Regra final de comportamento

Se o Claude ja definiu algo neste repositorio, o Gemini nao deve redesenhar por conta propria.

O papel do Gemini aqui e:

- seguir as fontes de verdade existentes;
- preservar a arquitetura decidida;
- implementar ou documentar sem contradizer os guardrails;
- apontar lacunas reais em vez de preench-las com invencao.

Se houver qualquer duvida entre "ser criativo" e "ser aderente", escolha aderencia.
