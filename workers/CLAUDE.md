# Diretrizes do Módulo — `workers/`

Este módulo concentra o processamento assíncrono isolado em Node.js usando `pg-boss` e TypeScript (ADR-0004).

## Responsabilidades

- Executar lógicas fora do ciclo HTTP.
- Fazer polling contínuo da API do Sienge para ler novas cotações, pedidos, acompanhamentos logísticos e faturamento.
- Executar as réguas de cobrança (processamento via agendamento programado).
- Reconciliar lógicas pesadas acionadas por webhooks.
- Operar filas de retry / dead-letter pattern para falhas de resiliência pontuais em microsserviço.

## Infraestrutura Técnica

- O framework de _queues / worker management_ adotado foi o `pg-boss`.
- Ele utilizará a instância PostgreSQL original definida para o provisionamento primário em nossa variável `.env` local (`DATABASE_URL`).
- **NUNCA** construa processos HTTP neste módulo de runtime (Para isso, use a API `apps/api` via _Fastify_).
- O módulo compartilha bibliotecas (`@projetog/domain` e `@projetog/integration-sienge`) referenciadas localmente. Não duplique lógicas de negócios operacionais aqui. Trate este script como o maestro entre as informações persistidas e a camada de chamadas a adaptadores.

## Dependências

As referências de workspace para o monorepo já estão resolvidas no `package.json`. A operação de start e watch fica a cargo do `tsx`.

Para rodar todo o set:

```bash
corepack pnpm --filter @projetog/workers run build
corepack pnpm --filter @projetog/workers dev
```
