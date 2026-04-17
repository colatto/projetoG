-- PRD-02 (Fluxo de Cotação) — evolução aditiva/híbrida do schema
-- Mantém:
--   - purchase_quotations / purchase_quotation_items (base de importação Sienge)
--   - supplier_negotiations (equivalente funcional de quotation_supplier)
-- Adiciona:
--   - quotation_responses (+ items + deliveries) para versionamento e entregas por item
--
-- Data: 2026-04-17

-- 1) Evolução de purchase_quotations
ALTER TABLE public.purchase_quotations
  ADD COLUMN IF NOT EXISTS public_id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS raw_payload jsonb,
  ADD COLUMN IF NOT EXISTS end_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_quotations_public_id
  ON public.purchase_quotations(public_id);

CREATE INDEX IF NOT EXISTS idx_purchase_quotations_sent_at
  ON public.purchase_quotations(sent_at);

CREATE INDEX IF NOT EXISTS idx_purchase_quotations_end_at
  ON public.purchase_quotations(end_at);

-- 2) Evolução de supplier_negotiations (quotation_supplier)
ALTER TABLE public.supplier_negotiations
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_order_id bigint,
  ADD COLUMN IF NOT EXISTS latest_response_id uuid;

CREATE INDEX IF NOT EXISTS idx_supplier_negotiations_purchase_quotation_id
  ON public.supplier_negotiations(purchase_quotation_id);

CREATE INDEX IF NOT EXISTS idx_supplier_negotiations_supplier_id
  ON public.supplier_negotiations(supplier_id);

-- 3) Novas tabelas de resposta (versionadas)
CREATE TABLE IF NOT EXISTS public.quotation_responses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_negotiation_id uuid NOT NULL REFERENCES public.supplier_negotiations(id) ON DELETE CASCADE,

  version integer NOT NULL,

  -- Campos gerais da resposta (subset alinhado ao PRD-02)
  supplier_answer_date date NOT NULL,
  validity date,
  seller text,
  discount numeric(10, 2),
  freight_type text,
  freight_type_for_order text,
  freight_price numeric(12, 2),
  other_expenses numeric(12, 2),
  apply_ipi_freight boolean,
  internal_notes text,
  supplier_notes text,
  payment_terms text,

  review_status varchar(30) NOT NULL DEFAULT 'pending' CHECK (review_status IN (
    'pending',
    'approved',
    'rejected',
    'correction_requested'
  )),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  review_notes text,

  integration_status varchar(30) NOT NULL DEFAULT 'not_sent' CHECK (integration_status IN (
    'not_sent',
    'pending',
    'success',
    'failed'
  )),
  integration_attempts integer NOT NULL DEFAULT 0,
  last_integration_at timestamptz,
  last_integration_error text,
  sienge_negotiation_number bigint,

  submitted_by uuid REFERENCES public.profiles(id),
  submitted_at timestamptz NOT NULL DEFAULT now(),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_quotation_responses_version UNIQUE (supplier_negotiation_id, version)
);

CREATE INDEX IF NOT EXISTS idx_quotation_responses_supplier_negotiation_id
  ON public.quotation_responses(supplier_negotiation_id);

CREATE INDEX IF NOT EXISTS idx_quotation_responses_review_status
  ON public.quotation_responses(review_status);

CREATE INDEX IF NOT EXISTS idx_quotation_responses_integration_status
  ON public.quotation_responses(integration_status);

-- FK de supplier_negotiations.latest_response_id (precisa existir depois da tabela)
ALTER TABLE public.supplier_negotiations
  ADD CONSTRAINT fk_supplier_negotiations_latest_response
  FOREIGN KEY (latest_response_id) REFERENCES public.quotation_responses(id)
  DEFERRABLE INITIALLY DEFERRED;

-- 4) Itens da resposta
CREATE TABLE IF NOT EXISTS public.quotation_response_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_response_id uuid NOT NULL REFERENCES public.quotation_responses(id) ON DELETE CASCADE,
  -- purchaseQuotationItemId (Sienge) — needed to write back via existing worker payload
  purchase_quotation_item_id bigint NOT NULL REFERENCES public.purchase_quotation_items(id) ON DELETE RESTRICT,
  -- item number in the quotation (kept for UI/PRD semantics)
  quotation_item_number integer NOT NULL,
  detail_id bigint,
  trademark_id bigint,
  quoted_quantity numeric(12, 4) NOT NULL,
  negotiated_quantity numeric(12, 4) NOT NULL,
  unit_price numeric(12, 4) NOT NULL,
  discount numeric(10, 2),
  discount_percentage numeric(5, 2),
  increase_percentage numeric(5, 2),
  ipi_tax_percentage numeric(5, 2),
  iss_tax_percentage numeric(5, 2),
  icms_tax_percentage numeric(5, 2),
  freight_unit_price numeric(12, 4),
  selected_option boolean,
  internal_notes text,
  supplier_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_quotation_response_items UNIQUE (quotation_response_id, purchase_quotation_item_id)
);

CREATE INDEX IF NOT EXISTS idx_quotation_response_items_response
  ON public.quotation_response_items(quotation_response_id);

-- 5) Entregas por item
CREATE TABLE IF NOT EXISTS public.quotation_response_item_deliveries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_response_item_id uuid NOT NULL REFERENCES public.quotation_response_items(id) ON DELETE CASCADE,
  delivery_number integer NOT NULL,
  delivery_date date NOT NULL,
  delivery_quantity numeric(12, 4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_quotation_response_item_deliveries UNIQUE (quotation_response_item_id, delivery_number)
);

CREATE INDEX IF NOT EXISTS idx_quotation_response_item_deliveries_item
  ON public.quotation_response_item_deliveries(quotation_response_item_id);

-- 6) RLS
ALTER TABLE public.quotation_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_response_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_response_item_deliveries ENABLE ROW LEVEL SECURITY;

-- 6.1) Policies: leitura/insert do fornecedor (via supplier_negotiations.supplier_id)
CREATE POLICY quotation_responses_read_own ON public.quotation_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.supplier_negotiations sn
      WHERE sn.id = public.quotation_responses.supplier_negotiation_id
        AND sn.supplier_id = public.get_auth_supplier_id()
    )
  );

CREATE POLICY quotation_responses_insert_own ON public.quotation_responses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.supplier_negotiations sn
      WHERE sn.id = public.quotation_responses.supplier_negotiation_id
        AND sn.supplier_id = public.get_auth_supplier_id()
    )
  );

CREATE POLICY quotation_response_items_read_own ON public.quotation_response_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.quotation_responses qr
      JOIN public.supplier_negotiations sn ON sn.id = qr.supplier_negotiation_id
      WHERE qr.id = public.quotation_response_items.quotation_response_id
        AND sn.supplier_id = public.get_auth_supplier_id()
    )
  );

CREATE POLICY quotation_response_items_insert_own ON public.quotation_response_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.quotation_responses qr
      JOIN public.supplier_negotiations sn ON sn.id = qr.supplier_negotiation_id
      WHERE qr.id = public.quotation_response_items.quotation_response_id
        AND sn.supplier_id = public.get_auth_supplier_id()
    )
  );

CREATE POLICY quotation_response_item_deliveries_read_own ON public.quotation_response_item_deliveries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.quotation_response_items qri
      JOIN public.quotation_responses qr ON qr.id = qri.quotation_response_id
      JOIN public.supplier_negotiations sn ON sn.id = qr.supplier_negotiation_id
      WHERE qri.id = public.quotation_response_item_deliveries.quotation_response_item_id
        AND sn.supplier_id = public.get_auth_supplier_id()
    )
  );

CREATE POLICY quotation_response_item_deliveries_insert_own ON public.quotation_response_item_deliveries
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.quotation_response_items qri
      JOIN public.quotation_responses qr ON qr.id = qri.quotation_response_id
      JOIN public.supplier_negotiations sn ON sn.id = qr.supplier_negotiation_id
      WHERE qri.id = public.quotation_response_item_deliveries.quotation_response_item_id
        AND sn.supplier_id = public.get_auth_supplier_id()
    )
  );

-- 7) updated_at triggers (reusa a função existente, se já criada)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_current_timestamp_updated_at') THEN
    EXECUTE 'CREATE TRIGGER set_quotation_responses_updated_at BEFORE UPDATE ON public.quotation_responses FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at()';
    EXECUTE 'CREATE TRIGGER set_quotation_response_items_updated_at BEFORE UPDATE ON public.quotation_response_items FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at()';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Trigger já existe
    NULL;
END $$;

