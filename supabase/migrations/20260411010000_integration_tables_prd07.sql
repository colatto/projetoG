-- =============================================================================
-- PRD-07 Sprint 1: Integration Tables
-- =============================================================================
-- Decisions applied:
--   - integration_events: DROP + CREATE (table is empty, 7 → 16 columns)
--   - sienge_credentials: encryption handled at application layer (no pgcrypto)
--   - webhook_events and sienge_sync_cursor: fresh tables
-- References: PRD-07 §4.1–§4.4, fronteira-integracao.md, politica-logs.md
-- =============================================================================

-- ============================================================
-- 1. Recreate integration_events (PRD-07 §4.2)
--    Current table has 7 columns with simplified status enum.
--    PRD requires 16 columns, 5 specialized indices, and
--    status values: pending, success, failure, retry_scheduled.
-- ============================================================

-- Drop old simplified table (no production data)
DROP TABLE IF EXISTS public.integration_events CASCADE;

CREATE TABLE public.integration_events (
  id                  uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type          varchar(50)  NOT NULL,
    -- sync_quotations, sync_creditor, sync_orders, sync_deliveries,
    -- write_negotiation, authorize_negotiation, webhook_received
  direction           varchar(10)  NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  endpoint            varchar(255) NOT NULL,
  http_method         varchar(10)  NOT NULL CHECK (http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  http_status         integer,
  request_payload     jsonb,        -- Masked per politica-logs.md §2
  response_payload    jsonb,        -- Masked per politica-logs.md §2
  status              varchar(30)  NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'success', 'failure', 'retry_scheduled')),
  error_message       text,
  retry_count         integer      NOT NULL DEFAULT 0,
  max_retries         integer      NOT NULL DEFAULT 0,
  next_retry_at       timestamptz,
  related_entity_type varchar(50),  -- quotation, order, invoice, creditor
  related_entity_id   varchar(100), -- ID of the related entity in Sienge
  idempotency_key     varchar(255), -- UUID generated at approval time
  created_at          timestamptz  DEFAULT now(),
  updated_at          timestamptz  DEFAULT now()
);

-- Indices (PRD-07 §4.2)
CREATE INDEX idx_integration_events_status
  ON public.integration_events (status);

CREATE INDEX idx_integration_events_type
  ON public.integration_events (event_type);

CREATE INDEX idx_integration_events_entity
  ON public.integration_events (related_entity_type, related_entity_id);

-- Unique partial index: idempotency_key must be unique when present
CREATE UNIQUE INDEX idx_integration_events_idempotency
  ON public.integration_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Partial index for retry scheduler: only retry_scheduled events
CREATE INDEX idx_integration_events_retry
  ON public.integration_events (next_retry_at)
  WHERE status = 'retry_scheduled';

-- RLS (service_role bypasses; no user-facing policies needed)
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;

-- Trigger for automatic updated_at
CREATE TRIGGER set_integration_events_updated_at
  BEFORE UPDATE ON public.integration_events
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();


-- ============================================================
-- 2. Create webhook_events (PRD-07 §4.3)
-- ============================================================

CREATE TABLE public.webhook_events (
  id            uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_type  varchar(100)  NOT NULL,
    -- PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION
    -- PURCHASE_QUOTATION_NEGOTIATION_AUTHORIZATION_CHANGED
    -- PURCHASE_ORDER_AUTHORIZATION_CHANGED
    -- PURCHASE_ORDER_ITEM_MODIFIED
    -- PURCHASE_ORDER_FINANCIAL_FORECAST_UPDATED
  payload       jsonb         NOT NULL,
  status        varchar(20)   NOT NULL DEFAULT 'received'
                CHECK (status IN ('received', 'processing', 'processed', 'failed')),
  processed_at  timestamptz,
  error_message text,
  created_at    timestamptz   DEFAULT now()
);

-- Indices (PRD-07 §4.3)
CREATE INDEX idx_webhook_events_type
  ON public.webhook_events (webhook_type);

CREATE INDEX idx_webhook_events_status
  ON public.webhook_events (status);

-- RLS (service_role bypasses; no user-facing policies needed)
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 3. Create sienge_sync_cursor (PRD-07 §4.4)
-- ============================================================

CREATE TABLE public.sienge_sync_cursor (
  id              uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_type   varchar(50)   NOT NULL,
    -- quotations, orders, invoices, deliveries, creditors
  last_offset     integer       NOT NULL DEFAULT 0,
  last_synced_at  timestamptz   NOT NULL DEFAULT now(),
  sync_status     varchar(20)   NOT NULL DEFAULT 'idle'
                  CHECK (sync_status IN ('idle', 'running', 'error')),
  error_message   text
);

-- Unique index on resource_type (each resource has exactly one cursor)
CREATE UNIQUE INDEX idx_sienge_sync_cursor_resource
  ON public.sienge_sync_cursor (resource_type);

-- RLS (service_role bypasses; no user-facing policies needed)
ALTER TABLE public.sienge_sync_cursor ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 4. Create sienge_credentials (PRD-07 §4.1)
--    Encryption is handled at the application layer.
--    api_user and api_password store ciphertext, NOT plaintext.
-- ============================================================

CREATE TABLE public.sienge_credentials (
  id              uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  subdomain       varchar(100)  NOT NULL,
  api_user        varchar(255)  NOT NULL,  -- Encrypted at application layer
  api_password    text          NOT NULL,  -- Encrypted at application layer
  rest_rate_limit integer       NOT NULL DEFAULT 200,  -- §9.2: 200/min REST
  bulk_rate_limit integer       NOT NULL DEFAULT 20,   -- §9.2: 20/min BULK
  is_active       boolean       NOT NULL DEFAULT true,
  created_at      timestamptz   DEFAULT now(),
  updated_at      timestamptz   DEFAULT now()
);

-- Index for querying active credentials
CREATE INDEX idx_sienge_credentials_active
  ON public.sienge_credentials (is_active);

-- Enforce single active record at any time (PRD-07 §4.1)
CREATE UNIQUE INDEX idx_sienge_credentials_single_active
  ON public.sienge_credentials (is_active)
  WHERE is_active = true;

-- RLS (service_role bypasses; no user-facing policies needed)
ALTER TABLE public.sienge_credentials ENABLE ROW LEVEL SECURITY;

-- Trigger for automatic updated_at
CREATE TRIGGER set_sienge_credentials_updated_at
  BEFORE UPDATE ON public.sienge_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();


-- ============================================================
-- 5. Seed sienge_sync_cursor with initial resource types
--    Workers expect these records to exist for cursor management.
-- ============================================================

INSERT INTO public.sienge_sync_cursor (resource_type, last_offset, last_synced_at, sync_status)
VALUES
  ('quotations',  0, '1970-01-01T00:00:00Z', 'idle'),
  ('orders',      0, '1970-01-01T00:00:00Z', 'idle'),
  ('invoices',    0, '1970-01-01T00:00:00Z', 'idle'),
  ('deliveries',  0, '1970-01-01T00:00:00Z', 'idle'),
  ('creditors',   0, '1970-01-01T00:00:00Z', 'idle');
