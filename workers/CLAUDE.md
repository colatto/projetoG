# Diretrizes do Módulo `workers/`

## Objetivo

Executar processamento assíncrono, agendado e resiliente fora do ciclo HTTP.

## Responsabilidades reais

- sync periódico de cotações
- sync periódico de pedidos
- sync periódico de entregas/notas
- reconciliação acionada por webhook
- retry de `integration_events`
- escrita outbound de negociação aprovada
- follow-up diário ainda em modo stub

## Estrutura real

- `src/index.ts`: bootstrap
- `src/boss.ts`: singleton `pg-boss`
- `src/handlers/index.ts`: registro de workers e schedules
- `src/jobs/*.ts`: implementações por fluxo
- `src/sienge.ts`: fábrica do cliente Sienge
- `src/supabase.ts`: fábrica do cliente Supabase

## Regras locais

- não expor HTTP neste módulo
- não duplicar clientes Sienge fora de `packages/integration-sienge`
- usar `integration_events` e `audit_logs` como trilha operacional
- tratar `DATABASE_URL` como requisito obrigatório

## Estado atual

- testes: passam
- build: passa
- lint: falha

Principais pendências:

- débitos de `any` e variáveis não usadas
- implementação real da régua de `follow-up`
