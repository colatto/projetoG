-- Create Enums for Auth and RBAC
CREATE TYPE public.user_role AS ENUM ('fornecedor', 'compras', 'administrador', 'visualizador_pedidos');
CREATE TYPE public.user_status AS ENUM ('pendente', 'ativo', 'bloqueado', 'removido');

-- Drop old check constraint on profiles.role
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Standardize any existing data to match new enum
UPDATE public.profiles SET role = 'fornecedor' WHERE role = 'FORNECEDOR';
UPDATE public.profiles SET role = 'compras' WHERE role = 'COMPRAS';
UPDATE public.profiles SET role = 'administrador' WHERE role = 'ADMINISTRADOR';
UPDATE public.profiles SET role = 'visualizador_pedidos' WHERE role = 'VISUALIZADOR_DE_PEDIDOS';

-- Alter profiles to align with PRD01 users definition
ALTER TABLE public.profiles 
  ALTER COLUMN role TYPE public.user_role USING role::public.user_role,
  ADD COLUMN status public.user_status NOT NULL DEFAULT 'pendente',
  ADD COLUMN original_email varchar(255),
  ADD COLUMN created_by uuid REFERENCES public.profiles(id),
  ADD COLUMN blocked_at timestamptz,
  ADD COLUMN blocked_by uuid REFERENCES public.profiles(id);

-- Create specific constraints and indexes on profiles as per PRD
CREATE UNIQUE INDEX IF NOT EXISTS profiles_supplier_id_active_idx 
  ON public.profiles(supplier_id) 
  WHERE role = 'fornecedor' AND status != 'removido';

CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);
CREATE INDEX IF NOT EXISTS profiles_status_idx ON public.profiles(status);

-- Align audit_logs with PRD01 definition (instead of dropping/recreating, we alter to preserve existing logs if any)
ALTER TABLE public.audit_logs
  RENAME COLUMN profile_id TO actor_id;
ALTER TABLE public.audit_logs
  RENAME COLUMN action TO event_type;
ALTER TABLE public.audit_logs
  RENAME COLUMN details TO metadata;

ALTER TABLE public.audit_logs
  ALTER COLUMN entity_type DROP NOT NULL,
  ALTER COLUMN entity_id DROP NOT NULL,
  ADD COLUMN target_user_id uuid REFERENCES public.profiles(id);

-- Add indexes for audit_logs as per PRD
CREATE INDEX IF NOT EXISTS audit_logs_event_type_idx ON public.audit_logs(event_type);
CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_target_user_id_idx ON public.audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs(created_at);
