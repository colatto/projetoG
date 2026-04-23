-- PRD-04 notification templates
-- This runs in a separate migration so the enum values added in the
-- previous migration are committed before being used in INSERTs.

INSERT INTO public.notification_templates (
  type,
  subject_template,
  body_template,
  mandatory_placeholders
)
SELECT
  'followup_reminder',
  'Follow-up pedido {{purchaseOrderId}} - Notificação {{notificationNumber}}',
  '<p>Olá,</p><p>Este é um lembrete de follow-up do pedido <strong>{{purchaseOrderId}}</strong>.</p><p>Data prometida atual: {{promisedDate}}</p><p>Notificação {{notificationNumber}}</p>',
  '["purchaseOrderId", "promisedDate", "notificationNumber"]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_templates WHERE type = 'followup_reminder' AND is_active = true
);

INSERT INTO public.notification_templates (
  type,
  subject_template,
  body_template,
  mandatory_placeholders
)
SELECT
  'overdue_alert',
  'Pedido {{purchaseOrderId}} sinalizado como atrasado',
  '<p>O pedido <strong>{{purchaseOrderId}}</strong> foi sinalizado como <strong>Atrasado</strong>.</p><p>Data prometida vencida: {{promisedDate}}</p>',
  '["purchaseOrderId", "promisedDate"]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_templates WHERE type = 'overdue_alert' AND is_active = true
);

INSERT INTO public.notification_templates (
  type,
  subject_template,
  body_template,
  mandatory_placeholders
)
SELECT
  'confirmation_received',
  'Confirmação recebida para pedido {{purchaseOrderId}}',
  '<p>O fornecedor confirmou a entrega no prazo para o pedido <strong>{{purchaseOrderId}}</strong>.</p><p>Data prometida: {{promisedDate}}</p>',
  '["purchaseOrderId", "promisedDate"]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_templates WHERE type = 'confirmation_received' AND is_active = true
);

INSERT INTO public.notification_templates (
  type,
  subject_template,
  body_template,
  mandatory_placeholders
)
SELECT
  'new_date_pending',
  'Nova data pendente de aprovação - pedido {{purchaseOrderId}}',
  '<p>O fornecedor sugeriu nova data para o pedido <strong>{{purchaseOrderId}}</strong>.</p><p>Data sugerida: {{suggestedDate}}</p><p>Motivo: {{reason}}</p>',
  '["purchaseOrderId", "suggestedDate", "reason"]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_templates WHERE type = 'new_date_pending' AND is_active = true
);
