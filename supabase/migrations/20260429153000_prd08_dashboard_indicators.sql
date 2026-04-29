-- PRD-08 Dashboard e Indicadores
-- Snapshots diarios para dashboards analiticos

create table if not exists public.dashboard_snapshot (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  cotacoes_enviadas integer not null default 0 check (cotacoes_enviadas >= 0),
  cotacoes_respondidas integer not null default 0 check (cotacoes_respondidas >= 0),
  cotacoes_sem_resposta integer not null default 0 check (cotacoes_sem_resposta >= 0),
  pedidos_no_prazo integer not null default 0 check (pedidos_no_prazo >= 0),
  pedidos_atrasados integer not null default 0 check (pedidos_atrasados >= 0),
  pedidos_com_avaria integer not null default 0 check (pedidos_com_avaria >= 0),
  total_pedidos_monitorados integer not null default 0 check (total_pedidos_monitorados >= 0),
  lead_time_medio_dias_uteis numeric(10,2),
  created_at timestamptz not null default now()
);

create unique index if not exists dashboard_snapshot_date_unique_idx
  on public.dashboard_snapshot (snapshot_date);

create index if not exists dashboard_snapshot_created_at_idx
  on public.dashboard_snapshot (created_at desc);

create table if not exists public.dashboard_snapshot_por_fornecedor (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  supplier_id integer not null,
  supplier_name varchar(255) not null,
  cotacoes_enviadas integer not null default 0 check (cotacoes_enviadas >= 0),
  cotacoes_respondidas integer not null default 0 check (cotacoes_respondidas >= 0),
  pedidos_no_prazo integer not null default 0 check (pedidos_no_prazo >= 0),
  pedidos_atrasados integer not null default 0 check (pedidos_atrasados >= 0),
  pedidos_com_avaria integer not null default 0 check (pedidos_com_avaria >= 0),
  lead_time_medio_dias_uteis numeric(10,2),
  confiabilidade varchar(20) not null check (confiabilidade in ('confiavel', 'atencao', 'critico')),
  created_at timestamptz not null default now()
);

create unique index if not exists dashboard_snapshot_fornecedor_unique_idx
  on public.dashboard_snapshot_por_fornecedor (snapshot_date, supplier_id);

create index if not exists dashboard_snapshot_fornecedor_supplier_idx
  on public.dashboard_snapshot_por_fornecedor (supplier_id);

create index if not exists dashboard_snapshot_fornecedor_confiabilidade_idx
  on public.dashboard_snapshot_por_fornecedor (confiabilidade);

create table if not exists public.dashboard_snapshot_por_obra (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  building_id integer not null,
  building_name varchar(255),
  pedidos_no_prazo integer not null default 0 check (pedidos_no_prazo >= 0),
  pedidos_atrasados integer not null default 0 check (pedidos_atrasados >= 0),
  pedidos_com_avaria integer not null default 0 check (pedidos_com_avaria >= 0),
  lead_time_medio_dias_uteis numeric(10,2),
  created_at timestamptz not null default now()
);

create unique index if not exists dashboard_snapshot_obra_unique_idx
  on public.dashboard_snapshot_por_obra (snapshot_date, building_id);

create index if not exists dashboard_snapshot_obra_building_idx
  on public.dashboard_snapshot_por_obra (building_id);

create table if not exists public.dashboard_criticidade_item (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  item_identifier varchar(100) not null,
  item_description varchar(500),
  building_id integer,
  prazo_obra_dias_uteis integer,
  media_historica_dias_uteis numeric(10,2),
  criticidade varchar(20) not null check (criticidade in ('urgente', 'padrao')),
  created_at timestamptz not null default now()
);

create index if not exists dashboard_criticidade_item_date_item_idx
  on public.dashboard_criticidade_item (snapshot_date, item_identifier);

create index if not exists dashboard_criticidade_item_criticidade_idx
  on public.dashboard_criticidade_item (criticidade);

create index if not exists dashboard_criticidade_item_building_idx
  on public.dashboard_criticidade_item (building_id);

alter table public.dashboard_snapshot enable row level security;
alter table public.dashboard_snapshot_por_fornecedor enable row level security;
alter table public.dashboard_snapshot_por_obra enable row level security;
alter table public.dashboard_criticidade_item enable row level security;

create policy "dashboard_snapshot_service_role_all"
  on public.dashboard_snapshot
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "dashboard_snapshot_por_fornecedor_service_role_all"
  on public.dashboard_snapshot_por_fornecedor
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "dashboard_snapshot_por_obra_service_role_all"
  on public.dashboard_snapshot_por_obra
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "dashboard_criticidade_item_service_role_all"
  on public.dashboard_criticidade_item
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
