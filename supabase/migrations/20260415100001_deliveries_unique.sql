-- 1. Create UNIQUE constraint for deliveries table to enable upsert logic
ALTER TABLE public.deliveries
ADD CONSTRAINT deliveries_po_item_invoice_key UNIQUE (purchase_order_id, purchase_order_item_number, invoice_sequential_number);
