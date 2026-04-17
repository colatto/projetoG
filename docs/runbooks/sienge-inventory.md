# Inventário de Implementações - Integração Sienge

Este documento atesta a entrega das especificações do PRD-07 e fornece os insumos completos para que a equipe técnica proceda com as validações automatizadas de código, ao mesmo tempo que instrui os gerentes de projeto a alinharem a agenda de testes integrados com os usuários-chave do Sienge.

## 1. Funcionalidades Implementadas

Todos os itens previstos como "Inclusos neste PRD" (§2.1 e §4 a §7) foram integralmente desenvolvidos, compreendendo:

- **Estruturas de banco de dados fundamentais**: Criação e aplicação das tabelas `sienge_credentials`, `integration_events`, `webhook_events` e `sienge_sync_cursor`.
- **Segurança e Rate Limit**: Mecanismo de autenticação _Basic_ para webhooks e controle estrito de limite de taxa para chamadas (Rate Limit).
- **Leitura (Inbound)**: Clientes HTTP isolados e resilientes para leitura de Cotações, Credores, Pedidos, Notas Fiscais e Requisitos de Entrega.
- **Escrita (Outbound)**: Clientes HTTP para escrita controlada de Respostas de Cotação, contemplando o sequenciamento correto de Criação, Atualização, Adição de Itens e Autorização.
- **Webhooks**: Controlador receptor de webhooks idempotente (utilizando a chave `x-sienge-id`) e otimizado para latência ultrabaixa (tempo de resposta garantido inferior a `2,5s`).
- **Workers Assíncronos**: Implementação dos jobs via `pg-boss` para reconciliação de dados via leitura periódica da API REST e reprocessamento automático de falhas (Retries), respeitando estritamente os intervalos de negócio (24h).
- **Auditoria e Traceability**: Sistema de log unificado (`integration_events`) para auditoria estruturada de todas as requisições, sejam elas _inbound_ ou _outbound_.

## 2. Itens Dependentes de Validação Externa

As funcionalidades abaixo representam o último bloqueio antes da liberação final (go-live), pois requerem validação conjunta com a operação real do cliente (conforme detalhado no documento `sienge-homologation.md`):

- **Mapeamento de Vínculos Lógicos**: A exatidão do mapeamento de vínculos logísticos que dependem de preenchimento humano no Sienge (ex: o vínculo de fornecedores utilizando o e-mail principal).
- **Disparo de Webhooks**: A consistência do disparo dos webhooks oficiais pelo ambiente em nuvem do Sienge, com ênfase absoluta na recepção do webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION`.
- **Mutações Críticas e Negociação**: A permissão efetiva da API do Sienge para acatar operações complexas de mutação no fluxo de negociações e cotações, validando na prática as regras restritivas e de bloqueio do mapa de cotação.

---

**Status**: Código entregue. Aguardando Validação Externa.
