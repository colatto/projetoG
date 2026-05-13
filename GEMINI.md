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
19. `docs/runbooks/typecheck-and-supabase-types.md`
20. `.claude/settings.json`

Se dois documentos parecerem conflitar, nao invente conciliacao. Priorize o de maior precedencia e registre a divergencia na resposta.

---

## 2. Estado real do repositorio

O repositorio ja ultrapassou a fase de scaffold. Possui implementacao funcional em multiplos dominios.

- O monorepo foi inicializado com `pnpm`.
- Existe `package.json` raiz e manifestos em cada submódulo.
- Existe `pnpm-workspace.yaml` criado e interligando os projetos.
- O frontend (`apps/web`) possui React/Vite com roteamento, design system (Vanilla CSS), módulo de Autenticação/Backoffice implementado (com suporte a convites e redefinição de senha via dual token JWT/OTP e componente `PasswordResetRedirect`), gestão administrativa de usuários, monitoramento de eventos de integração, o fluxo de cotações (backoffice e portal do fornecedor) com listagem, detalhe, envio e resposta, telas de gestão de templates e histórico de notificações (PRD-03), listagem e detalhe de pedidos (backoffice e portal do fornecedor, PRD-05), follow-up logístico com listagem, detalhe, aprovação de datas e ações de fornecedor (PRD-04), gestão de avarias com registro, sugestão, decisão, reposição, badges coloridos e timeline de auditoria (PRD-06), e dashboards analíticos em `/admin/dashboard/*` com gráficos de evolução (PRD-08).
- O backend (`apps/api`) possui Fastify v5 com JWT, RBAC, CRUD de usuários (com proteção contra RLS silencioso e cleanup de auth user órfão), redefinição de senha com dual token e auto-ativação de convites, `config/frontend-url.ts` para centralização de `FRONTEND_URL`, webhooks Sienge, endpoints de integração (eventos, credenciais, negociação outbound), o fluxo completo de cotações (backoffice: listagem, detalhe, envio, revisão de resposta, retry de integração; fornecedor: listagem, detalhe, marcação de leitura, resposta), módulo de entregas com validação e listagem pendente (PRD-05), módulo de pedidos com listagem, detalhes de entregas, cancelamento, histórico de status e recepção de avaria/reposição (PRD-05), módulo de notificações por e-mail com templates editáveis, logs de envio e provedor Resend (PRD-03), módulo de follow-up logístico com listagem, detalhe, confirmação de prazo, sugestão/aprovação/reprovação de nova data e histórico de notificações (PRD-04), módulo de avarias com registro, sugestão, resolução, reposição, cancelamento de reposição, listagem, detalhe e auditoria completa com 11 eventos (PRD-06), e endpoints de leitura do dashboard em `/api/dashboard/*` (PRD-08). Swagger UI condicionado a `HOSTINGER_BUNDLE !== '1'`.
- O modulo de processamento assincrono (`workers/`) possui pg-boss com jobs especializados de polling (cotações, pedidos, entregas), reconciliação por webhook, processamento de webhook, escrita outbound de negociação, retry de integração, follow-up scheduler diário com régua de notificações, detecção de atraso e encerramento automático (PRD-04), verificação automática de expiração de cotações, recálculo automático de status de pedido via `OrderStatusEngine` com sinalização de follow-up (PRD-05), job de envio de e-mail de notificação (`notification:send-email`) com alerta de cotação sem resposta (PRD-03), confirmação automática de reposição entregue via delivery sync (PRD-06), e job `dashboard:consolidation` que grava snapshots PRD-08 em transação PostgreSQL.
- O diretório `supabase/` está inicializado, autenticado e linkado ao projeto real via CLI. O modelo relacional inclui migrações cobrindo schema inicial, autenticação, integração Sienge (PRD-07), respostas de cotação versionadas (PRD-02), hardening PRD-02, PRD-05 (delivery*records, order_status_history, campos calculados em purchase_orders), PRD-03 (notification_templates, notification_logs com enums notification_type e notification_status), PRD-04 (extensão de follow_up_trackers, follow_up_date_changes, business_days_holidays, 4 novos tipos de notificação com templates seed), PRD-06 (extensão de damages, damage_replacements, damage_audit_logs com RLS, constraints e índices), PRD-08 (tabelas `dashboard*\*`) e PRD-09 (colunas operacionais em `audit_logs`: summary, actor_type, event_timestamp, purchase_quotation_id, purchase_order_id, supplier_id + índices).
- Os tipos do Supabase (`database.types.ts`) estão gerados no pacote `packages/shared`.
- O pacote de integração (`packages/integration-sienge`) possui cliente HTTP com retry, rate limit (bottleneck), paginação, 6 clientes especializados (quotation, creditor, order, invoice, delivery-requirement, negotiation), 5 mapeadores, criptografia AES para credenciais, testes unitários + integração live, e 8 scripts de homologação §17 (7 readonly + 1 runner consolidado `homologation-checklist.integration.ts`).
- O pacote de domínio (`packages/domain`) possui entidades, enums centrais (`OrderOperationalStatus`, `NotificationType`, `NotificationStatus`, `UserRole`, `DamageStatus`, `DamageAction`, `DamageReplacementStatus`, `DamageReplacementScope`, etc.), `OrderStatusEngine` com regras de precedência de status, `TemplateRenderer` para renderização e validação de templates de notificação (PRD-03), enums PRD-04 (`FOLLOWUP_REMINDER`, `OVERDUE_ALERT`, `CONFIRMATION_RECEIVED`, `NEW_DATE_PENDING`), e testes unitários.
- Deploy de API e workers documenta-se como bundles Node 20 (Hostinger «Setup Node.js App»); frontend (`apps/web`) deploya na **Vercel** em `grf.ruatrez.com` com dois `vercel.json` — [`vercel.json`](vercel.json) na raiz (config primária com `buildCommand`/`outputDirectory`) e [`apps/web/vercel.json`](apps/web/vercel.json) (SPA rewrite catch-all + headers de segurança); GitHub Actions cobre CI, artefactos opcionais de bundle e segurança.
- O scaffold residual em `apps/` raiz (package.json "temp", vite.config.ts, etc.) foi removido; `apps/` agora contém apenas `api/` e `web/`.
- CORS da API configurável via `CORS_ALLOWED_ORIGINS` (lista separada por vírgula); em desenvolvimento mantém `origin: '*'` como fallback.

Consequencia pratica:

- o repositorio ja possui implementacao funcional em auth, usuarios, integracao Sienge, fluxo de cotacoes, fluxo de entregas/pedidos (PRD-05), notificacoes por e-mail (PRD-03), follow-up logistico (PRD-04), gestao de avarias com acao corretiva (PRD-06), dashboards consolidados (PRD-08) e auditoria operacional centralizada com `AuditService` (PRD-09);
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

- `apps/web`: SPA em React + TypeScript + Vite, deploy na **Vercel** (`grf.ruatrez.com`);
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

- frontend: React + TypeScript + Vite + Recharts (graficos PRD-08);
- backend: Fastify v5 em TypeScript;
- persistencia e identidade: Supabase Postgres + Supabase Auth;
- jobs e scheduling: Node.js + TypeScript + `pg-boss`;
- transacoes atomicas em workers: `pg` (^8.11.3) para escrita de snapshots PRD-08 via `BEGIN`/`COMMIT`/`ROLLBACK`;
- workspace manager: `pnpm`;
- observabilidade: `prom-client` (metricas) em API e workers;
- idioma do repositorio: portugues para documentacao e UI; ingles para identificadores, comentarios e mensagens tecnicas de codigo.
- deploy em producao: **frontend** na **Vercel** em `grf.ruatrez.com` com [`vercel.json`](vercel.json) (raiz, config primária) e [`apps/web/vercel.json`](apps/web/vercel.json) (fallback); **API** e **workers** na **Hostinger «Setup Node.js App»** com bundles CJS Node 20 (`apps/api/dist/hostinger-entry.js`, `workers/dist/hostinger-entry.js`) gerados por `pnpm run build:api` / `pnpm run build:workers`, workflows opcionais `hostinger-api-bundle-artifact.yml` e `hostinger-workers-bundle-artifact.yml`, runbook `docs/runbooks/deploy-hostinger.md`; Swagger UI desabilitado em bundles Hostinger (`HOSTINGER_BUNDLE=1`).

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

> **Nota PRD-04 (atualizada 2026-04-24):** o PRD-04 (Follow-up Logístico) está implementado (Fases 1–4). Todas as 25 regras de negócio (RN-01 a RN-25) estão implementadas e verificadas. Inclui: 2 migrações de banco (extensão de `follow_up_trackers` com 12 novas colunas, `follow_up_date_changes`, `business_days_holidays`, 4 novos tipos de notificação com templates seed), enums PRD-04 no domínio, schemas Zod no shared, módulo API `followup` com 7 endpoints, worker `follow-up` scheduler diário com régua completa, utilitário `business-days.ts`, auditoria completa (8 eventos), e telas frontend completas (backoffice: FollowUpList com filtros de status/fornecedor/obra, FollowUpDetail com timeline de notificações e aprovação de datas; fornecedor: SupplierFollowUpList com indicação de avaria/reposição, SupplierFollowUpDetail com histórico de notificações, confirmação e sugestão de data). Testes: API 11, worker 5, utils 6, frontend 5 (27 total). **Correção (2026-04-24):** quatro gaps anteriormente documentados foram verificados como falsos: (1) RN-13/14 — o worker `processTracker()` **já** verifica overdue antes de checar `CONCLUIDO`, marcando como `ATRASADO` corretamente; (2) `decideDateChange('approved')` **já** usa `countBusinessDays()` e `addBusinessDays()` com suporte a feriados; (3) frontend **já** exibe histórico de notificações em `FollowUpDetail.tsx` (Timeline de Notificações) e `SupplierFollowUpDetail.tsx` (Histórico de Notificações); (4) frontend backoffice **já** possui filtros de fornecedor e obra em `FollowUpList.tsx`. Gaps reais remanescentes (não bloqueantes): (a) coluna `suggested_date` existe no schema inicial V1, mas não declarada formalmente na migração PRD-04; (b) Fase 5 (integração com Módulo 5) sem testes integrados end-to-end. _Resolvido em 2026-05-02: o gap de teste de isolamento de supplier em `listNotifications` foi fechado via `followup.routes.test.ts` (2 testes adicionais cobrindo supplier nulo 403 e supplier match 200) e `notification.routes.test.ts` (21 cenários cobrindo RBAC e filtros do PRD-03 §7.5)._

> **Nota PRD-06 (2026-04-28):** o PRD-06 (Avaria e Ação Corretiva) está implementado (Fases 1–6). Todas as 21 regras de negócio (RN-01 a RN-21) estão implementadas e verificadas. Inclui: migração `20260428150000` (extensão de `damages` com 10 colunas, tabelas `damage_replacements` e `damage_audit_logs` com RLS por fornecedor, constraints e índices), 4 enums no domínio (`DamageStatus`, `DamageAction`, `DamageReplacementStatus`, `DamageReplacementScope`), schemas Zod completos no shared, módulo API `damages` com 8 endpoints (POST criar, PATCH suggest, PATCH resolve, PATCH replacement/date, PATCH replacement/cancel, GET listar, GET detalhe, GET audit), RBAC, isolamento de fornecedor, auditoria completa com 11 eventos §10, recálculo de status de pedido (`recomputeOrderStatusFromDamages`), cancelamento total com encerramento de régua de follow-up, reinício da régua ao informar data de reposição, integração worker `sync-deliveries.ts` para confirmação automática de reposição entregue, e telas frontend (backoffice: DamageList com filtros e badges, DamageDetail com atalhos Aceitar/Recusar e auditoria; fornecedor: SupplierDamageList com badges, SupplierDamageDetail com sugestão, reposição e auditoria; compartilhado: DamageCreate). Testes: API 12, worker 1, frontend 2 (15 total).
>
> **Nota PRD-06 (2026-05-02 — lacunas 6.1 e 6.2):** `damages.routes.test.ts` cobre 404/409 de `PATCH .../replacement/cancel`, efeitos colaterais em `damage_audit_logs` / `damages` e precedência **EM_AVARIA** sobre **REPOSICAO** com múltiplas damages no mesmo pedido. `recomputeOrderStatusFromDamages` e `workers/src/utils/order-status-recalc.ts` alinham predicados ao `OrderStatusEngine` (PRD-05 §7.3). `order-status-recalc.test.ts` +2 cenários. Ver `docs/prd/prd-06-avaria-e-acao-corretiva.md` §14–§15. Contagem atualizada no escopo PRD-06: API 21 (`damages.routes.test.ts`), worker 1 (`sync-deliveries`), +2 em `order-status-recalc.test.ts`, frontend 2.

> **Nota PRD-08 (2026-04-30):** o PRD-08 (Dashboard e Indicadores) está implementado (Fases 1–4). Inclui: migração `20260429153000_prd08_dashboard_indicators.sql` (tabelas `dashboard_snapshot`, `dashboard_snapshot_por_fornecedor`, `dashboard_snapshot_por_obra`, `dashboard_criticidade_item` com RLS service_role-only), worker `dashboard:consolidation` com consolidação diária atômica via `pg.Pool` (`dashboard-snapshot-pg.ts` com `BEGIN`/`COMMIT`/`ROLLBACK`, zero `as any`, queries tipadas via `SupabaseClient<Database>`), criticidade por item (média histórica per-item, mínimo 2 amostras, RN-19), confiabilidade de fornecedor (janela 3 meses, RN-20/21/22), cron `45 10 * * *` (07:45 BRT), auditoria em `audit_logs` (`dashboard.snapshot_created`/`dashboard.consolidation_error`), controller API com 7 endpoints GET (resumo, kpis, lead-time, atrasos, criticidade, ranking-fornecedores, avarias) com RBAC Compras+Administrador, schemas Zod no shared, e telas frontend (DashboardHome com cards operacionais em paleta oficial, DashboardLeadTime/DashboardAtrasos/DashboardAvarias com gráficos Recharts, DashboardCriticidade com badges, DashboardRankingFornecedores com confiabilidade, DashboardFilters e DashboardEvolutionChart reutilizáveis, dashboard-prd.css). Dependências: `recharts` (^2.15.4) em web, `pg` (^8.11.3) + `@types/pg` em workers. Testes: 6 (3 RBAC + 3 lógica).

> **Nota PRD-09 (2026-05-03):** o PRD-09 (Backoffice, Auditoria e Operação) está a ~95% de compliance após meta-auditoria. Inclui: migração PRD-09 (colunas operacionais em `audit_logs`), `AuditService` centralizado (`audit.service.ts`) com `registerEvent()`, summary obrigatório (fallback automático via `fallbackSummary()`), enfileiramento pg-boss (`audit:retry`, retryLimit 3, retryDelay 60s) para falhas de escrita (§9.6), `try/catch` externo em `registerEvent()` para capturar exceções lançadas (e.g., erros de rede) além de respostas `{ error }` — auditoria nunca bloqueia o fluxo principal, zero inserts diretos em `audit_logs` fora de `AuditService`, aliases PRD-09 (`/api/backoffice/integrations`, `/api/backoffice/orders`, `/api/supplier-portal/orders`, `/api/backoffice/quotations`, `/api/supplier-portal/quotations`), filtro "Exigem ação" em cotações e pedidos, priorização visual RN-09, cores operacionais RN-10, trilha append-only em `GET /api/backoffice/audit`, campos mínimos §14.1 completos em OrderList (10 colunas) e SupplierOrderList (8 colunas com badges atraso/avaria), cooldown de retry em IntegrationEvents, e retenção 1 ano documentada. Gap residual: RN-13 (job de arquivamento automático), deferido para V2.0.

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
- paginas existentes: auth (login, forgot, reset com suporte a convites), admin (users CRUD, integration events, audit trail, quotation list/detail, notification templates, notification logs, order list/detail com 10 colunas §14.1, followup list/detail, damage list/detail/create, dashboard home/lead-time/atrasos/criticidade/ranking-fornecedores/avarias), supplier (quotation list/detail, order list/detail com 8 colunas e badges atraso/avaria, followup list/detail, damage list/detail/create).

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
  ├── app.ts          # factory exportável para testes (Swagger UI condicionado a HOSTINGER_BUNDLE)
  ├── config/         # configuração (frontend-url.ts: centralização de FRONTEND_URL)
  ├── routes/         # rotas gerais (health)
  ├── plugins/        # auth, supabase, pg-boss, metrics, email
  ├── modules/
  │   ├── auth/       # login, logout, forgot/reset password, me
  │   ├── users/      # CRUD administrativo
  │   ├── audit/      # serviço de auditoria centralizado (`AuditService` com summary obrigatório e fallback pg-boss)
  │   ├── webhooks/   # recebimento de webhooks Sienge
  │   ├── integration/# eventos, credenciais, negociação outbound
  │   ├── quotations/ # backoffice e fornecedor (PRD-02)
  │   ├── deliveries/ # validação de entrega e listagem pendente (PRD-05)
  │   ├── orders/     # listagem, detalhes, cancelamento, histórico de status e avaria (PRD-05)
  │   ├── notifications/ # templates, logs, envio de e-mail e NotificationService (PRD-03)
  │   ├── followup/   # listagem, detalhe, confirmação, sugestão/aprovação de datas (PRD-04)
  │   ├── damages/    # registro, sugestão, resolução, reposição, cancelamento e auditoria (PRD-06)
  │   └── dashboard/  # 7 endpoints GET de leitura de snapshots com RBAC (PRD-08)
  └── test/           # setup de testes
  ```

### `packages/domain`

- fonte principal das regras operacionais;
- manter entidades, enums, validacoes e casos de uso independentes de framework;
- inclui `OrderStatusEngine` (PRD-05) com regras de precedência de status e `OrderOperationalStatus` enum.
- inclui `NotificationType`, `NotificationStatus` enums e `TemplateRenderer` service (PRD-03) com testes unitários.
- inclui enums PRD-04: `FOLLOWUP_REMINDER`, `OVERDUE_ALERT`, `CONFIRMATION_RECEIVED`, `NEW_DATE_PENDING` em `NotificationType`.
- inclui enums PRD-06: `DamageStatus` (6 estados), `DamageAction` (3 ações), `DamageReplacementStatus` (4 estados), `DamageReplacementScope` (ITEM, PEDIDO).

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
- inclui follow-up scheduler completo `follow-up.ts` (PRD-04) com: criação automática de trackers, régua de notificações sequenciais (1 por dia útil, Compras em cópia da 2ª em diante), detecção de atraso (D+1 útil), encerramento automático por entrega/cancelamento, e utilitário `business-days.ts` para cálculo de dias úteis com feriados.
- inclui integração de confirmação automática de reposição entregue via `sync-deliveries.ts` (PRD-06): ao detectar entrega de item com reposição `EM_ANDAMENTO`, marca como `ENTREGUE`, avaria como `RESOLVIDA` e registra evento `reposicao_entregue`.
- inclui job `dashboard:consolidation` (PRD-08) com: consolidação diária de KPIs, ranking de fornecedor (confiabilidade 3 meses), criticidade por item, métricas por obra, escrita atômica via `pg.Pool` (`dashboard-snapshot-pg.ts` com `BEGIN`/`COMMIT`/`ROLLBACK`), auditoria em `audit_logs`, cron `45 10 * * *` (07:45 BRT).
- inclui queue `audit:retry` para deferred retry de eventos de auditoria enfileirados por `AuditService` quando o insert primário falha (PRD-09 §9.6).
- inclui 3 scripts de diagnóstico (`test-sienge-order.ts`, `test-sync-error.ts`, `test-upsert.ts`) para troubleshooting de sincronização Sienge (não são testes vitest; executar com `tsx`).

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
  - `hostinger-api-bundle-artifact.yml` / `hostinger-workers-bundle-artifact.yml`: `workflow_dispatch`, artefactos dos bundles `hostinger-entry.js` (alternativa a build no servidor)
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

| Acao                            | Comando                                                           |
| ------------------------------- | ----------------------------------------------------------------- |
| Instalar dependencias           | `pnpm install`                                                    |
| Iniciar frontend (dev)          | `pnpm --filter @projetog/web dev`                                 |
| Iniciar API (dev)               | `pnpm --filter @projetog/api dev`                                 |
| Iniciar workers (dev)           | `pnpm --filter @projetog/workers dev`                             |
| Build frontend                  | `pnpm --filter @projetog/web build`                               |
| Build API                       | `pnpm --filter @projetog/api build`                               |
| Build workers                   | `pnpm --filter @projetog/workers build`                           |
| Bundle API Hostinger (raiz)     | `pnpm run build:api` (gera `apps/api/dist/hostinger-entry.js`)    |
| Bundle workers Hostinger (raiz) | `pnpm run build:workers` (gera `workers/dist/hostinger-entry.js`) |
| Start bundle API (raiz)         | `pnpm run start:api`                                              |
| Start bundle workers (raiz)     | `pnpm run start:workers`                                          |
| Testes (todos os modulos)       | `pnpm -r run test`                                                |
| Lint (todos os modulos)         | `pnpm -r run lint`                                                |
| Format (todos os modulos)       | `pnpm run format`                                                 |
| Autenticar Supabase             | `pnpm run db:login`                                               |
| Ligar Supabase                  | `pnpm run db:link`                                                |
| Migracoes (Supabase)            | `pnpm run db:push`                                                |
| Gerar tipos Supabase            | `pnpm run db:types`                                               |
| Adicionar dep a um modulo       | `pnpm --filter <modulo> add <pacote>`                             |
| Adicionar devDep global         | `pnpm add -D <pacote> -w`                                         |

Consulte `docs/runbooks/typecheck-and-supabase-types.md` para as regras de manutencao dos tipos Supabase.

---

## 15. Regra final de comportamento

Se o Claude ja definiu algo neste repositorio, o Gemini nao deve redesenhar por conta propria.

O papel do Gemini aqui e:

- seguir as fontes de verdade existentes;
- preservar a arquitetura decidida;
- implementar ou documentar sem contradizer os guardrails;
- apontar lacunas reais em vez de preench-las com invencao.

Se houver qualquer duvida entre "ser criativo" e "ser aderente", escolha aderencia.
