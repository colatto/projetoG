# Contexto Compartilhado

## Objetivo

Manter contratos leves e reutilizáveis entre frontend, API e workers.

## Conteúdo real hoje

### Tipos gerados

- `database.types.ts`: tipos TypeScript gerados automaticamente a partir do schema Supabase (46KB)

### Schemas Zod (`src/schemas/`)

- `auth.ts`: schemas de login e autenticação
- `users.ts`: schemas de criação/edição de usuários
- `integration.ts`: schemas de eventos de integração, credenciais Sienge e escrita de negociação
- `quotations.ts`: schemas de consulta, envio, resposta (com itens e entregas) e revisão de cotações
- `dashboard.ts`: schemas Zod das queries do PRD-08 (`/api/dashboard/*`) — lead-time, atrasos, avarias e ranking compartilham filtros de período + fornecedor/obra/pedido/item; criticidade inclui `supplier_id` e `purchase_order_id`
- `orders.ts`: query string de listagem de pedidos (`ordersListQuerySchema` — PRD-09 §7.2 / `GET /api/orders`)

### Utilitários (`src/utils/`)

- `log-sanitizer.ts`: `sanitizeForLog` — mascara credenciais e dados sensíveis em logs

## Dependências

- `@projetog/domain workspace:*`
- `zod ^3.23.8`

## Regra local

Não adicionar regra de negócio complexa aqui. Este pacote é para DTOs, schemas, tipos e utilidades compartilhadas.

## Estado de qualidade

- lint: passa
- testes: passam (com `--passWithNoTests`)
