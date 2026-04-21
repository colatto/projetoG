create schema if not exists "pgboss";

create type "pgboss"."job_state" as enum ('created', 'retry', 'active', 'completed', 'expired', 'cancelled', 'failed');

drop trigger if exists "set_quotation_response_items_updated_at" on "public"."quotation_response_items";

drop trigger if exists "set_quotation_responses_updated_at" on "public"."quotation_responses";

drop trigger if exists "update_sienge_sync_cursor_updated_at_trigger" on "public"."sienge_sync_cursor";

drop policy "quotation_response_item_deliveries_insert_own" on "public"."quotation_response_item_deliveries";

drop policy "quotation_response_item_deliveries_read_own" on "public"."quotation_response_item_deliveries";

drop policy "quotation_response_items_insert_own" on "public"."quotation_response_items";

drop policy "quotation_response_items_read_own" on "public"."quotation_response_items";

drop policy "quotation_responses_insert_own" on "public"."quotation_responses";

drop policy "quotation_responses_read_own" on "public"."quotation_responses";

revoke delete on table "public"."quotation_response_item_deliveries" from "anon";

revoke insert on table "public"."quotation_response_item_deliveries" from "anon";

revoke references on table "public"."quotation_response_item_deliveries" from "anon";

revoke select on table "public"."quotation_response_item_deliveries" from "anon";

revoke trigger on table "public"."quotation_response_item_deliveries" from "anon";

revoke truncate on table "public"."quotation_response_item_deliveries" from "anon";

revoke update on table "public"."quotation_response_item_deliveries" from "anon";

revoke delete on table "public"."quotation_response_item_deliveries" from "authenticated";

revoke insert on table "public"."quotation_response_item_deliveries" from "authenticated";

revoke references on table "public"."quotation_response_item_deliveries" from "authenticated";

revoke select on table "public"."quotation_response_item_deliveries" from "authenticated";

revoke trigger on table "public"."quotation_response_item_deliveries" from "authenticated";

revoke truncate on table "public"."quotation_response_item_deliveries" from "authenticated";

revoke update on table "public"."quotation_response_item_deliveries" from "authenticated";

revoke delete on table "public"."quotation_response_item_deliveries" from "service_role";

revoke insert on table "public"."quotation_response_item_deliveries" from "service_role";

revoke references on table "public"."quotation_response_item_deliveries" from "service_role";

revoke select on table "public"."quotation_response_item_deliveries" from "service_role";

revoke trigger on table "public"."quotation_response_item_deliveries" from "service_role";

revoke truncate on table "public"."quotation_response_item_deliveries" from "service_role";

revoke update on table "public"."quotation_response_item_deliveries" from "service_role";

revoke delete on table "public"."quotation_response_items" from "anon";

revoke insert on table "public"."quotation_response_items" from "anon";

revoke references on table "public"."quotation_response_items" from "anon";

revoke select on table "public"."quotation_response_items" from "anon";

revoke trigger on table "public"."quotation_response_items" from "anon";

revoke truncate on table "public"."quotation_response_items" from "anon";

revoke update on table "public"."quotation_response_items" from "anon";

revoke delete on table "public"."quotation_response_items" from "authenticated";

revoke insert on table "public"."quotation_response_items" from "authenticated";

revoke references on table "public"."quotation_response_items" from "authenticated";

revoke select on table "public"."quotation_response_items" from "authenticated";

revoke trigger on table "public"."quotation_response_items" from "authenticated";

revoke truncate on table "public"."quotation_response_items" from "authenticated";

revoke update on table "public"."quotation_response_items" from "authenticated";

revoke delete on table "public"."quotation_response_items" from "service_role";

revoke insert on table "public"."quotation_response_items" from "service_role";

revoke references on table "public"."quotation_response_items" from "service_role";

revoke select on table "public"."quotation_response_items" from "service_role";

revoke trigger on table "public"."quotation_response_items" from "service_role";

revoke truncate on table "public"."quotation_response_items" from "service_role";

revoke update on table "public"."quotation_response_items" from "service_role";

revoke delete on table "public"."quotation_responses" from "anon";

revoke insert on table "public"."quotation_responses" from "anon";

revoke references on table "public"."quotation_responses" from "anon";

revoke select on table "public"."quotation_responses" from "anon";

revoke trigger on table "public"."quotation_responses" from "anon";

revoke truncate on table "public"."quotation_responses" from "anon";

revoke update on table "public"."quotation_responses" from "anon";

revoke delete on table "public"."quotation_responses" from "authenticated";

revoke insert on table "public"."quotation_responses" from "authenticated";

revoke references on table "public"."quotation_responses" from "authenticated";

revoke select on table "public"."quotation_responses" from "authenticated";

revoke trigger on table "public"."quotation_responses" from "authenticated";

revoke truncate on table "public"."quotation_responses" from "authenticated";

revoke update on table "public"."quotation_responses" from "authenticated";

revoke delete on table "public"."quotation_responses" from "service_role";

revoke insert on table "public"."quotation_responses" from "service_role";

revoke references on table "public"."quotation_responses" from "service_role";

revoke select on table "public"."quotation_responses" from "service_role";

revoke trigger on table "public"."quotation_responses" from "service_role";

revoke truncate on table "public"."quotation_responses" from "service_role";

revoke update on table "public"."quotation_responses" from "service_role";

alter table "public"."deliveries" drop constraint "deliveries_po_item_invoice_key";

alter table "public"."purchase_quotations" drop constraint "purchase_quotations_sent_by_fkey";

alter table "public"."quotation_response_item_deliveries" drop constraint "quotation_response_item_deliver_quotation_response_item_id_fkey";

alter table "public"."quotation_response_item_deliveries" drop constraint "uq_quotation_response_item_deliveries";

alter table "public"."quotation_response_items" drop constraint "quotation_response_items_purchase_quotation_item_id_fkey";

alter table "public"."quotation_response_items" drop constraint "quotation_response_items_quotation_response_id_fkey";

alter table "public"."quotation_response_items" drop constraint "uq_quotation_response_items";

alter table "public"."quotation_responses" drop constraint "quotation_responses_integration_status_check";

alter table "public"."quotation_responses" drop constraint "quotation_responses_review_status_check";

alter table "public"."quotation_responses" drop constraint "quotation_responses_reviewed_by_fkey";

alter table "public"."quotation_responses" drop constraint "quotation_responses_submitted_by_fkey";

alter table "public"."quotation_responses" drop constraint "quotation_responses_supplier_negotiation_id_fkey";

alter table "public"."quotation_responses" drop constraint "uq_quotation_responses_version";

alter table "public"."supplier_negotiations" drop constraint "fk_supplier_negotiations_latest_response";

drop function if exists "public"."update_sienge_sync_cursor_updated_at"();

alter table "public"."quotation_response_item_deliveries" drop constraint "quotation_response_item_deliveries_pkey";

alter table "public"."quotation_response_items" drop constraint "quotation_response_items_pkey";

alter table "public"."quotation_responses" drop constraint "quotation_responses_pkey";

drop index if exists "public"."deliveries_po_item_invoice_key";

drop index if exists "public"."idx_purchase_quotations_end_at";

drop index if exists "public"."idx_purchase_quotations_public_id";

drop index if exists "public"."idx_purchase_quotations_sent_at";

drop index if exists "public"."idx_quotation_response_item_deliveries_item";

drop index if exists "public"."idx_quotation_response_items_response";

drop index if exists "public"."idx_quotation_responses_integration_status";

drop index if exists "public"."idx_quotation_responses_review_status";

drop index if exists "public"."idx_quotation_responses_supplier_negotiation_id";

drop index if exists "public"."idx_supplier_negotiations_purchase_quotation_id";

drop index if exists "public"."idx_supplier_negotiations_supplier_id";

drop index if exists "public"."idx_webhook_events_delivery_id";

drop index if exists "public"."quotation_response_item_deliveries_pkey";

drop index if exists "public"."quotation_response_items_pkey";

drop index if exists "public"."quotation_responses_pkey";

drop index if exists "public"."uq_quotation_response_item_deliveries";

drop index if exists "public"."uq_quotation_response_items";

drop index if exists "public"."uq_quotation_responses_version";

drop table "public"."quotation_response_item_deliveries";

drop table "public"."quotation_response_items";

drop table "public"."quotation_responses";


  create table "pgboss"."archive" (
    "id" uuid not null,
    "name" text not null,
    "priority" integer not null,
    "data" jsonb,
    "state" pgboss.job_state not null,
    "retrylimit" integer not null,
    "retrycount" integer not null,
    "retrydelay" integer not null,
    "retrybackoff" boolean not null,
    "startafter" timestamp with time zone not null,
    "startedon" timestamp with time zone,
    "singletonkey" text,
    "singletonon" timestamp without time zone,
    "expirein" interval not null,
    "createdon" timestamp with time zone not null,
    "completedon" timestamp with time zone,
    "keepuntil" timestamp with time zone not null,
    "on_complete" boolean not null,
    "output" jsonb,
    "archivedon" timestamp with time zone not null default now()
      );



  create table "pgboss"."job" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "priority" integer not null default 0,
    "data" jsonb,
    "state" pgboss.job_state not null default 'created'::pgboss.job_state,
    "retrylimit" integer not null default 0,
    "retrycount" integer not null default 0,
    "retrydelay" integer not null default 0,
    "retrybackoff" boolean not null default false,
    "startafter" timestamp with time zone not null default now(),
    "startedon" timestamp with time zone,
    "singletonkey" text,
    "singletonon" timestamp without time zone,
    "expirein" interval not null default '00:15:00'::interval,
    "createdon" timestamp with time zone not null default now(),
    "completedon" timestamp with time zone,
    "keepuntil" timestamp with time zone not null default (now() + '14 days'::interval),
    "on_complete" boolean not null default false,
    "output" jsonb
      );



  create table "pgboss"."schedule" (
    "name" text not null,
    "cron" text not null,
    "timezone" text,
    "data" jsonb,
    "options" jsonb,
    "created_on" timestamp with time zone not null default now(),
    "updated_on" timestamp with time zone not null default now()
      );



  create table "pgboss"."subscription" (
    "event" text not null,
    "name" text not null,
    "created_on" timestamp with time zone not null default now(),
    "updated_on" timestamp with time zone not null default now()
      );



  create table "pgboss"."version" (
    "version" integer not null,
    "maintained_on" timestamp with time zone,
    "cron_on" timestamp with time zone
      );


alter table "public"."purchase_quotations" drop column "end_at";

alter table "public"."purchase_quotations" drop column "public_id";

alter table "public"."purchase_quotations" drop column "raw_payload";

alter table "public"."purchase_quotations" drop column "sent_at";

alter table "public"."purchase_quotations" drop column "sent_by";

alter table "public"."sienge_sync_cursor" drop column "requires_full_sync";

alter table "public"."sienge_sync_cursor" drop column "updated_at";

alter table "public"."supplier_negotiations" drop column "closed_order_id";

alter table "public"."supplier_negotiations" drop column "latest_response_id";

alter table "public"."supplier_negotiations" drop column "sent_at";

alter table "public"."webhook_events" drop column "sienge_delivery_id";

alter table "public"."webhook_events" drop column "sienge_event";

alter table "public"."webhook_events" drop column "sienge_hook_id";

alter table "public"."webhook_events" drop column "sienge_tenant";

CREATE INDEX archive_archivedon_idx ON pgboss.archive USING btree (archivedon);

CREATE INDEX archive_id_idx ON pgboss.archive USING btree (id);

CREATE INDEX job_fetch ON pgboss.job USING btree (name text_pattern_ops, startafter) WHERE (state < 'active'::pgboss.job_state);

CREATE INDEX job_name ON pgboss.job USING btree (name text_pattern_ops);

CREATE UNIQUE INDEX job_pkey ON pgboss.job USING btree (id);

CREATE UNIQUE INDEX job_singleton_queue ON pgboss.job USING btree (name, singletonkey) WHERE ((state < 'active'::pgboss.job_state) AND (singletonon IS NULL) AND (singletonkey ~~ '\_\_pgboss\_\_singleton\_queue%'::text));

CREATE UNIQUE INDEX job_singletonkey ON pgboss.job USING btree (name, singletonkey) WHERE ((state < 'completed'::pgboss.job_state) AND (singletonon IS NULL) AND (NOT (singletonkey ~~ '\_\_pgboss\_\_singleton\_queue%'::text)));

CREATE UNIQUE INDEX job_singletonkeyon ON pgboss.job USING btree (name, singletonon, singletonkey) WHERE (state < 'expired'::pgboss.job_state);

CREATE UNIQUE INDEX job_singletonon ON pgboss.job USING btree (name, singletonon) WHERE ((state < 'expired'::pgboss.job_state) AND (singletonkey IS NULL));

CREATE UNIQUE INDEX schedule_pkey ON pgboss.schedule USING btree (name);

CREATE UNIQUE INDEX subscription_pkey ON pgboss.subscription USING btree (event, name);

CREATE UNIQUE INDEX version_pkey ON pgboss.version USING btree (version);

alter table "pgboss"."job" add constraint "job_pkey" PRIMARY KEY using index "job_pkey";

alter table "pgboss"."schedule" add constraint "schedule_pkey" PRIMARY KEY using index "schedule_pkey";

alter table "pgboss"."subscription" add constraint "subscription_pkey" PRIMARY KEY using index "subscription_pkey";

alter table "pgboss"."version" add constraint "version_pkey" PRIMARY KEY using index "version_pkey";


