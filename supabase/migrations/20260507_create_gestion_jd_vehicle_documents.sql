create extension if not exists "pgcrypto";

create table if not exists public.gestion_jd_vehicles (
  id uuid primary key default gen_random_uuid(),
  app_source text not null default 'gestion_jd',
  brand text,
  model text,
  license_plate text,
  year integer,
  vin text,
  engine text,
  color text,
  kilometers integer,
  entry_date date,
  exit_date date,
  status text,
  observations text,
  purchase_price numeric,
  sale_price numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gestion_jd_vehicles_app_source_check check (app_source = 'gestion_jd')
);

create table if not exists public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  app_source text not null default 'gestion_jd',
  vehicle_id uuid not null references public.gestion_jd_vehicles(id) on delete cascade,
  file_name text not null,
  file_type text,
  file_url text,
  category text,
  notes text,
  created_at timestamptz not null default now(),
  constraint vehicle_documents_app_source_check check (app_source = 'gestion_jd')
);

create index if not exists gestion_jd_vehicles_app_source_idx
  on public.gestion_jd_vehicles (app_source);

create index if not exists gestion_jd_vehicles_license_plate_idx
  on public.gestion_jd_vehicles (license_plate);

create index if not exists gestion_jd_vehicles_status_idx
  on public.gestion_jd_vehicles (status);

create index if not exists vehicle_documents_app_source_idx
  on public.vehicle_documents (app_source);

create index if not exists vehicle_documents_vehicle_id_idx
  on public.vehicle_documents (vehicle_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gestion_jd_vehicles_set_updated_at on public.gestion_jd_vehicles;
create trigger gestion_jd_vehicles_set_updated_at
before update on public.gestion_jd_vehicles
for each row
execute procedure public.set_updated_at();

alter table public.gestion_jd_vehicles enable row level security;
alter table public.vehicle_documents enable row level security;

drop policy if exists "allow gestion_jd vehicles" on public.gestion_jd_vehicles;
create policy "allow gestion_jd vehicles"
on public.gestion_jd_vehicles
for all
using (app_source = 'gestion_jd')
with check (app_source = 'gestion_jd');

drop policy if exists "allow gestion_jd vehicle documents" on public.vehicle_documents;
create policy "allow gestion_jd vehicle documents"
on public.vehicle_documents
for all
using (app_source = 'gestion_jd')
with check (app_source = 'gestion_jd');

insert into storage.buckets (id, name, public)
values ('vehicle-files', 'vehicle-files', true)
on conflict (id) do nothing;

-- Optional manual backfill, only after confirming which rows in public.vehicles belong to Gestion JD.
-- This is intentionally commented out to avoid copying data owned by another web.
--
-- insert into public.gestion_jd_vehicles (
--   id, brand, model, license_plate, year, vin, engine, color, kilometers,
--   entry_date, exit_date, status, observations, purchase_price, sale_price,
--   created_at, updated_at
-- )
-- select
--   id, brand, model, license_plate, year, vin, engine, color, kilometers,
--   entry_date, exit_date, status, observations, purchase_price, sale_price,
--   created_at, updated_at
-- from public.vehicles
-- where id in (
--   -- paste confirmed Gestion JD vehicle ids here
-- )
-- on conflict (id) do nothing;
--
-- insert into public.vehicle_documents (
--   id, vehicle_id, file_name, file_type, file_url, category, notes, created_at
-- )
-- select id, vehicle_id, file_name, file_type, file_url, category, notes, created_at
-- from public.vehicle_files
-- where vehicle_id in (select id from public.gestion_jd_vehicles)
-- on conflict (id) do nothing;
