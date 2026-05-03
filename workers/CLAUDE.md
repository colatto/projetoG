# Diretrizes do Módulo `workers/`

## Objetivo

Executar processamento assíncrono, agendado e resiliente fora do ciclo HTTP.

## Responsabilidades reais

- sync periódico de cotações (a cada 15 min)
- sync periódico de pedidos (a cada 15 min)
- sync periódico de entregas/notas (a cada 15 min) com recálculo automático de status de pedido via `OrderStatusEngine` e sinalização de follow-up (PRD-05)
- reconciliação acionada por webhook
- processamento assíncrono de webhooks recebidos (`process-webhook.ts`: reconciliação pedido/cotação + **`handleAckOnlyEvent`** para os 6 tipos CONTRACT*/MEASUREMENT*/CLEARING\_ — `WEBHOOK_PROCESSED` com entidade tipada)
- escrita outbound de negociação aprovada
- retry de `integration_events` (a cada hora)
- follow-up logístico diário (08:00 BRT) com régua de notificações, detecção de atraso, encerramento automático e cálculo de dias úteis (PRD-04)
- verificação de expiração de cotações (08:15 BRT) com alerta de sem resposta (PRD-02 §6.6)
- envio de e-mail de notificação (PRD-03)
- consolidação diária de snapshots do dashboard (PRD-08): job `dashboard:consolidation`, escrita atômica via `src/jobs/dashboard-snapshot-pg.ts` (requer `DATABASE_URL`)

## Estrutura real

- `src/index.ts`: bootstrap
- `src/boss.ts`: singleton `pg-boss`
- `src/handlers/index.ts`: registro de workers e schedules
- `src/jobs/*.ts`: implementações por fluxo
- `src/utils/order-status-recalc.ts`: recálculo de status de pedido com sinalização de follow-up (PRD-05)
- `src/utils/business-days.ts`: cálculo de dias úteis com feriados (PRD-04)
- `src/sienge.ts`: fábrica assíncrona do cliente Sienge com cache
- `src/supabase.ts`: fábrica do cliente Supabase
- `src/logger.ts`: logging estruturado
- `src/observability.ts`: métricas e monitoramento
- `src/operational-notifications.ts`: notificações operacionais para `Compras`
- `src/test-utils/`: fixtures, mocks de pg-boss e supabase

## Jobs registrados

| Job                           | Cron           | Descrição                                                               |
| ----------------------------- | -------------- | ----------------------------------------------------------------------- |
| `sienge:sync-quotations`      | `*/15 * * * *` | polling de cotações do Sienge                                           |
| `sienge:sync-orders`          | `*/15 * * * *` | polling de pedidos do Sienge                                            |
| `sienge:sync-deliveries`      | `*/15 * * * *` | polling de entregas/NFs do Sienge + recálculo status                    |
| `sienge:reconcile`            | sob demanda    | re-leitura detalhada pós-webhook                                        |
| `sienge:process-webhook`      | sob demanda    | processamento assíncrono de webhook recebido                            |
| `sienge:outbound-negotiation` | sob demanda    | escrita de negociação aprovada no Sienge                                |
| `notification:send-email`     | sob demanda    | envio de e-mail via Resend (PRD-03)                                     |
| `integration:retry`           | `0 * * * *`    | retry de eventos com falha                                              |
| `follow-up`                   | `0 11 * * *`   | follow-up logístico diário com régua completa (PRD-04)                  |
| `quotation:expire-check`      | `15 11 * * *`  | expiração automática de cotações sem resposta                           |
| `dashboard:consolidation`     | `45 10 * * *`  | snapshots PRD-08 (transação única; requer `DATABASE_URL`)               |
| `audit:retry`                 | sob demanda    | retry de evento de auditoria enfileirado por AuditService (PRD-09 §9.6) |

## Testes

- `sync-quotations.test.ts`
- `sync-orders.test.ts`
- `sync-deliveries.test.ts`
- `sienge-reconcile.test.ts`
- `process-webhook.test.ts`
- `outbound-negotiation.test.ts`
- `retry-integration.test.ts`
- `quotation-expire-check.test.ts`
- `follow-up.test.ts` (3 testes: bootstrap, overdue, close)
- `business-days.test.ts` (5 testes: addBusinessDays, countBusinessDays, holidaysToSet)
- `order-status-recalc.test.ts` (4 testes: follow-up após entrega total/parcial; PRD-06 §14 precedência damages)
- `dashboard-snapshot-pg.test.ts`

## Regras locais

- não expor HTTP neste módulo
- não duplicar clientes Sienge fora de `packages/integration-sienge`
- usar `integration_events` e `audit_logs` como trilha operacional
- tratar `DATABASE_URL` como requisito obrigatório

## Estado de qualidade

- testes: 58 passando (`vitest ^4.1.4`, [`vitest.config.ts`](vitest.config.ts) com `pool: forks`) — inclui transação do snapshot PRD-08, `order-status-recalc`, **`process-webhook.test.ts`** (+6 cenários ACK-only PRD-07)
- build: passa
- lint: passa

## Funcionalidades pendentes

- expansão de testes de follow-up (sugestão/aprovação de datas); entrega parcial vs encerramento de tracker coberto em `order-status-recalc.test.ts` (PRD-04 Fase 5 + PRD-05)
- reativação de tracker `CONCLUIDO` quando data prometida vence sem entrega (RN-13/14)
- testes de integração do job `dashboard:consolidation` com Supabase de teste
