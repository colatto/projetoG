# Typecheck e Tipos Supabase

## Objetivo

Manter os contratos TypeScript alinhados ao schema Supabase antes de merge.

## Fluxo Obrigatório

1. Criar ou alterar migrations em `supabase/migrations`.
2. Aplicar as migrations no projeto Supabase alvo.
3. Regenerar os tipos:

```bash
pnpm run db:types
```

4. Validar os workspaces tipados:

```bash
pnpm run typecheck
pnpm -r run build
```

## Workspaces Cobertos

- `@projetog/api`: `tsc --noEmit`
- `@projetog/workers`: `tsc --noEmit`
- `@projetog/web`: `tsc -b --pretty false`
- `@projetog/integration-sienge`: `tsc --noEmit`

`packages/shared` e `packages/domain` continuam validados indiretamente pelos consumidores.

## PRD-06

Os tipos locais devem conter:

- colunas adicionais em `damages`: `reported_by_profile`, `suggested_action_notes`, `suggested_at`, `final_action`, `final_action_notes`, `final_action_decided_by`, `final_action_decided_at`, `affected_quantity`, `supplier_id`, `building_id`.
- tabela `damage_replacements`.
- tabela `damage_audit_logs`.

## PRD-08

Os tipos locais devem conter:

- `dashboard_snapshot`
- `dashboard_snapshot_por_fornecedor`
- `dashboard_snapshot_por_obra`
- `dashboard_criticidade_item`

## CI

O workflow `.github/workflows/ci.yml` executa `pnpm run typecheck` depois do lint e antes de testes/build. Isso bloqueia PRs com divergência entre código, migrations e `packages/shared/src/database.types.ts`.
