# `@projetog/workers`

Runtime assíncrono do projeto usando Node.js + `pg-boss`.

## Responsabilidades atuais

- polling de cotações, pedidos e entregas no Sienge
- processamento assíncrono de webhooks persistidos pela API
- reconciliação de divergências
- retry de eventos `retry_scheduled`
- escrita outbound de negociação aprovada
- recálculo automático de status de pedido com sinalização de follow-up (PRD-05)
- follow-up logístico diário com régua de notificações, detecção de atraso e encerramento automático (PRD-04)
- verificação de expiração de cotações com alerta de sem resposta (PRD-02)
- envio de e-mail de notificação (PRD-03)

## Jobs registrados

- `sienge:sync-quotations`
- `sienge:sync-orders`
- `sienge:sync-deliveries`
- `sienge:reconcile`
- `sienge:process-webhook`
- `sienge:outbound-negotiation`
- `notification:send-email`
- `integration:retry`
- `follow-up`
- `quotation:expire-check`

## Schedules configurados

- `*/15 * * * *`: `sienge:sync-quotations`
- `*/15 * * * *`: `sienge:sync-orders`
- `*/15 * * * *`: `sienge:sync-deliveries`
- `0 * * * *`: `integration:retry`
- `0 11 * * *`: `follow-up`
- `15 11 * * *`: `quotation:expire-check`

## Dependências principais

- `pg-boss 9.0.3`
- `pg 8.16.3`
- `@supabase/supabase-js ^2.105.1`
- `tsx ^4.7.1`
- `typescript ^5.6.0`
- `vitest ^4.1.4`

## Ambiente

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
SIENGE_BASE_URL=
SIENGE_API_KEY=
SIENGE_API_SECRET=
SIENGE_ENCRYPTION_KEY=
NODE_ENV=development
```

## Comandos

```bash
pnpm --filter @projetog/workers dev
pnpm --filter @projetog/workers build
pnpm --filter @projetog/workers test
pnpm --filter @projetog/workers lint
```

## Observações operacionais

- `DATABASE_URL` é obrigatória
- o worker lê credenciais ativas em `sienge_credentials` e usa fallback de env apenas em `development`
- o follow-up scheduler é completo e implementa a régua do PRD-04 (notificações em dias úteis, detecção de atraso, encerramento automático)
- testes: 58 passando (13 ficheiros; ver `vitest.config.ts` com `pool: forks`)
- build e lint passam
