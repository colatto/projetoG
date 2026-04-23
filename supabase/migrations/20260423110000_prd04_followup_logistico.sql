-- PRD-04 Follow-up Logístico
-- Extend follow-up model and notification types for logistics workflow.

-- 1) Extend notification enum with PRD-04 types (idempotent style guarded by DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'followup_reminder'
      AND enumtypid = 'public.notification_type'::regtype
  ) THEN
    ALTER TYPE public.notification_type ADD VALUE 'followup_reminder';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'overdue_alert'
      AND enumtypid = 'public.notification_type'::regtype
  ) THEN
    ALTER TYPE public.notification_type ADD VALUE 'overdue_alert';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'confirmation_received'
      AND enumtypid = 'public.notification_type'::regtype
  ) THEN
    ALTER TYPE public.notification_type ADD VALUE 'confirmation_received';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'new_date_pending'
      AND enumtypid = 'public.notification_type'::regtype
  ) THEN
    ALTER TYPE public.notification_type ADD VALUE 'new_date_pending';
  END IF;
END
$$;

-- 2) Follow-up holidays table
CREATE TABLE IF NOT EXISTS public.business_days_holidays (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_date date NOT NULL UNIQUE,
  name varchar(255) NOT NULL,
  year integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_days_holidays_year
  ON public.business_days_holidays(year);

-- 3) Extend follow_up_trackers to match PRD-04 fields while preserving legacy semantics
ALTER TABLE public.follow_up_trackers
  ADD COLUMN IF NOT EXISTS supplier_id bigint REFERENCES public.suppliers(id),
  ADD COLUMN IF NOT EXISTS order_date date,
  ADD COLUMN IF NOT EXISTS promised_date_original date,
  ADD COLUMN IF NOT EXISTS promised_date_current date,
  ADD COLUMN IF NOT EXISTS current_notification_number integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_notification_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_notification_date date,
  ADD COLUMN IF NOT EXISTS supplier_response_type varchar(50),
  ADD COLUMN IF NOT EXISTS suggested_date_status varchar(50),
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS building_id bigint,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_reason varchar(100);

UPDATE public.follow_up_trackers
SET
  order_date = COALESCE(order_date, base_date),
  promised_date_original = COALESCE(promised_date_original, current_delivery_date),
  promised_date_current = COALESCE(promised_date_current, current_delivery_date)
WHERE order_date IS NULL
   OR promised_date_original IS NULL
   OR promised_date_current IS NULL;

UPDATE public.follow_up_trackers t
SET supplier_id = po.supplier_id
FROM public.purchase_orders po
WHERE t.purchase_order_id = po.id
  AND t.supplier_id IS NULL;

ALTER TABLE public.follow_up_trackers
  ALTER COLUMN order_date SET NOT NULL,
  ALTER COLUMN promised_date_original SET NOT NULL,
  ALTER COLUMN promised_date_current SET NOT NULL;

ALTER TABLE public.follow_up_trackers DROP CONSTRAINT IF EXISTS follow_up_trackers_status_check;

ALTER TABLE public.follow_up_trackers
  ADD CONSTRAINT follow_up_trackers_status_check
  CHECK (
    status IN (
      'ATIVO',
      'PAUSADO',
      'CONCLUIDO',
      'ATRASADO',
      'CANCELADO',
      'ENCERRADO',
      'NOVA_DATA_SUGERIDA',
      'NOVA_DATA_APROVADA'
    )
  );

ALTER TABLE public.follow_up_trackers DROP CONSTRAINT IF EXISTS follow_up_trackers_supplier_response_type_check;
ALTER TABLE public.follow_up_trackers
  ADD CONSTRAINT follow_up_trackers_supplier_response_type_check
  CHECK (
    supplier_response_type IS NULL
    OR supplier_response_type IN ('confirmed_on_time', 'suggested_new_date', 'none')
  );

ALTER TABLE public.follow_up_trackers DROP CONSTRAINT IF EXISTS follow_up_trackers_suggested_date_status_check;
ALTER TABLE public.follow_up_trackers
  ADD CONSTRAINT follow_up_trackers_suggested_date_status_check
  CHECK (
    suggested_date_status IS NULL
    OR suggested_date_status IN ('pending_approval', 'approved', 'rejected')
  );

ALTER TABLE public.follow_up_trackers DROP CONSTRAINT IF EXISTS follow_up_trackers_promised_date_valid_check;
ALTER TABLE public.follow_up_trackers
  ADD CONSTRAINT follow_up_trackers_promised_date_valid_check
  CHECK (promised_date_current >= order_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_follow_up_tracker_active_po_supplier
  ON public.follow_up_trackers(purchase_order_id, supplier_id)
  WHERE status IN ('ATIVO', 'PAUSADO', 'NOVA_DATA_SUGERIDA');

CREATE INDEX IF NOT EXISTS idx_follow_up_trackers_scheduler
  ON public.follow_up_trackers(status, next_notification_date);

CREATE INDEX IF NOT EXISTS idx_follow_up_trackers_supplier_id
  ON public.follow_up_trackers(supplier_id);

-- 4) Follow-up date change history
CREATE TABLE IF NOT EXISTS public.follow_up_date_changes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  follow_up_tracker_id uuid NOT NULL REFERENCES public.follow_up_trackers(id) ON DELETE CASCADE,
  previous_date date NOT NULL,
  suggested_date date NOT NULL,
  suggested_by uuid NOT NULL REFERENCES public.profiles(id),
  suggested_at timestamptz NOT NULL DEFAULT now(),
  decision varchar(20),
  decided_by uuid REFERENCES public.profiles(id),
  decided_at timestamptz,
  reason text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT follow_up_date_changes_decision_check
    CHECK (decision IS NULL OR decision IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_follow_up_date_changes_tracker
  ON public.follow_up_date_changes(follow_up_tracker_id, created_at DESC);

-- 5) Extend notification_logs for follow-up references
ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS purchase_order_id bigint REFERENCES public.purchase_orders(id),
  ADD COLUMN IF NOT EXISTS follow_up_tracker_id uuid REFERENCES public.follow_up_trackers(id),
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_notification_logs_purchase_order_id
  ON public.notification_logs(purchase_order_id);

CREATE INDEX IF NOT EXISTS idx_notification_logs_follow_up_tracker_id
  ON public.notification_logs(follow_up_tracker_id);
