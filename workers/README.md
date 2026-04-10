# Workers

Este módulo é responsável por todo o processamento assíncrono e fora do ciclo HTTP da aplicação.

## Responsabilidades

- **Polling das APIs do Sienge**: verificação periódica de cotações, pedidos e entregas.
- **Follow-up logístico**: régua de cobrança via scheduler diário.
- **Retries e reprocessamentos**: recuperação de falhas de integração.
- **Reconciliação por webhook**: engatilhar a leitura detalhada a partir de notificações do Sienge.

## Stack

- **Runtime**: Node.js standalone
- **Linguagem**: TypeScript
- **Framework de Filas**: `pg-boss` (usando o Supabase PostgreSQL `dbGRF`)

## Rodando localmente

Certifique-se de configurar o arquivo `.env` baseando-se no `.env.example` raiz, em especial o `DATABASE_URL` (Direct Connection, para que o pg-boss possa invocar e inicializar o schema corretamente).

```bash
pnpm --filter @projetog/workers dev
```

Este comando já inicializará os jobs e consumirá das filas cadastradas.

## Estrutura

- `src/index.ts`: Ponto de entrada (conecta o pg-boss e cadastra os handlers).
- `src/boss.ts`: Fábrica do Singleton `pg-boss`.
- `src/jobs/`: Implementação de cada rotina assíncrona isolada.
- `src/handlers/index.ts`: Mapeamento das chaves de fila (queents) para os jobs na pasta `/jobs`.
