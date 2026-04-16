-- =============================================================================
-- Webhook delivery metadata and idempotency for Sienge deliveries
-- =============================================================================
-- References:
--   - https://api.sienge.com.br/docs/general-hooks.html
--   - x-sienge-id is the delivery identifier for idempotency
-- =============================================================================

ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS sienge_delivery_id varchar(255),
  ADD COLUMN IF NOT EXISTS sienge_hook_id varchar(255),
  ADD COLUMN IF NOT EXISTS sienge_event varchar(255),
  ADD COLUMN IF NOT EXISTS sienge_tenant varchar(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_delivery_id
  ON public.webhook_events (sienge_delivery_id)
  WHERE sienge_delivery_id IS NOT NULL;
