create schema if not exists "pgboss";

create type "pgboss"."job_state" as enum ('created', 'retry', 'active', 'completed', 'expired', 'cancelled', 'failed');

drop trigger if exists "update_sienge_sync_cursor_updated_at_trigger" on "public"."sienge_sync_cursor";

drop function if exists "public"."update_sienge_sync_cursor_updated_at"();

drop index if exists "public"."idx_webhook_events_delivery_id";


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


alter table "public"."sienge_sync_cursor" drop column "requires_full_sync";

alter table "public"."sienge_sync_cursor" drop column "updated_at";

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


