drop policy "audit_logs_read_own" on "public"."audit_logs";

drop policy "damages_insert_own" on "public"."damages";

drop policy "damages_update_own" on "public"."damages";

drop policy "dashboard_criticidade_item_service_role_all" on "public"."dashboard_criticidade_item";

drop policy "dashboard_snapshot_service_role_all" on "public"."dashboard_snapshot";

drop policy "dashboard_snapshot_por_fornecedor_service_role_all" on "public"."dashboard_snapshot_por_fornecedor";

drop policy "dashboard_snapshot_por_obra_service_role_all" on "public"."dashboard_snapshot_por_obra";

drop policy "profile_read_own" on "public"."profiles";

alter table "public"."business_days_holidays" enable row level security;

alter table "public"."follow_up_date_changes" enable row level security;

CREATE INDEX idx_notification_logs_recipient_user_id ON public.notification_logs USING btree (recipient_user_id);

CREATE INDEX idx_notification_logs_template_id ON public.notification_logs USING btree (template_id);

CREATE INDEX idx_purchase_orders_supplier_id ON public.purchase_orders USING btree (supplier_id);

CREATE INDEX idx_purchase_quotation_items_quotation_id ON public.purchase_quotation_items USING btree (purchase_quotation_id);

CREATE INDEX idx_supplier_contacts_supplier_id ON public.supplier_contacts USING btree (supplier_id);


  create policy "business_days_holidays_service_role_all"
  on "public"."business_days_holidays"
  as permissive
  for all
  to public
using ((( SELECT auth.role() AS role) = 'service_role'::text))
with check ((( SELECT auth.role() AS role) = 'service_role'::text));



  create policy "follow_up_date_changes_service_role_all"
  on "public"."follow_up_date_changes"
  as permissive
  for all
  to public
using ((( SELECT auth.role() AS role) = 'service_role'::text))
with check ((( SELECT auth.role() AS role) = 'service_role'::text));



  create policy "integration_events_service_role_all"
  on "public"."integration_events"
  as permissive
  for all
  to public
using ((( SELECT auth.role() AS role) = 'service_role'::text))
with check ((( SELECT auth.role() AS role) = 'service_role'::text));



  create policy "notification_logs_service_role_all"
  on "public"."notification_logs"
  as permissive
  for all
  to public
using ((( SELECT auth.role() AS role) = 'service_role'::text))
with check ((( SELECT auth.role() AS role) = 'service_role'::text));



  create policy "notification_templates_service_role_all"
  on "public"."notification_templates"
  as permissive
  for all
  to public
using ((( SELECT auth.role() AS role) = 'service_role'::text))
with check ((( SELECT auth.role() AS role) = 'service_role'::text));



  create policy "profiles_service_role_delete"
  on "public"."profiles"
  as permissive
  for delete
  to service_role
using (true);



  create policy "profiles_service_role_insert"
  on "public"."profiles"
  as permissive
  for insert
  to service_role
with check (true);



  create policy "profiles_service_role_select"
  on "public"."profiles"
  as permissive
  for select
  to service_role
using (true);



  create policy "profiles_service_role_update"
  on "public"."profiles"
  as permissive
  for update
  to service_role
using (true);



  create policy "sienge_credentials_service_role_all"
  on "public"."sienge_credentials"
  as permissive
  for all
  to public
using ((( SELECT auth.role() AS role) = 'service_role'::text))
with check ((( SELECT auth.role() AS role) = 'service_role'::text));



  create policy "sienge_sync_cursor_service_role_all"
  on "public"."sienge_sync_cursor"
  as permissive
  for all
  to public
using ((( SELECT auth.role() AS role) = 'service_role'::text))
with check ((( SELECT auth.role() AS role) = 'service_role'::text));



  create policy "webhook_events_service_role_all"
  on "public"."webhook_events"
  as permissive
  for all
  to public
using ((( SELECT auth.role() AS role) = 'service_role'::text))
with check ((( SELECT auth.role() AS role) = 'service_role'::text));



  create policy "audit_logs_read_own"
  on "public"."audit_logs"
  as permissive
  for select
  to public
using ((actor_id = ( SELECT auth.uid() AS uid)));



  create policy "damages_insert_own"
  on "public"."damages"
  as permissive
  for insert
  to public
with check (((EXISTS ( SELECT 1
   FROM public.purchase_orders po
  WHERE ((po.id = damages.purchase_order_id) AND (po.supplier_id = ( SELECT public.get_auth_supplier_id() AS get_auth_supplier_id))))) AND (reported_by = ( SELECT auth.uid() AS uid))));



  create policy "damages_update_own"
  on "public"."damages"
  as permissive
  for update
  to public
using (((EXISTS ( SELECT 1
   FROM public.purchase_orders po
  WHERE ((po.id = damages.purchase_order_id) AND (po.supplier_id = ( SELECT public.get_auth_supplier_id() AS get_auth_supplier_id))))) AND (reported_by = ( SELECT auth.uid() AS uid))));



  create policy "dashboard_criticidade_item_service_role_all"
  on "public"."dashboard_criticidade_item"
  as permissive
  for all
  to public
using ((( SELECT auth.role() AS role) = 'service_role'::text))
with check ((( SELECT auth.role() AS role) = 'service_role'::text));



  create policy "dashboard_snapshot_service_role_all"
  on "public"."dashboard_snapshot"
  as permissive
  for all
  to public
using ((( SELECT auth.role() AS role) = 'service_role'::text))
with check ((( SELECT auth.role() AS role) = 'service_role'::text));



  create policy "dashboard_snapshot_por_fornecedor_service_role_all"
  on "public"."dashboard_snapshot_por_fornecedor"
  as permissive
  for all
  to public
using ((( SELECT auth.role() AS role) = 'service_role'::text))
with check ((( SELECT auth.role() AS role) = 'service_role'::text));



  create policy "dashboard_snapshot_por_obra_service_role_all"
  on "public"."dashboard_snapshot_por_obra"
  as permissive
  for all
  to public
using ((( SELECT auth.role() AS role) = 'service_role'::text))
with check ((( SELECT auth.role() AS role) = 'service_role'::text));



  create policy "profile_read_own"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((id = ( SELECT auth.uid() AS uid)));



