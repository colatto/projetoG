# Supabase

Artefatos da plataforma de dados do projeto `dbGRF`.

## Conteúdo atual

- `config.toml`: configuração local do Supabase CLI
- `migrations/`: evolução do schema
- `seed.sql`: seed local

## Configuração local observada

- API: `54321`
- DB: `54322`
- Studio: `54323`
- Inbucket: `54324`
- PostgreSQL: `17`

## Migrações relevantes

- `20260409202239_initial_schema_v1.sql`: schema base do produto
- `20260409212000_align_auth_to_prd01.sql`: alinhamento de auth/perfis
- `20260411010000_integration_tables_prd07.sql`: tabelas de integração
- `20260414100000_webhook_delivery_metadata.sql`: metadados adicionais de webhook
- `20260415100000_sienge_missing_tables.sql`: tabelas auxiliares de pedidos/entregas
- `20260415100001_deliveries_unique.sql`: ajuste de unicidade em entregas
- `20260416100000_sienge_sync_cursor_enhancements.sql`: melhorias em cursor de sync

## Grupos de tabelas

Identidade:

- `profiles`
- `audit_logs`

Operação:

- `suppliers`
- `supplier_contacts`
- `purchase_quotations`
- `purchase_orders`
- `purchase_invoices`
- `deliveries`
- `notifications`
- `damages`

Integração:

- `integration_events`
- `webhook_events`
- `sienge_sync_cursor`
- `sienge_credentials`
- `order_quotation_links`
- `invoice_order_links`
- `delivery_schedules`

## Observações

- RLS está habilitado nas entidades principais
- backend e workers usam `service_role`
- o banco não substitui a API dedicada para orquestração de negócio
