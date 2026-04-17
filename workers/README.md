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

## Cronjobs e Processos Agendados (Integração Sienge)

Os seguintes jobs assíncronos/agendados foram implementados na arquitetura e devem ser acompanhados:

- `sienge:sync-quotations`: Consulta periodicamente negociações do Sienge.
- `sienge:sync-orders`: Sincroniza periodicamente pedidos pendentes do Sienge.
- `sienge:sync-deliveries`: Varre entregas/notas fiscais a partir de pedidos para reconciliação.
- `sienge:sync-creditor`: Obtém dados cadastrais e extrai e-mail de fornecedores sob demanda/sincronização.
- `sienge:process-webhook`: Enfileirado imediatamente pelo endpoint `/webhooks/sienge` da API, reconciliando payloads assincronamente.
- `sienge:outbound-negotiation`: Enfileirado após uma aprovação em _Compras_, responsável por escrever no Sienge e engatilhar _retries_ automáticos se necessário (até 2 vezes em intervalos de 24h).
- `integration:retry`: Um _scheduler_ periódico que varre a tabela `integration_events` buscando status `retry_scheduled` e repete as operações com base em `next_retry_at`. Este job precisa estar ativo para manter a resiliência do módulo.
