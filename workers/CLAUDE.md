# Diretrizes do Módulo `workers/`

## Objetivo

Executar processamento assíncrono, agendado e resiliente fora do ciclo HTTP.

## Responsabilidades reais

- sync periódico de cotações (a cada 15 min)
- sync periódico de pedidos (a cada 15 min)
- sync periódico de entregas/notas (a cada 15 min)
- reconciliação acionada por webhook
- processamento assíncrono de webhooks recebidos
- escrita outbound de negociação aprovada
- retry de `integration_events` (a cada hora)
- follow-up diário (08:00 BRT) — ainda em modo stub
- verificação de expiração de cotações (08:15 BRT) — PRD-02 §6.6

## Estrutura real

- `src/index.ts`: bootstrap
- `src/boss.ts`: singleton `pg-boss`
- `src/handlers/index.ts`: registro de workers e schedules
- `src/jobs/*.ts`: implementações por fluxo
- `src/sienge.ts`: fábrica assíncrona do cliente Sienge com cache
- `src/supabase.ts`: fábrica do cliente Supabase
- `src/logger.ts`: logging estruturado
- `src/observability.ts`: métricas e monitoramento
- `src/operational-notifications.ts`: notificações operacionais para `Compras`
- `src/test-utils/`: fixtures, mocks de pg-boss e supabase

## Jobs registrados

| Job                           | Cron           | Descrição                                     |
| ----------------------------- | -------------- | --------------------------------------------- |
| `sienge:sync-quotations`      | `*/15 * * * *` | polling de cotações do Sienge                 |
| `sienge:sync-orders`          | `*/15 * * * *` | polling de pedidos do Sienge                  |
| `sienge:sync-deliveries`      | `*/15 * * * *` | polling de entregas/NFs do Sienge             |
| `sienge:reconcile`            | sob demanda    | re-leitura detalhada pós-webhook              |
| `sienge:process-webhook`      | sob demanda    | processamento assíncrono de webhook recebido  |
| `sienge:outbound-negotiation` | sob demanda    | escrita de negociação aprovada no Sienge      |
| `integration:retry`           | `0 * * * *`    | retry de eventos com falha                    |
| `follow-up`                   | `0 11 * * *`   | follow-up logístico diário (stub)             |
| `quotation:expire-check`      | `15 11 * * *`  | expiração automática de cotações sem resposta |

## Testes

- `sync-quotations.test.ts`
- `sync-orders.test.ts`
- `sync-deliveries.test.ts`
- `sienge-reconcile.test.ts`
- `process-webhook.test.ts`
- `outbound-negotiation.test.ts`
- `retry-integration.test.ts`

## Regras locais

- não expor HTTP neste módulo
- não duplicar clientes Sienge fora de `packages/integration-sienge`
- usar `integration_events` e `audit_logs` como trilha operacional
- tratar `DATABASE_URL` como requisito obrigatório

## Estado de qualidade

- testes: passam
- build: passa
- lint: passa

## Funcionalidades pendentes

- implementação real da régua de `follow-up` (PRD-04)
- testes para `quotation-expire-check`
