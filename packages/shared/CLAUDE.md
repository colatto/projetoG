# Contexto Compartilhado

## Objetivo

Manter contratos leves e reutilizáveis entre frontend, API e workers.

## Conteúdo real hoje

- `database.types.ts` gerado a partir do Supabase
- schemas Zod de auth, usuários e integração
- utilitário `sanitizeForLog`

## Regra local

Não adicionar regra de negócio complexa aqui. Este pacote é para DTOs, schemas, tipos e utilidades compartilhadas.
