create extension if not exists "pgcrypto";

create table if not exists public.gestion_jd_vehicle_events (
  id uuid primary key default gen_random_uuid(),
  app_source text not null default 'gestion_jd',
  vehicle_id uuid not null references public.gestion_jd_vehicles(id) on delete cascade,
  event_type text not null,
  summary text not null,
  detail text,
  changes jsonb not null default '[]'::jsonb,
  actor text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint gestion_jd_vehicle_events_app_source_check check (app_source = 'gestion_jd')
);

create index if not exists gestion_jd_vehicle_events_vehicle_id_idx
  on public.gestion_jd_vehicle_events (vehicle_id, occurred_at desc);

create index if not exists gestion_jd_vehicle_events_app_source_idx
  on public.gestion_jd_vehicle_events (app_source);

create index if not exists gestion_jd_vehicle_events_type_idx
  on public.gestion_jd_vehicle_events (event_type);

alter table public.gestion_jd_vehicle_events enable row level security;

drop policy if exists "allow gestion_jd vehicle events" on public.gestion_jd_vehicle_events;
create policy "allow gestion_jd vehicle events"
on public.gestion_jd_vehicle_events
for all
using (app_source = 'gestion_jd')
with check (app_source = 'gestion_jd');

-- Semilla del historial para los autos que ya existen: un evento de alta por vehiculo,
-- para que el timeline no arranque vacio en unidades cargadas antes de esta migracion.
insert into public.gestion_jd_vehicle_events (vehicle_id, event_type, summary, occurred_at, created_at)
select
  v.id,
  'created',
  'Vehiculo registrado en el sistema',
  v.created_at,
  v.created_at
from public.gestion_jd_vehicles v
where v.app_source = 'gestion_jd'
  and not exists (
    select 1
    from public.gestion_jd_vehicle_events e
    where e.vehicle_id = v.id and e.event_type = 'created'
  );
