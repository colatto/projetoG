# Contexto da Integração Sienge

## Objetivo

Concentrar o cliente técnico do ERP e os adaptadores reutilizáveis por API e workers.

## Conteúdo real hoje

### Core (`src/`)

- `SiengeClient`: cliente HTTP com retry (axios-retry), rate limiting (bottleneck) e paginação automática
- `createSiengeClient`: factory function
- `crypto.ts`: criptografia/descriptografia AES-256-GCM para credenciais Sienge
- `config/env.ts`: schema Zod de validação de configuração

### Clientes especializados (`src/clients/`)

- `QuotationClient`: cotações e negociações
- `CreditorClient`: credores/fornecedores
- `OrderClient`: pedidos de compra
- `InvoiceClient`: notas fiscais
- `DeliveryRequirementClient`: requisições de entrega
- `NegotiationClient`: criação, atualização, atualização de item e autorização de negociação

### Mapeadores (`src/mappers/`)

- `quotation-mapper`: cotação e negociações de cotação
- `creditor-mapper`: credor para fornecedor local + contatos + email
- `order-mapper`: pedido, itens, schedules e links cotação-pedido
- `invoice-mapper`: NF, itens e links NF-pedido
- `negotiation-mapper`: create/update/updateItem para escrita outbound

### Tipos (`src/types/`)

- `sienge-types.ts`: tipos de resposta da API REST do Sienge
- tipos de webhook Sienge

### Testes (`src/__tests__/`)

Unitários:

- `client.spec.ts`
- `clients/creditor-client.spec.ts`
- `clients/delivery-requirement-client.spec.ts`
- `mappers/creditor-mapper.spec.ts`
- `mappers/invoice-mapper.spec.ts`
- `mappers/negotiation-mapper.spec.ts`
- `mappers/order-mapper.spec.ts`
- `mappers/quotation-mapper.spec.ts`

Integração live:

- `health-check.integration.ts`
- `supplier-mapping.integration.ts`

## Dependências

- `axios ^1.15.0`
- `axios-retry ^4.5.0`
- `bottleneck ^2.19.5`
- `zod ^4.3.6` (nota: versão 4.x, diferente dos demais workspaces que usam 3.x)

## Regras locais

- escrita outbound só acontece após aprovação de `Compras`
- POSTs não dependem de retry HTTP automático
- logs devem mascarar credenciais e dados sensíveis
- contratos não homologados devem permanecer explicitamente marcados em documentação e testes live

## Estado de qualidade

- lint: passa
- testes: passam
- coverage: configurado via `@vitest/coverage-v8`
