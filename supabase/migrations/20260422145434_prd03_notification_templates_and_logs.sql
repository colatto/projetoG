-- Create Enums
CREATE TYPE public.notification_type AS ENUM ('new_quotation', 'quotation_reminder', 'no_response_alert');
CREATE TYPE public.notification_status AS ENUM ('sent', 'failed', 'bounced');

-- 1. Notification Templates
CREATE TABLE public.notification_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type notification_type NOT NULL,
  subject_template text NOT NULL,
  body_template text NOT NULL,
  mandatory_placeholders jsonb NOT NULL,
  version integer DEFAULT 1,
  updated_by uuid REFERENCES public.profiles(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Partial unique index to guarantee exactly 1 active template per type
CREATE UNIQUE INDEX idx_notification_templates_active_type ON public.notification_templates (type) WHERE is_active = true;
CREATE INDEX idx_notification_templates_type ON public.notification_templates (type);

-- 2. Notification Logs
CREATE TABLE public.notification_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid REFERENCES public.notification_templates(id),
  template_version integer,
  type notification_type NOT NULL,
  recipient_email varchar(255) NOT NULL,
  recipient_supplier_id bigint REFERENCES public.suppliers(id),
  recipient_user_id uuid REFERENCES public.profiles(id),
  quotation_id bigint REFERENCES public.purchase_quotations(id),
  subject text NOT NULL,
  body_snapshot text NOT NULL,
  status notification_status DEFAULT 'sent',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  triggered_by uuid REFERENCES public.profiles(id)
);

-- Indices for reporting and lookups
CREATE INDEX idx_notification_logs_quotation_id ON public.notification_logs (quotation_id);
CREATE INDEX idx_notification_logs_supplier_id ON public.notification_logs (recipient_supplier_id);
CREATE INDEX idx_notification_logs_type_status ON public.notification_logs (type, status);
CREATE INDEX idx_notification_logs_sent_at ON public.notification_logs (sent_at);

-- RLS
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Note: No SELECT policies are defined here because access is strictly handled via service_role in the backend API (for backoffice users with roles Administrador/Compras)
-- If we ever need the supplier to see their own notifications, we can add a policy like:
-- CREATE POLICY notification_logs_read_own ON public.notification_logs FOR SELECT USING (recipient_supplier_id = public.get_auth_supplier_id());

-- Triggers for updated_at
CREATE TRIGGER set_notification_templates_updated_at BEFORE UPDATE ON public.notification_templates FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Insert initial templates
INSERT INTO public.notification_templates (type, subject_template, body_template, mandatory_placeholders) VALUES
(
  'new_quotation',
  'Nova Cotação GRF: {{quotationId}}',
  '<p>Olá,</p><p>Você possui uma nova solicitação de cotação <strong>{{quotationId}}</strong> aguardando resposta na plataforma da GRF.</p><p>Acesse o portal do fornecedor para visualizar os detalhes e enviar sua proposta.</p><p>Link: {{link}}</p>',
  '["quotationId", "link"]'::jsonb
),
(
  'quotation_reminder',
  'Lembrete de Cotação GRF: {{quotationId}}',
  '<p>Olá,</p><p>Lembramos que a cotação <strong>{{quotationId}}</strong> continua aguardando sua resposta na plataforma da GRF. O prazo encerra em breve.</p><p>Link: {{link}}</p>',
  '["quotationId", "link"]'::jsonb
),
(
  'no_response_alert',
  'Alerta de Fornecedores Sem Resposta - Cotação {{quotationId}}',
  '<p>Olá,</p><p>A cotação <strong>{{quotationId}}</strong> foi encerrada e os seguintes fornecedores não enviaram resposta:</p><ul>{{supplierList}}</ul>',
  '["quotationId", "supplierList"]'::jsonb
);
