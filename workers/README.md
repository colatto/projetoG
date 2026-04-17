# `@projetog/workers`

Runtime assíncrono do projeto usando Node.js + `pg-boss`.

## Responsabilidades atuais

- polling de cotações, pedidos e entregas no Sienge
- processamento assíncrono de webhooks persistidos pela API
- reconciliação de divergências
- retry de eventos `retry_scheduled`
- escrita outbound de negociação aprovada
- follow-up diário ainda em stub

## Jobs registrados

- `sienge:sync-quotations`
- `sienge:sync-orders`
- `sienge:sync-deliveries`
- `sienge:reconcile`
- `sienge:process-webhook`
- `sienge:outbound-negotiation`
- `integration:retry`
- `follow-up`

## Schedules configurados

- `*/15 * * * *`: `sienge:sync-quotations`
- `*/15 * * * *`: `sienge:sync-orders`
- `*/15 * * * *`: `sienge:sync-deliveries`
- `0 * * * *`: `integration:retry`
- `0 11 * * *`: `follow-up`

## Dependências principais

- `pg-boss 9.0.3`
- `pg 8.16.3`
- `@supabase/supabase-js 2.39.0`
- `tsx 4.7.1`
- `vitest 1.6.1`

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
- `follow-up.ts` ainda é stub e não implementa a régua completa do PRD-04
- os testes passam, mas o lint ainda falha por resíduos de tipagem e variáveis não usadas
