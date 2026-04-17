# Contexto da Integração Sienge

## Objetivo

Concentrar o cliente técnico do ERP e os adaptadores reutilizáveis por API e workers.

## Conteúdo real hoje

- `SiengeClient` com retry, rate limit e paginação
- clientes de `quotation`, `order`, `invoice`, `creditor`, `delivery-requirement` e `negotiation`
- mapeadores de credor, cotação, pedido, invoice e negociação
- criptografia/descriptografia para credenciais Sienge
- testes unitários e testes de integração live

## Regras locais

- escrita outbound só acontece após aprovação de `Compras`
- POSTs não dependem de retry HTTP automático
- logs devem mascarar credenciais e dados sensíveis
- contratos não homologados devem permanecer explicitamente marcados em documentação e testes live
