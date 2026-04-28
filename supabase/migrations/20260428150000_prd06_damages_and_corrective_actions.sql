-- PRD-06 Avaria e Ação Corretiva
-- Evolui tabela legada `damages` e adiciona estruturas auxiliares.

-- 1) Expandir tabela `damages` para suportar o fluxo completo de PRD-06
ALTER TABLE public.damages
  ADD COLUMN IF NOT EXISTS reported_by_profile varchar(20),
  ADD COLUMN IF NOT EXISTS suggested_action_notes text,
  ADD COLUMN IF NOT EXISTS suggested_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_action varchar(50),
  ADD COLUMN IF NOT EXISTS final_action_notes text,
  ADD COLUMN IF NOT EXISTS final_action_decided_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS final_action_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS affected_quantity numeric(15,4),
  ADD COLUMN IF NOT EXISTS supplier_id bigint REFERENCES public.suppliers(id),
  ADD COLUMN IF NOT EXISTS building_id bigint;

UPDATE public.damages d
SET
  final_action = COALESCE(d.final_action, d.approved_action),
  supplier_id = COALESCE(
    d.supplier_id,
    (
      SELECT po.supplier_id
      FROM public.purchase_orders po
      WHERE po.id = d.purchase_order_id
    )
  ),
  building_id = COALESCE(
    d.building_id,
    (
      SELECT po.building_id
      FROM public.purchase_orders po
      WHERE po.id = d.purchase_order_id
    )
  ),
  reported_by_profile = COALESCE(
    d.reported_by_profile,
    (
      SELECT CASE
        WHEN p.role = 'FORNECEDOR' THEN 'fornecedor'
        ELSE 'compras'
      END
      FROM public.profiles p
      WHERE p.id = d.reported_by
    )
  )
WHERE d.final_action IS NULL
   OR d.supplier_id IS NULL
   OR d.reported_by_profile IS NULL;

ALTER TABLE public.damages
  ALTER COLUMN supplier_id SET NOT NULL,
  ALTER COLUMN reported_by_profile SET NOT NULL;

ALTER TABLE public.damages DROP CONSTRAINT IF EXISTS damages_status_check;
ALTER TABLE public.damages
  ADD CONSTRAINT damages_status_check
  CHECK (
    status IN (
      'REGISTRADA',
      'SUGESTAO_PENDENTE',
      'ACAO_DEFINIDA',
      'EM_REPOSICAO',
      'CANCELAMENTO_APLICADO',
      'RESOLVIDA'
    )
  );

ALTER TABLE public.damages DROP CONSTRAINT IF EXISTS damages_suggested_action_check;
ALTER TABLE public.damages
  ADD CONSTRAINT damages_suggested_action_check
  CHECK (
    suggested_action IS NULL
    OR suggested_action IN ('CANCELAMENTO_PARCIAL', 'CANCELAMENTO_TOTAL', 'REPOSICAO')
  );

ALTER TABLE public.damages DROP CONSTRAINT IF EXISTS damages_approved_action_check;
ALTER TABLE public.damages DROP CONSTRAINT IF EXISTS damages_final_action_check;
ALTER TABLE public.damages
  ADD CONSTRAINT damages_final_action_check
  CHECK (
    final_action IS NULL
    OR final_action IN ('CANCELAMENTO_PARCIAL', 'CANCELAMENTO_TOTAL', 'REPOSICAO')
  );

ALTER TABLE public.damages DROP CONSTRAINT IF EXISTS damages_reported_by_profile_check;
ALTER TABLE public.damages
  ADD CONSTRAINT damages_reported_by_profile_check
  CHECK (reported_by_profile IN ('fornecedor', 'compras'));

ALTER TABLE public.damages DROP CONSTRAINT IF EXISTS damages_affected_quantity_check;
ALTER TABLE public.damages
  ADD CONSTRAINT damages_affected_quantity_check
  CHECK (affected_quantity IS NULL OR affected_quantity > 0);

ALTER TABLE public.damages DROP CONSTRAINT IF EXISTS damages_final_action_required_fields_check;
ALTER TABLE public.damages
  ADD CONSTRAINT damages_final_action_required_fields_check
  CHECK (
    final_action IS NULL
    OR (final_action_decided_by IS NOT NULL AND final_action_decided_at IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_damages_order_item
  ON public.damages(purchase_order_id, item_number);
CREATE INDEX IF NOT EXISTS idx_damages_supplier
  ON public.damages(supplier_id);
CREATE INDEX IF NOT EXISTS idx_damages_status
  ON public.damages(status);
CREATE INDEX IF NOT EXISTS idx_damages_created_at
  ON public.damages(created_at DESC);

-- 2) Reposição de avaria
CREATE TABLE IF NOT EXISTS public.damage_replacements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  damage_id uuid NOT NULL REFERENCES public.damages(id) ON DELETE CASCADE,
  new_promised_date date NOT NULL,
  informed_by uuid NOT NULL REFERENCES public.profiles(id),
  informed_at timestamptz NOT NULL DEFAULT now(),
  replacement_status varchar(30) NOT NULL DEFAULT 'AGUARDANDO_DATA',
  replacement_scope varchar(20) NOT NULL DEFAULT 'ITEM',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT damage_replacements_status_check
    CHECK (replacement_status IN ('AGUARDANDO_DATA', 'EM_ANDAMENTO', 'ENTREGUE', 'CANCELADO')),
  CONSTRAINT damage_replacements_scope_check
    CHECK (replacement_scope IN ('ITEM', 'PEDIDO'))
);

CREATE INDEX IF NOT EXISTS idx_damage_replacements_damage
  ON public.damage_replacements(damage_id);
CREATE INDEX IF NOT EXISTS idx_damage_replacements_status
  ON public.damage_replacements(replacement_status);

-- 3) Auditoria específica de avaria (sem substituir audit_logs)
CREATE TABLE IF NOT EXISTS public.damage_audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  damage_id uuid NOT NULL REFERENCES public.damages(id) ON DELETE CASCADE,
  event_type varchar(80) NOT NULL,
  actor_user_id uuid REFERENCES public.profiles(id),
  actor_profile varchar(20),
  details jsonb DEFAULT '{}'::jsonb,
  purchase_order_id bigint REFERENCES public.purchase_orders(id),
  supplier_id bigint REFERENCES public.suppliers(id),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT damage_audit_logs_actor_profile_check
    CHECK (actor_profile IS NULL OR actor_profile IN ('fornecedor', 'compras', 'sistema'))
);

CREATE INDEX IF NOT EXISTS idx_damage_audit_logs_damage
  ON public.damage_audit_logs(damage_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_damage_audit_logs_event_type
  ON public.damage_audit_logs(event_type);

-- 4) RLS
ALTER TABLE public.damage_replacements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.damage_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS damage_replacements_read_own ON public.damage_replacements;
CREATE POLICY damage_replacements_read_own
  ON public.damage_replacements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.damages d
      JOIN public.purchase_orders po ON po.id = d.purchase_order_id
      WHERE d.id = public.damage_replacements.damage_id
        AND po.supplier_id = public.get_auth_supplier_id()
    )
  );

DROP POLICY IF EXISTS damage_replacements_update_own ON public.damage_replacements;
CREATE POLICY damage_replacements_update_own
  ON public.damage_replacements
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.damages d
      JOIN public.purchase_orders po ON po.id = d.purchase_order_id
      WHERE d.id = public.damage_replacements.damage_id
        AND po.supplier_id = public.get_auth_supplier_id()
    )
  );

DROP POLICY IF EXISTS damage_audit_logs_read_own ON public.damage_audit_logs;
CREATE POLICY damage_audit_logs_read_own
  ON public.damage_audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.damages d
      JOIN public.purchase_orders po ON po.id = d.purchase_order_id
      WHERE d.id = public.damage_audit_logs.damage_id
        AND po.supplier_id = public.get_auth_supplier_id()
    )
  );

-- 5) Trigger de updated_at para reposições
DROP TRIGGER IF EXISTS set_damage_replacements_updated_at ON public.damage_replacements;
CREATE TRIGGER set_damage_replacements_updated_at
BEFORE UPDATE ON public.damage_replacements
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
