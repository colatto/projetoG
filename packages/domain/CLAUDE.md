# Contexto do Domínio

## Objetivo

Centralizar tipos e entidades nucleares independentes de framework.

## Conteúdo real hoje

- enums de usuário, webhook, integração e sync
- entidades `User`, `AuditLog`, `IntegrationEvent`, `WebhookEvent`, `SyncCursor`
- tipo `OutboundNegotiationPayload`

## Observação importante

O pacote ainda não concentra toda a regra operacional do produto. Parte da orquestração de negócio continua distribuída entre `apps/api` e `workers`. Toda nova regra reutilizável deve preferencialmente migrar para cá.
