# Relatório de Reconhecimento do Repositório

> Gerado em: 2026-04-06
> Referência: `PRDGlobal.md` (1534 linhas, 18 seções)
> Projeto Supabase associado: `dbGRF` (`lkfevrdhofxlmwjfhnru`) — **criado em 06/04/2026, banco vazio**

---

## Stack identificada

| Camada | Tecnologia definida | Estado atual |
|---|---|---|
| **Frontend** | React + TypeScript + Vite | Apenas documentação (`apps/web/CLAUDE.md`). Nenhum `package.json`, componente ou tela criada. |
| **Backend/API** | TypeScript (API dedicada) | Apenas documentação (`apps/api/CLAUDE.md`). Nenhum servidor, rota ou controller iniciado. |
| **Banco de dados** | PostgreSQL gerenciado (Supabase) | Projeto `dbGRF` ativo em `sa-east-1`. Nenhuma tabela, migration ou seed no schema `public`. |
| **Autenticação** | Supabase Auth (e-mail/senha) | Não configurada. |
| **Domínio** | `packages/domain` — TypeScript puro | Apenas `CLAUDE.md` com subdominios esperados. Nenhuma entidade, enum ou caso de uso implementado. |
| **Integração Sienge** | `packages/integration-sienge` — clientes HTTP | Apenas `CLAUDE.md`. Nenhum adaptador, cliente ou mappeador criado. |
| **Shared** | `packages/shared` — tipos e utilitários | Apenas `CLAUDE.md`. Nenhum artefato compartilhado implementado. |
| **Workers** | Camada explícita para polling, retry, follow-up | Diretório `workers/` contém apenas `README.md`. Nenhum job ou scheduler criado. |
| **Deploy frontend** | Vercel (planejado) | Não configurado. |
| **Deploy backend** | A definir | Não definido. |
| **Monorepo** | A definir (`pnpm`, `npm` ou `yarn`) | Nenhum workspace inicializado. Sem `package.json` raiz, sem lockfile. |
| **Identidade visual** | Assets em `src/assets/` | `faviconGRF.png` (721 B) e `GRFlogo.png` (2.549 B) presentes. Paleta documentada em `docs/paleta_de_cores.md`. |

### Projeto Supabase legado (dbOrion)

Existe um segundo projeto Supabase (`dbOrion` — `jvonweijpbyyjgywlfxu`) com **16 tabelas** e **10 Edge Functions** deployadas. Este projeto pertence a um esforço anterior ("projetoX/Orion") e **não** está vinculado ao repositório `projetoG`. As tabelas e funções do dbOrion tratam de um domínio diferente (Superlógica, recibos, centros de custo) e **não são reutilizáveis** para o escopo do PRDGlobal.

---

## Estrutura do repositório

```text
projetoG/
├── CLAUDE.md                       # Contexto global para assistentes de código
├── PRDGlobal.md                    # Fonte de verdade de produto (53 KB, 18 seções)
├── README.md                       # Visão geral e próximos passos
├── .codex                          # Arquivo vazio
├── .gitignore                      # Regras básicas de exclusão
│
├── apps/
│   ├── web/                        # Frontend SPA (apenas CLAUDE.md)
│   │   └── CLAUDE.md
│   └── api/                        # Backend dedicado (apenas CLAUDE.md)
│       └── CLAUDE.md
│
├── packages/
│   ├── domain/                     # Núcleo de negócio (apenas CLAUDE.md)
│   │   └── CLAUDE.md
│   ├── integration-sienge/         # Integração com Sienge (apenas CLAUDE.md)
│   │   └── CLAUDE.md
│   └── shared/                     # Tipos e utilitários compartilhados (apenas CLAUDE.md)
│       └── CLAUDE.md
│
├── supabase/                       # Configuração Supabase (apenas README.md)
│   └── README.md
│
├── workers/                        # Jobs e processamento assíncrono (apenas README.md)
│   └── README.md
│
├── src/
│   ├── README.md                   # Nota de diretório reservado
│   └── assets/
│       ├── faviconGRF.png          # Favicon oficial
│       └── GRFlogo.png             # Logo oficial
│
├── docs/
│   ├── architecture.md             # Arquitetura inicial
│   ├── identidade_visual.md        # Identidade visual e assets
│   ├── paleta_de_cores.md          # Paleta de cores GRF
│   ├── decisions/
│   │   ├── ADR-0001-repo-structure.md  # Decisão de estrutura do repo
│   │   └── relatorio-reconhecimento.md # Este arquivo
│   └── runbooks/
│       └── setup.md                # Runbook de setup inicial
│
├── tools/
│   ├── prompts/                    # Prompts para assistentes (apenas README.md)
│   └── scripts/                    # Scripts auxiliares (apenas README.md)
│
└── .claude/
    ├── settings.json
    ├── hooks/
    └── skills/
```

### Resumo

- **8 subdiretórios** no nível raiz, **5 arquivos** na raiz.
- Nenhum arquivo de código-fonte (`.ts`, `.tsx`, `.js`, `.jsx`, `.sql`) existe no repositório.
- Nenhum `package.json`, `tsconfig.json`, `.env.example`, `docker-compose` ou lockfile existe.
- O repositório é **inteiramente documental** — não há código executável.

---

## Estado atual por módulo

Os 9 módulos funcionais do PRDGlobal são mapeados abaixo:

| # | Módulo | PRD Seções | Estado | Detalhe |
|---|--------|-----------|--------|---------|
| 1 | **Autenticação e Perfis** | §3, §11 | 🔴 Ausente | Nenhuma implementação de auth, RBAC, primeiro acesso ou gestão de usuários. Supabase Auth não configurado. |
| 2 | **Fluxo de Cotação** | §4 | 🔴 Ausente | Nenhuma entidade, endpoint, tela ou lógica de cotação implementada. |
| 3 | **Notificações de Cotação** | §5 | 🔴 Ausente | Nenhum serviço de e-mail, template ou trigger de notificação. |
| 4 | **Follow-up Logístico** | §6 | 🔴 Ausente | Nenhuma régua de cobrança, cálculo de dias úteis, cron ou scheduler implementado. |
| 5 | **Entrega, Divergência e Status de Pedido** | §7 | 🔴 Ausente | Nenhuma sincronização de pedidos/entregas, cálculo de status ou validação de divergência. |
| 6 | **Avaria e Ação Corretiva** | §8 | 🔴 Ausente | Nenhuma modelagem de avaria, reposição ou ação corretiva. |
| 7 | **Integração com Sienge** | §9 | 🔴 Ausente | Nenhum cliente HTTP, adaptador, tratamento de webhook ou lógica de reconciliação. O pacote `packages/integration-sienge` existe apenas como diretório com `CLAUDE.md`. |
| 8 | **Dashboard e Indicadores** | §13 | 🔴 Ausente | Nenhum KPI, fórmula, agregação ou componente de dashboard implementado. |
| 9 | **Backoffice, Auditoria e Operação** | §12 | 🔴 Ausente | Nenhuma tela de backoffice, trilha de auditoria ou filtro operacional implementado. |

**Conclusão: Todos os 9 módulos estão completamente ausentes.** O repositório é uma base documental pura, sem qualquer código de aplicação, migração de banco ou infraestrutura de runtime.

---

## Decisões técnicas relevantes já tomadas

As seguintes decisões estão documentadas e devem ser respeitadas pelos PRDs filhos:

### 1. Estrutura de monorepo (ADR-0001)
- **Status:** Aceito
- **Decisão:** Monorepo com separação em `apps/web`, `apps/api`, `packages/domain`, `packages/integration-sienge`, `packages/shared`, `supabase/`, `workers/`.
- **Referência:** `docs/decisions/ADR-0001-repo-structure.md`

### 2. Stack alvo
- Frontend: React + TypeScript + Vite com deploy na Vercel.
- Backend: API dedicada em TypeScript.
- Banco: PostgreSQL via Supabase.
- Auth: Supabase Auth por e-mail/senha.
- Workers: Camada explícita para polling, retry e follow-up assíncrono.

### 3. Fronteira de responsabilidades
- Regras críticas de negócio ficam no backend e/ou em `packages/domain`, **nunca** no frontend.
- O frontend apenas apresenta estados e envia comandos.
- Supabase apoia persistência e identidade, mas **não substitui** a API dedicada para regras de negócio.
- Workers são independentes do frontend e do lifecycle de requisição serverless.

### 4. Identidade visual
- Favicon: `src/assets/faviconGRF.png`
- Logo: `src/assets/GRFlogo.png`
- Paleta: Azul Escuro `#324598`, Azul Médio `#465EBE`, Turquesa `#19B4BE`, Azul Claro `#6ED8E0`, Branco `#FFFFFF`.
- Referência: `docs/paleta_de_cores.md` e `docs/identidade_visual.md`.

### 5. Projeto Supabase provisionado
- Projeto `dbGRF` (`lkfevrdhofxlmwjfhnru`) em `sa-east-1` já está ativo.
- Banco PostgreSQL 17 disponível, mas completamente vazio.

### 6. Ordem de execução sugerida
- O `docs/runbooks/setup.md` define uma sequência de 11 passos para transformar a base documental em workspace executável, começando pela escolha do gerenciador de workspace.

---

## Inconsistências identificadas entre repositório e PRD Global

### 1. Ausência de `workers/` como camada real
- **PRD §15.2:** "jobs de follow-up, polling e reprocessamento não podem depender do cliente web."
- **PRD §6:** Régua de cobrança exige scheduler diário.
- **Repositório:** O diretório `workers/` existe mas contém apenas `README.md`. Não há definição de runtime, framework de jobs ou estratégia de execução.
- **Impacto:** Os PRDs filhos precisam definir a infraestrutura concreta de workers (ex.: cron do Supabase + Edge Functions, BullMQ, Railway, etc.).

### 2. Ausência de `apps/api` como servidor executável
- **PRD §15.2:** "regras críticas de negócio devem ficar no backend."
- **Repositório:** `apps/api/` contém apenas `CLAUDE.md`. Não há framework escolhido (Express, Fastify, Hono, etc.), nem decisão de deploy do backend.
- **Impacto:** Os PRDs filhos precisam decidir se o backend roda como servidor standalone, como Edge Functions do Supabase, ou combinação antes de implementar os fluxos.

### 3. Monorepo não inicializado
- **PRD §15.1:** Stack com TypeScript.
- **Repositório:** Nenhum `package.json`, `tsconfig.json` ou gerenciador de workspace. Não é possível rodar, buildar ou testar nada.
- **Impacto:** **Bloqueante.** A inicialização do monorepo é pré-requisito para qualquer implementação.

### 4. Diretório `src/` residual
- O `src/` está documentado como "diretório reservado" mas contém os assets oficiais de branding.
- Os documentos de identidade visual definem que, quando o frontend for inicializado, os assets devem migrar para `apps/web/public/` e `apps/web/src/assets/`.
- **Não é inconsistência funcional**, mas exige atenção na transição.

### 5. Projeto dbOrion separado
- Existe um projeto Supabase anterior (`dbOrion`) com tabelas e funções para outro domínio (Superlógica/recibos).
- **Não há inconsistência**, mas os PRDs filhos devem usar exclusivamente o projeto `dbGRF` para o novo escopo do PRDGlobal.

---

## Lacunas críticas para homologação

Referência: PRDGlobal §17 — "Validações Técnicas Ainda Obrigatórias em Homologação"

| # | Item de homologação (§17) | Implementação visível | Lacuna |
|---|--------------------------|----------------------|--------|
| 1 | Validar se `supplierId` corresponde a `creditorId` | ❌ Nenhuma | Nenhum cliente HTTP para API de Credores implementado. Nenhum teste ou script de validação. |
| 2 | Validar regra do primeiro `contacts[].email` preenchido | ❌ Nenhuma | Nenhuma lógica de extração de e-mail de fornecedor. |
| 3 | Validar webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION` | ❌ Nenhuma | Nenhum receptor de webhook implementado. Nenhuma configuração de webhook registrada. |
| 4 | Validar webhook `PURCHASE_QUOTATION_NEGOTIATION_AUTHORIZATION_CHANGED` | ❌ Nenhuma | Idem acima. |
| 5 | Validar existência do fornecedor no mapa de cotação antes da escrita | ❌ Nenhuma | Nenhuma lógica de verificação pré-escrita. |
| 6 | Validar comportamento de criação/atualização de negociação | ❌ Nenhuma | Nenhum adaptador de escrita para API de cotação. |
| 7 | Validar cenários com múltiplas cotações em `purchaseQuotations[]` | ❌ Nenhuma | Nenhuma lógica de tratamento de itens de pedido. |
| 8 | Validar `GET /purchase-invoices/deliveries-attended` | ❌ Nenhuma | Nenhum cliente para API de notas fiscais. |
| 9 | Validar variações de `openQuantity` em `delivery-requirements` | ❌ Nenhuma | Nenhum tratamento de requisitos de entrega. |

**Conclusão: Nenhum dos 9 itens de homologação possui qualquer implementação, teste ou script de validação.** Todas as lacunas são completas e devem ser endereçadas durante a construção dos módulos correspondentes e validadas em ambiente de homologação com dados reais do cliente.

---

## Respostas de verificação da Etapa 0.1

### Qual é o problema central que o produto resolve?
A GRF opera o processo de suprimentos com baixa automação fora do ERP Sienge, concentrando atividades críticas em canais manuais (e-mail, WhatsApp), gerando retrabalho, follow-up reativo, baixa rastreabilidade e pouca qualidade analítica na gestão de fornecedores eas e compras.

### Quais são os 4 perfis do sistema e o que cada um pode e não pode fazer?
1. **Fornecedor:** acessa apenas dados próprios, responde cotações, sugere novas datas, registra avarias. **Não pode** aprovar a própria resposta, aprovar nova data ou modificar dados de outros.
2. **Compras:** revisa dados do Sienge, aprova/reprova respostas de cotação, aprova/reprova novas datas, valida entregas, trata exceções. **Não pode** gerir acessos ou parametrizar o sistema.
3. **Administrador:** cria/edita/bloqueia/reativa/remove acessos, parametriza workflow e regras, edita templates de notificação. **Não pode** aprovar respostas de cotação ou definir ações corretivas de avaria.
4. **Visualizador de Pedidos:** consulta pedidos e entregas. **Não pode** alterar dados, acessar dashboards, indicadores ou ações operacionais.

### Quais são os princípios invioláveis da integração com o Sienge?
- O Sienge prevalece como fonte principal de verdade para dados operacionais mestres.
- Nenhuma resposta de cotação volta ao Sienge sem aprovação manual de Compras.
- Nenhuma decisão operacional local sobrescreve dados mestres do Sienge.
- Webhooks são gatilhos de sincronização, não substitutos de leitura detalhada por API.
- Integrações devem ter idempotência, retry e rastreabilidade.

### Quais funcionalidades estão explicitamente fora de escopo da V1.0?
- Alteração automática de data planejada no Sienge a partir de sugestão do fornecedor.
- Auto cadastro de fornecedor.
- Ativação autônoma de credenciais sem ação do Administrador.
- Envio de anexos/documentos pelo fornecedor.
- Exposição de propostas concorrentes entre fornecedores.
- Automações financeiras, fiscais ou contábeis além do uso logístico de NF.
- Régua separada por parcela de entrega do mesmo item.
- Políticas avançadas de segurança além do mínimo operacional.
- Notificação por WhatsApp (V2.0).

### Quais validações técnicas ainda dependem de homologação?
Os 9 itens da §17 listados na seção "Lacunas críticas para homologação" acima.

---

## Critérios de saída — Verificação

- [x] O `PRDGlobal.md` foi lido integralmente (1534 linhas, 18 seções, da §1 à §18).
- [x] A varredura do repositório cobriu estrutura, backend, frontend, testes e documentação.
- [x] O mapeamento de aderência foi consolidado (9 módulos, todos ausentes).
- [x] O arquivo `/docs/decisions/relatorio-reconhecimento.md` foi criado.
- [x] Nenhum PRD filho foi iniciado nesta sessão.
