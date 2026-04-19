# Contexto do Domínio

## Objetivo

Centralizar tipos e entidades nucleares independentes de framework.

## Conteúdo real hoje

### Enums (`src/enums/`)

- `UserRole`: `ADMINISTRADOR`, `COMPRAS`, `FORNECEDOR`, `VISUALIZADOR_PEDIDOS`
- `UserStatus`: `ATIVO`, `BLOQUEADO`, `INATIVO`
- `IntegrationEventType`: tipos de eventos de integração (webhook, sync, write, retry)
- `SyncStatus`: estados de sincronização
- `WebhookType`: tipos de webhook do Sienge

### Entidades (`src/entities/`)

- `User`: perfil de usuário com role e status
- `AuditLog`: registro de auditoria persistido
- `IntegrationEvent`: evento de integração com status, retry count e metadata
- `WebhookEvent`: evento de webhook recebido do Sienge
- `SyncCursor`: cursor de sincronização por tipo de entidade

### Tipos (`src/types/`)

- `OutboundNegotiationPayload`: payload para escrita outbound de negociação no Sienge

## Observação importante

O pacote ainda não concentra toda a regra operacional do produto. Parte da orquestração de negócio continua distribuída entre `apps/api` (controllers de cotação) e `workers` (jobs). Toda nova regra reutilizável deve preferencialmente migrar para cá.

## Estado de qualidade

- lint: passa
- testes: passam (com `--passWithNoTests`)
