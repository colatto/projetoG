-- 1. Add missing columns to deliveries
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS delivery_item_number bigint,
  ADD COLUMN IF NOT EXISTS attended_number bigint,
  ADD COLUMN IF NOT EXISTS validated_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS validation_notes text,
  ADD COLUMN IF NOT EXISTS sienge_synced_at timestamptz DEFAULT now();

-- 2. Rename column for clarity (status → validation_status)
ALTER TABLE public.deliveries RENAME COLUMN status TO validation_status;

-- 3. Drop old 3-field unique constraint and create 6-field
ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_po_item_invoice_key;
ALTER TABLE public.deliveries ADD CONSTRAINT deliveries_record_unique_key
  UNIQUE (purchase_order_id, purchase_order_item_number, delivery_item_number,
          attended_number, invoice_sequential_number, invoice_item_number);

-- 4. Add CHECK for validated_by/validated_at consistency
ALTER TABLE public.deliveries ADD CONSTRAINT chk_validation_fields
  CHECK (
    (validation_status = 'AGUARDANDO_VALIDACAO' AND validated_by IS NULL AND validated_at IS NULL)
    OR (validation_status != 'AGUARDANDO_VALIDACAO' AND validated_by IS NOT NULL AND validated_at IS NOT NULL)
  );

-- 5. Indices (PRD-05 §4.1)
CREATE INDEX IF NOT EXISTS idx_deliveries_po_item
  ON public.deliveries (purchase_order_id, purchase_order_item_number);
CREATE INDEX IF NOT EXISTS idx_deliveries_seq_number
  ON public.deliveries (invoice_sequential_number);
CREATE INDEX IF NOT EXISTS idx_deliveries_validation_status
  ON public.deliveries (validation_status);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_date
  ON public.deliveries (delivery_date);

-- 6. order_status_history
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id bigint NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  reason text,
  changed_by uuid REFERENCES auth.users(id),
  changed_by_system boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_osh_po_created
  ON public.order_status_history (purchase_order_id, created_at);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- Append-only: no UPDATE or DELETE policies
CREATE POLICY osh_read_own ON public.order_status_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = public.order_status_history.purchase_order_id
    AND po.supplier_id = public.get_auth_supplier_id()
  ));

-- 7. Calculated fields in purchase_orders
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS total_quantity_ordered numeric(15,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_quantity_delivered numeric(15,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_quantity numeric(15,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_divergence boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_delivery_date date;
