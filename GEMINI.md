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

O repositorio ja ultrapassou a fase de scaffold. Possui implementacao funcional em multiplos dominios.

- O monorepo foi inicializado com `pnpm`.
- Existe `package.json` raiz e manifestos em cada submódulo.
- Existe `pnpm-workspace.yaml` criado e interligando os projetos.
- O frontend (`apps/web`) possui React/Vite com roteamento, design system (Vanilla CSS), módulo de Autenticação/Backoffice implementado, gestão administrativa de usuários, monitoramento de eventos de integração, o fluxo de cotações (backoffice e portal do fornecedor) com listagem, detalhe, envio e resposta, e telas de gestão de templates e histórico de notificações (PRD-03).
- O backend (`apps/api`) possui Fastify v5 com JWT, RBAC, CRUD de usuários, webhooks Sienge, endpoints de integração (eventos, credenciais, negociação outbound), o fluxo completo de cotações (backoffice: listagem, detalhe, envio, revisão de resposta, retry de integração; fornecedor: listagem, detalhe, marcação de leitura, resposta), módulo de entregas com validação e listagem pendente (PRD-05), módulo de pedidos com listagem, detalhes de entregas, cancelamento, histórico de status e recepção de avaria/reposição (PRD-05), e módulo de notificações por e-mail com templates editáveis, logs de envio e provedor Resend (PRD-03).
- O modulo de processamento assincrono (`workers/`) possui pg-boss com jobs especializados de polling (cotações, pedidos, entregas), reconciliação por webhook, processamento de webhook, escrita outbound de negociação, retry de integração, follow-up (stub), verificação automática de expiração de cotações, recálculo automático de status de pedido via `OrderStatusEngine` com sinalização de follow-up (PRD-05), e job de envio de e-mail de notificação (`notification:send-email`) com alerta de cotação sem resposta (PRD-03).
- O diretório `supabase/` está inicializado, autenticado e linkado ao projeto real via CLI. O modelo relacional inclui 13 migrações cobrindo schema inicial, autenticação, integração Sienge (PRD-07), respostas de cotação versionadas (PRD-02), hardening PRD-02, PRD-05 (delivery_records, order_status_history, campos calculados em purchase_orders) e PRD-03 (notification_templates, notification_logs com enums notification_type e notification_status).
- Os tipos do Supabase (`database.types.ts`) estão gerados no pacote `packages/shared`.
- O pacote de integração (`packages/integration-sienge`) possui cliente HTTP com retry, rate limit (bottleneck), paginação, 6 clientes especializados (quotation, creditor, order, invoice, delivery-requirement, negotiation), 5 mapeadores, criptografia AES para credenciais e testes unitários + integração live.
- O pacote de domínio (`packages/domain`) possui entidades, enums centrais (`OrderOperationalStatus`, `NotificationType`, `NotificationStatus`, `UserRole`, etc.), `OrderStatusEngine` com regras de precedência de status, `TemplateRenderer` para renderização e validação de templates de notificação (PRD-03), e testes unitários.
- Existe infraestrutura de deploy: Dockerfiles para API e workers, manifests Kubernetes em `deploy/k8s/`, e pipelines GitHub Actions para CI, deploy e segurança.

Consequencia pratica:

- o repositorio ja possui implementacao funcional em auth, usuarios, integracao Sienge, fluxo de cotacoes, fluxo de entregas/pedidos (PRD-05) e notificacoes por e-mail (PRD-03);
- antes de propor ou escrever codigo, verificar se isso respeita a ordem de setup em `docs/runbooks/setup.md`;
- consultar `CLAUDE.md` para o inventario completo de rotas, jobs e entidades ja existentes.

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
- observabilidade: `prom-client` (metricas) em API e workers;
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
- resposta de cotacao (versionada);
- fornecedor;
- pedido;
- entrega;
- avaria;
- notificacao;
- auditoria;
- evento de integracao;
- usuario interno.

> **Nota de implementacao:** a entidade `users` do PRD-01 foi implementada como tabela `profiles` no banco (`public.profiles`), vinculada diretamente a `auth.users(id)`. Toda referencia do PRD a "tabela users" corresponde a `profiles` no schema real. A API e o frontend já consomem `profiles` de forma consistente.

> **Nota PRD-02:** as respostas de cotação são versionadas em `quotation_responses` (com `quotation_response_items` e `quotation_response_item_deliveries`). O `review_status` controla o ciclo de revisão (`pending` → `approved`/`rejected`/`correction_requested`) e o `integration_status` rastreia a escrita no Sienge.

> **Nota PRD-05:** o PRD-05 (Entrega, Divergência e Status de Pedido) está implementado (Fases 1–6). Inclui: tabela `order_status_history` (append-only, RLS), campos calculados em `purchase_orders` (`total_quantity_ordered`, `total_quantity_delivered`, `pending_quantity`, `has_divergence`, `last_delivery_date`), validação de entrega (OK/DIVERGENCIA) com auditoria, `OrderStatusEngine` no domínio com precedência formal de status, cancelamento de pedido com encerramento automático de régua de follow-up, stub de recepção de avaria (PRD-06), e sinalização de follow-up tanto na API quanto nos workers.

> **Nota PRD-03:** o PRD-03 (Notificações de Cotação) está implementado (Fases 1–5). Inclui: tabelas `notification_templates` e `notification_logs` com enums `notification_type`/`notification_status` e RLS service_role-only, seed de 3 templates default (`new_quotation`, `quotation_reminder`, `no_response_alert`), enums `NotificationType`/`NotificationStatus` e `TemplateRenderer` no domínio, `NotificationService` na API com envio de nova cotação (`sendQuotationNotification`), envio tardio (`sendPendingQuotationsNotification`) e alerta de sem resposta (`sendNoResponseAlert`), `ResendEmailProvider` com plugin Fastify `email.ts`, worker job `notification:send-email` com retry, schemas Zod no shared, integração no `QuotationsController.sendQuotation`, hook de envio tardio em `UsersController.reactivate`, alerta de sem resposta via `sendNoResponseEmailAlert` no `quotation-expire-check`, telas frontend (NotificationTemplates, NotificationLogs, NotificationsLayout), e testes unitários e de integração.

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
- NAO reutilizar artefatos do projeto legado `dbOrion` para este produto sem validacao explicita.

---

## 9. Diretrizes por modulo

### `apps/web`

- SPA em portugues do Brasil;
- responsiva para desktop e mobile;
- consumir contratos filtrados pelo backend;
- nao conter regra critica nem integracao direta com Sienge;
- usar branding e paleta definidos em `docs/identidade_visual.md` e `docs/paleta_de_cores.md`;
- paginas existentes: auth (login, forgot, reset), admin (users CRUD, integration events, quotation list/detail, notification templates, notification logs), supplier (quotation list/detail).

> **Nota:** as telas de pedidos e entregas do PRD-05 (backoffice, portal do fornecedor e visualizador de pedidos) ainda não foram implementadas no frontend. Os endpoints de API já estão disponíveis.

### `apps/api`

- Fastify v5; <!-- ADR-0002: Fastify escolhido sobre Hono e Express -->
- responsavel por autenticacao, RBAC, webhooks, auditoria e orquestracao;
- pode disparar jobs para workers;
- deve ser testavel por `fastify.inject()`;
- **nao deve ser modelada como apenas funcao serverless curta** — o produto exige polling, retries e reconciliacao de longa duracao; <!-- ADR-0002: deploy na Vercel como funcao serverless nao e o caso de uso otimizado -->
- estrutura interna real:
  ```
  apps/api/src/
  ├── server.ts       # bootstrap do servidor
  ├── app.ts          # factory exportável para testes
  ├── routes/         # rotas gerais (health)
  ├── plugins/        # auth, supabase, pg-boss, metrics, email
  ├── modules/
  │   ├── auth/       # login, logout, forgot/reset password, me
  │   ├── users/      # CRUD administrativo
  │   ├── audit/      # serviço de auditoria
  │   ├── webhooks/   # recebimento de webhooks Sienge
  │   ├── integration/# eventos, credenciais, negociação outbound
  │   ├── quotations/ # backoffice e fornecedor (PRD-02)
  │   ├── deliveries/ # validação de entrega e listagem pendente (PRD-05)
  │   ├── orders/     # listagem, detalhes, cancelamento, histórico de status e avaria (PRD-05)
  │   └── notifications/ # templates, logs, envio de e-mail e NotificationService (PRD-03)
  └── test/           # setup de testes
  ```

### `packages/domain`

- fonte principal das regras operacionais;
- manter entidades, enums, validacoes e casos de uso independentes de framework;
- inclui `OrderStatusEngine` (PRD-05) com regras de precedência de status e `OrderOperationalStatus` enum.
- inclui `NotificationType`, `NotificationStatus` enums e `TemplateRenderer` service (PRD-03) com testes unitários.

### `packages/integration-sienge`

- concentrar clientes HTTP, mapeadores, retry, idempotencia e rastreabilidade;
- ser reutilizavel por `apps/api` e `workers/`.

### `packages/shared`

- apenas tipos, schemas, contratos e utilitarios compartilhados;
- nao carregar regra complexa.

### `workers/`

- processo standalone em Node.js + TypeScript;
- usar `pg-boss` sobre PostgreSQL;
- concentrar polling, follow-up, retries, reconciliacao, expire-check, recalculo de status de pedido (PRD-05) e envio de e-mail de notificacao (PRD-03);
- inclui utilitário `order-status-recalc.ts` com sinalização de follow-up.
- inclui função `sendNoResponseEmailAlert` em `operational-notifications.ts` para alerta de cotação sem resposta (PRD-03).

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
- **Integração Contínua (CI)**: Pipelines ativas via **GitHub Actions** (`.github/workflows/`):
  - `ci.yml`: format, lint, test, build em PRs e push para `main`
  - `deploy.yml`: build Docker, push para GHCR, deploy K8s em push para `main` ou manual
  - `security.yml`: `pnpm audit`, gitleaks e dependency review em PRs
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
| Gerar tipos Supabase      | `pnpm run db:types`                     |
| Adicionar dep a um modulo | `pnpm --filter <modulo> add <pacote>`   |
| Adicionar devDep global   | `pnpm add -D <pacote> -w`               |

---

## 15. Regra final de comportamento

Se o Claude ja definiu algo neste repositorio, o Gemini nao deve redesenhar por conta propria.

O papel do Gemini aqui e:

- seguir as fontes de verdade existentes;
- preservar a arquitetura decidida;
- implementar ou documentar sem contradizer os guardrails;
- apontar lacunas reais em vez de preench-las com invencao.

Se houver qualquer duvida entre "ser criativo" e "ser aderente", escolha aderencia.
