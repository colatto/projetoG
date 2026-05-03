-- PRD-09: operational audit trail columns (append-only audit_logs; complements PRD-01 rename)
-- Maps PRD §4.1 "audit_events" fields onto existing audit_logs table.

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS actor_type varchar(20) NOT NULL DEFAULT 'user'
    CHECK (actor_type IN ('user', 'system', 'integration')),
  ADD COLUMN IF NOT EXISTS event_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS purchase_quotation_id bigint REFERENCES public.purchase_quotations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS purchase_order_id bigint REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_id bigint REFERENCES public.suppliers(id) ON DELETE SET NULL;

UPDATE public.audit_logs
SET event_timestamp = COALESCE(created_at, now())
WHERE event_timestamp IS NULL;

ALTER TABLE public.audit_logs
  ALTER COLUMN event_timestamp SET DEFAULT now(),
  ALTER COLUMN event_timestamp SET NOT NULL;

CREATE INDEX IF NOT EXISTS audit_logs_event_timestamp_idx ON public.audit_logs (event_timestamp DESC);
CREATE INDEX IF NOT EXISTS audit_logs_purchase_quotation_id_idx ON public.audit_logs (purchase_quotation_id);
CREATE INDEX IF NOT EXISTS audit_logs_purchase_order_id_idx ON public.audit_logs (purchase_order_id);
CREATE INDEX IF NOT EXISTS audit_logs_supplier_id_idx ON public.audit_logs (supplier_id);
CREATE INDEX IF NOT EXISTS audit_logs_summary_search_idx ON public.audit_logs (event_type, event_timestamp DESC);

COMMENT ON COLUMN public.audit_logs.summary IS 'PRD-09 RN-12: human-readable action summary';
COMMENT ON COLUMN public.audit_logs.actor_type IS 'PRD-09 §4.1: user | system | integration';
COMMENT ON COLUMN public.audit_logs.event_timestamp IS 'PRD-09 §4.1: when the action occurred (defaults to created_at)';
