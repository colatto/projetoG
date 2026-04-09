# ADR-0004: Runtime e Framework de Jobs — workers/

## Status

Aceito

## Contexto

O produto exige processamento assincrono fora do ciclo HTTP para:

- **polling das APIs do Sienge** — verificacao periodica de cotacoes, pedidos e entregas;
- **follow-up logistico** — regua de cobranca com scheduler diario (PRDGlobal §6);
- **retries e reprocessamentos** — falhas de integracao devem ser recuperaveis sem intervencao manual;
- **reconciliacao por webhook** — webhook dispara sincronizacao, mas nao substitui leitura detalhada;
- **tarefas de longa duracao** — operacoes que nao cabem no request lifecycle serverless.

A escolha do runtime e do framework de jobs impacta diretamente:

- compatibilidade com o banco Supabase PostgreSQL ja provisionado (`dbGRF`);
- modelo de persistencia de fila e estado de jobs;
- estrategia de retry, dead-letter e reprocessamento;
- complexidade operacional de infraestrutura;
- compatibilidade com o monorepo TypeScript (pnpm, ADR-0003).

Opcoes avaliadas: **Node.js + pg-boss**, **Supabase Edge Functions + pg_cron**, **BullMQ + Redis**, **Inngest**.

## Decisao

Adotar **Node.js + TypeScript em processo worker standalone** no mesmo monorepo (`workers/`), usando **pg-boss** como framework de filas e agendamento de jobs.

### Justificativa

#### Por que processo standalone (nao Edge Functions)?

- O produto exige polling continuo, retries com backoff exponencial e reconciliacao de longa duracao — incompativeis com o modelo stateless e sem estado de Edge Functions.
- PRDGlobal §15.2 explicita que "jobs de follow-up, polling e reprocessamento nao podem depender do cliente web" e nao devem depender de requisicoes de curta duracao.
- ADR-0001 ja reserva `workers/` como camada explicita independente do frontend e da API.

#### Por que pg-boss?

- **PostgreSQL nativo:** pg-boss usa o proprio banco PostgreSQL (`dbGRF`) como fila persistente — sem infraestrutura adicional (sem Redis, sem broker externo).
- **Persistencia transacional:** jobs sao criados, atualizados e completados em transacoes PostgreSQL — garantindo consistencia com o restante dos dados operacionais.
- **Retry e dead-letter integrados:** configuracao de `retryLimit`, `retryDelay`, `retryBackoff` e fila de dead-letter por tipo de job, sem codigo extra.
- **Scheduling nativo:** suporte a `scheduleJob` com expressoes cron para o follow-up logistico diario (PRDGlobal §6).
- **Idempotencia:** suporte a `singletonKey` para garantir que o mesmo job nao seja enfileirado multiplas vezes.
- **TypeScript first:** tipos nativos, sem `@types/pg-boss`.
- **Rastreabilidade:** cada job tem `id`, `name`, `data`, `state`, `createdon`, `startedon`, `completedon`, `output` — integra diretamente com a trilha de auditoria.
- **Sem dependencia nova de infraestrutura:** aproveita o PostgreSQL 17 do projeto `dbGRF` ja provisionado.

## Consequencias

### Positivas

- Zero infra nova — fila roda no mesmo banco ja provisionado.
- Jobs visiveis e consultaveis via SQL (tabelas `pgboss.job`, `pgboss.schedule`).
- Retry, dead-letter e scheduling sem libs adicionais.
- Compativel com pnpm workspace — `workers/` e um pacote normal do monorepo.
- Workers compartilham `packages/domain` e `packages/integration-sienge` sem duplicar logica.
- Processo Node.js de longa duracao — sem limitacao de tempo de execucao.
- Deploy simples: container, Railway, Fly.io ou qualquer host compativel com Node.js.

### Negativas

- Requer que o processo worker esteja sempre em execucao (nao e on-demand como Lambda).
- Escalabilidade horizontal exige coordenacao de workers concorrentes (pg-boss trata isso via locking no banco).
- Volume muito alto de jobs (> milhoes/dia) pode pressionar o banco — nao e o caso do escopo atual.
- Adiciona schema `pgboss` ao banco PostgreSQL gerenciado pelo Supabase.

## Alternativas consideradas

### Supabase Edge Functions + pg_cron

Nao adotado como solucao unica porque:
- Edge Functions sao stateless e tem limite de tempo de execucao — incompativel com polling e reconciliacao.
- pg_cron nao e disponivel em todos os planos Supabase e tem granularidade minima de 1 minuto.
- Retry e dead-letter exigiriam implementacao manual.

Pode ser usado como complemento (ex.: trigger de webhook) mas nao como runtime principal de workers.

### BullMQ + Redis

Nao adotado porque:
- Exige Redis como infraestrutura adicional, aumentando custo e complexidade operacional.
- O projeto ja tem PostgreSQL disponivel — pg-boss oferece garantias equivalentes sem infra nova.

### Inngest

Nao adotado porque:
- Servico externo gerenciado — adiciona dependencia de vendor critico para o processamento assincrono.
- Custo variavel por execucao em escala.
- Menos controle sobre persistencia e auditoria de jobs.

## Estrutura esperada de `workers/`

```
workers/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           # entrypoint: inicializa pg-boss e registra handlers
│   ├── boss.ts            # factory do cliente pg-boss (singleton)
│   ├── jobs/
│   │   ├── follow-up.ts        # regua de follow-up logistico (cron diario)
│   │   ├── sienge-polling.ts   # polling de cotacoes e pedidos do Sienge
│   │   ├── sienge-reconcile.ts # reconciliacao disparada por webhook
│   │   └── retry-integration.ts # reprocessamento de falhas de integracao
│   └── handlers/
│       └── index.ts       # registro centralizado de todos os handlers
└── README.md
```

## Dependencias principais esperadas

| Pacote | Finalidade |
|---|---|
| `pg-boss` | Framework de filas e scheduling sobre PostgreSQL |
| `pg` | Driver PostgreSQL para pg-boss |
| `@supabase/supabase-js` | Cliente Supabase para acesso a dados operacionais |
| `tsx` ou `ts-node` | Execucao TypeScript em desenvolvimento |
| `vitest` | Testes unitarios dos handlers e logica de jobs |

## Variaveis de ambiente necessarias

Ja documentadas no `CLAUDE.md` e no `.env.example`:

- `SUPABASE_URL` — URL do projeto `dbGRF`
- `SUPABASE_SERVICE_ROLE_KEY` — chave de servico para operacoes privilegiadas
- `SIENGE_BASE_URL` — URL base da API Sienge
- `SIENGE_API_KEY` — credencial de acesso ao Sienge
- `DATABASE_URL` — string de conexao direta ao PostgreSQL (necessaria para inicializacao do pg-boss)

## Comandos esperados apos inicializacao

| Acao | Comando |
|---|---|
| Iniciar workers (dev) | `pnpm --filter workers dev` |
| Build dos workers | `pnpm --filter workers build` |
| Testes dos workers | `pnpm --filter workers test` |

## Referencias

- `docs/decisions/ADR-0001-repo-structure.md` — decisao de monorepo e camada explicita de workers
- `docs/decisions/ADR-0002-backend-framework.md` — Fastify na API (coordinacao com workers)
- `docs/decisions/ADR-0003-workspace-manager.md` — pnpm como gerenciador do workspace
- `workers/README.md` — contexto operacional do modulo
- `CLAUDE.md` — regras obrigatorias e diretriz para alteracoes
- PRDGlobal §6 — regua de follow-up logistico (scheduler diario)
- PRDGlobal §15.2 — principios de processamento assincrono
