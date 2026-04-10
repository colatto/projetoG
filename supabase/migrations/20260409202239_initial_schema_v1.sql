-- Enable uuid-ossp for random UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role varchar(50) NOT NULL CHECK (role IN ('FORNECEDOR', 'COMPRAS', 'ADMINISTRADOR', 'VISUALIZADOR_DE_PEDIDOS')),
  supplier_id bigint,  -- Nullable, only populated if role is 'FORNECEDOR'
  name varchar(255) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Suppliers
CREATE TABLE public.suppliers (
  id bigint PRIMARY KEY, -- Sienge's supplierId
  creditor_id bigint,    -- Sienge's creditorId
  name varchar(255) NOT NULL,
  trade_name varchar(255),
  access_status varchar(50) DEFAULT 'ACTIVE' CHECK (access_status IN ('ACTIVE', 'BLOCKED')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Foreign key back to suppliers for profile
ALTER TABLE public.profiles
ADD CONSTRAINT fk_profile_supplier
FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- 3. Supplier Contacts
CREATE TABLE public.supplier_contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id bigint NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  email varchar(255) NOT NULL,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 4. Purchase Quotations
CREATE TABLE public.purchase_quotations (
  id bigint PRIMARY KEY, -- Sienge's purchaseQuotationId
  buyer_id varchar(100),
  sienge_status varchar(100),
  consistency varchar(100),
  quotation_date date,
  response_date date,
  end_date date, -- Managed by Compras
  local_status varchar(50) NOT NULL DEFAULT 'EM_NEGOCIACAO' CHECK (local_status IN ('EM_NEGOCIACAO', 'ENCERRADO')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Purchase Quotation Items
CREATE TABLE public.purchase_quotation_items (
  id bigint PRIMARY KEY, -- Sienge's purchaseQuotationItemId
  purchase_quotation_id bigint NOT NULL REFERENCES public.purchase_quotations(id) ON DELETE CASCADE,
  description text,
  quantity numeric(15,4),
  unit varchar(50),
  created_at timestamptz DEFAULT now()
);

-- 6. Supplier Negotiations (Answers to quotations)
CREATE TABLE public.supplier_negotiations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sienge_negotiation_id bigint, -- Sienge's negotiationId
  sienge_negotiation_number bigint, 
  purchase_quotation_id bigint NOT NULL REFERENCES public.purchase_quotations(id) ON DELETE CASCADE,
  supplier_id bigint NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  status varchar(50) NOT NULL DEFAULT 'AGUARDANDO_RESPOSTA' CHECK (status IN (
    'AGUARDANDO_RESPOSTA', 
    'AGUARDANDO_REVISAO', 
    'APROVADA', 
    'REPROVADA', 
    'CORRECAO_SOLICITADA', 
    'AGUARDANDO_REENVIO_SIENGE', 
    'INTEGRADA_SIENGE',
    'SEM_RESPOSTA',
    'FORNECEDOR_FECHADO',
    'ENCERRADA'
  )),
  delivery_date date,
  read_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(purchase_quotation_id, supplier_id)
);

-- 7. Supplier Negotiation Items
CREATE TABLE public.supplier_negotiation_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_negotiation_id uuid NOT NULL REFERENCES public.supplier_negotiations(id) ON DELETE CASCADE,
  purchase_quotation_item_id bigint NOT NULL REFERENCES public.purchase_quotation_items(id) ON DELETE CASCADE,
  unit_price numeric(15,4),
  quantity numeric(15,4),
  delivery_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(supplier_negotiation_id, purchase_quotation_item_id)
);

-- 8. Purchase Orders
CREATE TABLE public.purchase_orders (
  id bigint PRIMARY KEY, -- Sienge's purchaseOrderId
  formatted_purchase_order_id varchar(100),
  supplier_id bigint NOT NULL REFERENCES public.suppliers(id),
  buyer_id varchar(100),
  building_id bigint,
  sienge_status varchar(100),
  authorized boolean,
  disapproved boolean,
  delivery_late boolean,
  consistent varchar(100),
  date date,
  local_status varchar(50) NOT NULL DEFAULT 'PENDENTE' CHECK (local_status IN (
     'PENDENTE',
     'PARCIALMENTE_ENTREGUE',
     'ENTREGUE',
     'ATRASADO',
     'DIVERGENCIA',
     'EM_AVARIA',
     'REPOSICAO',
     'CANCELADO'
  )),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 9. Purchase Order Items
CREATE TABLE public.purchase_order_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id bigint NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_number bigint NOT NULL,
  quantity numeric(15,4),
  unit_price numeric(15,4),
  purchase_quotation_id bigint,
  purchase_quotation_item_id bigint,
  local_delivery_date date, -- Data Prometida local
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(purchase_order_id, item_number)
);

-- 10. Purchase Invoices (Notas Fiscais)
CREATE TABLE public.purchase_invoices (
  sequential_number bigint PRIMARY KEY,
  supplier_id bigint NOT NULL REFERENCES public.suppliers(id),
  document_id varchar(255),
  series varchar(50),
  number varchar(100),
  issue_date date,
  movement_date date,
  consistency varchar(100),
  created_at timestamptz DEFAULT now()
);

-- 11. Invoice Items
CREATE TABLE public.invoice_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_sequential_number bigint NOT NULL REFERENCES public.purchase_invoices(sequential_number) ON DELETE CASCADE,
  item_number bigint NOT NULL,
  quantity numeric(15,4),
  created_at timestamptz DEFAULT now(),
  UNIQUE(invoice_sequential_number, item_number)
);

-- 12. Deliveries (Entregas Atendidas / Sienge or Manual)
CREATE TABLE public.deliveries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_sequential_number bigint REFERENCES public.purchase_invoices(sequential_number) ON DELETE CASCADE,
  invoice_item_number bigint,
  purchase_order_id bigint NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  purchase_order_item_number bigint NOT NULL,
  delivered_quantity numeric(15,4),
  delivery_date date,
  status varchar(50) DEFAULT 'AGUARDANDO_VALIDACAO' CHECK (status IN ('AGUARDANDO_VALIDACAO', 'OK', 'DIVERGENCIA')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 13. Damages (Avarias)
CREATE TABLE public.damages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id bigint NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_number bigint NOT NULL,
  reported_by uuid NOT NULL REFERENCES public.profiles(id),
  description text NOT NULL,
  suggested_action varchar(50) CHECK (suggested_action IN ('CANCELAMENTO_PARCIAL', 'CANCELAMENTO_TOTAL', 'REPOSICAO')),
  approved_action varchar(50) CHECK (approved_action IN ('CANCELAMENTO_PARCIAL', 'CANCELAMENTO_TOTAL', 'REPOSICAO')),
  status varchar(50) NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'RESOLVIDA')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 14. Follow-up Trackers (Workflow de Cobrança / Notificações)
CREATE TABLE public.follow_up_trackers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id bigint NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_number bigint NOT NULL,
  base_date date NOT NULL,
  current_delivery_date date NOT NULL, 
  status varchar(50) NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'NOVA_DATA_SUGERIDA', 'NOVA_DATA_APROVADA', 'ENCERRADO')),
  suggested_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(purchase_order_id, item_number)
);

-- 15. Notifications log
CREATE TABLE public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  follow_up_tracker_id uuid REFERENCES public.follow_up_trackers(id) ON DELETE CASCADE,
  type varchar(50) NOT NULL, -- e.g., 'NOVA_COTACAO', 'NOTIFICACAO_1', 'NOTIFICACAO_2'
  recipient_email varchar(255) NOT NULL,
  cc_email varchar(255),
  status varchar(50) DEFAULT 'SENT' CHECK (status IN ('SENT', 'FAILED')),
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- 16. Audit Logs
CREATE TABLE public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES public.profiles(id),
  entity_type varchar(100) NOT NULL,
  entity_id varchar(100) NOT NULL,
  action varchar(100) NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- 17. Integration Events (Idempotency and webhooks)
CREATE TABLE public.integration_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type varchar(100) NOT NULL,
  payload jsonb,
  status varchar(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

-- RLS Setups
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_negotiation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.damages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;

-- Helper Function for auth Supplier ID
CREATE OR REPLACE FUNCTION public.get_auth_supplier_id()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT supplier_id FROM public.profiles WHERE id = auth.uid();
$$;

-- RLS Policies
-- Suppliers can only read their own profiles, etc.
-- Profile
CREATE POLICY profile_read_own ON public.profiles FOR SELECT USING (id = auth.uid());

-- Suppliers
CREATE POLICY supplier_read_own ON public.suppliers FOR SELECT USING (id = public.get_auth_supplier_id());

-- Supplier Contacts
CREATE POLICY supplier_contacts_read_own ON public.supplier_contacts FOR SELECT USING (supplier_id = public.get_auth_supplier_id());

-- Purchase Quotations (Can see if they have a negotiation associated)
CREATE POLICY purchase_quotations_read_own ON public.purchase_quotations FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.supplier_negotiations sn WHERE sn.purchase_quotation_id = public.purchase_quotations.id AND sn.supplier_id = public.get_auth_supplier_id()));

-- Purchase Quotation Items
CREATE POLICY purchase_quotation_items_read_own ON public.purchase_quotation_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.purchase_quotations pq 
  JOIN public.supplier_negotiations sn ON sn.purchase_quotation_id = pq.id
  WHERE pq.id = public.purchase_quotation_items.purchase_quotation_id 
  AND sn.supplier_id = public.get_auth_supplier_id()
));

-- Supplier Negotiations
CREATE POLICY supplier_negotiations_read_own ON public.supplier_negotiations FOR SELECT USING (supplier_id = public.get_auth_supplier_id());
CREATE POLICY supplier_negotiations_update_own ON public.supplier_negotiations FOR UPDATE USING (supplier_id = public.get_auth_supplier_id());

-- Supplier Negotiation Items
CREATE POLICY supplier_negotiation_items_read_own ON public.supplier_negotiation_items FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.supplier_negotiations sn WHERE sn.id = public.supplier_negotiation_items.supplier_negotiation_id AND sn.supplier_id = public.get_auth_supplier_id()));
CREATE POLICY supplier_negotiation_items_update_own ON public.supplier_negotiation_items FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.supplier_negotiations sn WHERE sn.id = public.supplier_negotiation_items.supplier_negotiation_id AND sn.supplier_id = public.get_auth_supplier_id()));
CREATE POLICY supplier_negotiation_items_insert_own ON public.supplier_negotiation_items FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.supplier_negotiations sn WHERE sn.id = public.supplier_negotiation_items.supplier_negotiation_id AND sn.supplier_id = public.get_auth_supplier_id()));

-- Purchase Orders
CREATE POLICY purchase_orders_read_own ON public.purchase_orders FOR SELECT USING (supplier_id = public.get_auth_supplier_id());

-- Purchase Order Items
CREATE POLICY purchase_order_items_read_own ON public.purchase_order_items FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = public.purchase_order_items.purchase_order_id AND po.supplier_id = public.get_auth_supplier_id()));

-- Purchase Invoices
CREATE POLICY purchase_invoices_read_own ON public.purchase_invoices FOR SELECT USING (supplier_id = public.get_auth_supplier_id());

-- Invoice Items
CREATE POLICY invoice_items_read_own ON public.invoice_items FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.purchase_invoices pi WHERE pi.sequential_number = public.invoice_items.invoice_sequential_number AND pi.supplier_id = public.get_auth_supplier_id()));

-- Deliveries
CREATE POLICY deliveries_read_own ON public.deliveries FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = public.deliveries.purchase_order_id AND po.supplier_id = public.get_auth_supplier_id()));

-- Damages
CREATE POLICY damages_read_own ON public.damages FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = public.damages.purchase_order_id AND po.supplier_id = public.get_auth_supplier_id()));
CREATE POLICY damages_insert_own ON public.damages FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = public.damages.purchase_order_id AND po.supplier_id = public.get_auth_supplier_id()) AND reported_by = auth.uid());
CREATE POLICY damages_update_own ON public.damages FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = public.damages.purchase_order_id AND po.supplier_id = public.get_auth_supplier_id()) AND reported_by = auth.uid());

-- Follow up trackers
CREATE POLICY follow_up_trackers_read_own ON public.follow_up_trackers FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = public.follow_up_trackers.purchase_order_id AND po.supplier_id = public.get_auth_supplier_id()));
CREATE POLICY follow_up_trackers_update_own ON public.follow_up_trackers FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = public.follow_up_trackers.purchase_order_id AND po.supplier_id = public.get_auth_supplier_id()));

-- Notifications (Can be kept internal, maybe suppliers can view their own)
CREATE POLICY notifications_read_own ON public.notifications FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.follow_up_trackers t
  JOIN public.purchase_orders po ON po.id = t.purchase_order_id
  WHERE t.id = public.notifications.follow_up_tracker_id AND po.supplier_id = public.get_auth_supplier_id()
));

-- Audit Logs (Only view own actions)
CREATE POLICY audit_logs_read_own ON public.audit_logs FOR SELECT USING (profile_id = auth.uid());

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER set_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER set_purchase_quotations_updated_at BEFORE UPDATE ON public.purchase_quotations FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER set_supplier_negotiations_updated_at BEFORE UPDATE ON public.supplier_negotiations FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER set_supplier_negotiation_items_updated_at BEFORE UPDATE ON public.supplier_negotiation_items FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER set_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER set_purchase_order_items_updated_at BEFORE UPDATE ON public.purchase_order_items FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER set_deliveries_updated_at BEFORE UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER set_damages_updated_at BEFORE UPDATE ON public.damages FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER set_follow_up_trackers_updated_at BEFORE UPDATE ON public.follow_up_trackers FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
