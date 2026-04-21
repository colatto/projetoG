-- PRD-02 Schema Hardening (Prioridade 2)
-- 1. Expand supplier_negotiations.status CHECK to include FORNECEDOR_INVALIDO_MAPA
-- 2. Trigger to prevent end_at/end_date mutation after quotation is sent
-- Date: 2026-04-21

-- ============================================================
-- 1) Expand supplier_negotiations.status CHECK constraint
-- ============================================================
-- Drop existing CHECK and recreate with the new value.
-- The existing constraint was defined inline in the CREATE TABLE,
-- so we need to find and drop it by name.

DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Find the CHECK constraint on supplier_negotiations.status
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'supplier_negotiations'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.supplier_negotiations DROP CONSTRAINT %I', constraint_name);
  END IF;
END
$$;

ALTER TABLE public.supplier_negotiations
  ADD CONSTRAINT supplier_negotiations_status_check
  CHECK (status IN (
    'AGUARDANDO_RESPOSTA',
    'AGUARDANDO_REVISAO',
    'APROVADA',
    'REPROVADA',
    'CORRECAO_SOLICITADA',
    'AGUARDANDO_REENVIO_SIENGE',
    'INTEGRADA_SIENGE',
    'SEM_RESPOSTA',
    'FORNECEDOR_FECHADO',
    'FORNECEDOR_INVALIDO_MAPA',
    'ENCERRADA'
  ));

-- ============================================================
-- 2) Trigger: prevent end_at/end_date changes after sent
-- ============================================================
-- PRD-02 §Critério 4: end_date é imutável após envio.
-- Once sent_at IS NOT NULL, any attempt to change end_at or
-- end_date is blocked at the DB level.

CREATE OR REPLACE FUNCTION public.prevent_end_date_change_after_send()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.sent_at IS NOT NULL AND (
    NEW.end_at IS DISTINCT FROM OLD.end_at OR
    NEW.end_date IS DISTINCT FROM OLD.end_date
  ) THEN
    RAISE EXCEPTION 'end_at/end_date cannot be changed after quotation is sent (sent_at is set)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_end_date_change ON public.purchase_quotations;

CREATE TRIGGER trg_prevent_end_date_change
  BEFORE UPDATE ON public.purchase_quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_end_date_change_after_send();
