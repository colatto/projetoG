-- Aligning schema with current worker codebase

-- 1. Add missing supplier_email to supplier_negotiations
ALTER TABLE public.supplier_negotiations
ADD COLUMN IF NOT EXISTS supplier_email varchar(255);

-- 2. delivery_schedules
CREATE TABLE IF NOT EXISTS public.delivery_schedules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id bigint NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_number bigint NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_quantity numeric(15,4),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(purchase_order_id, item_number, scheduled_date)
);

-- RLS setup for delivery_schedules
ALTER TABLE public.delivery_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY delivery_schedules_read_own ON public.delivery_schedules FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = public.delivery_schedules.purchase_order_id AND po.supplier_id = public.get_auth_supplier_id()));

DROP TRIGGER IF EXISTS set_delivery_schedules_updated_at ON public.delivery_schedules;
CREATE TRIGGER set_delivery_schedules_updated_at BEFORE UPDATE ON public.delivery_schedules FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 3. order_quotation_links
CREATE TABLE IF NOT EXISTS public.order_quotation_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id bigint NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  purchase_quotation_id bigint NOT NULL REFERENCES public.purchase_quotations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(purchase_order_id, purchase_quotation_id)
);

-- RLS setup for order_quotation_links
ALTER TABLE public.order_quotation_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_quotation_links_read_own ON public.order_quotation_links FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = public.order_quotation_links.purchase_order_id AND po.supplier_id = public.get_auth_supplier_id()));

-- 4. invoice_order_links
CREATE TABLE IF NOT EXISTS public.invoice_order_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sequential_number bigint NOT NULL REFERENCES public.purchase_invoices(sequential_number) ON DELETE CASCADE,
  invoice_item_number bigint NOT NULL,
  purchase_order_id bigint NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  purchase_order_item_number bigint NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(sequential_number, invoice_item_number, purchase_order_id, purchase_order_item_number)
);

-- RLS setup for invoice_order_links
ALTER TABLE public.invoice_order_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoice_order_links_read_own ON public.invoice_order_links FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.purchase_invoices pi WHERE pi.sequential_number = public.invoice_order_links.sequential_number AND pi.supplier_id = public.get_auth_supplier_id()));
