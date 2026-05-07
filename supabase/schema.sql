create extension if not exists "pgcrypto";

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
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
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_files (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  file_name text not null,
  file_type text,
  file_url text,
  category text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists vehicles_license_plate_idx on public.vehicles (license_plate);
create index if not exists vehicles_status_idx on public.vehicles (status);
create index if not exists vehicle_files_vehicle_id_idx on public.vehicle_files (vehicle_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at
before update on public.vehicles
for each row
execute procedure public.set_updated_at();

alter table public.vehicles enable row level security;
alter table public.vehicle_files enable row level security;

drop policy if exists "allow all vehicles" on public.vehicles;
create policy "allow all vehicles"
on public.vehicles
for all
using (true)
with check (true);

drop policy if exists "allow all vehicle_files" on public.vehicle_files;
create policy "allow all vehicle_files"
on public.vehicle_files
for all
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('vehicle-files', 'vehicle-files', true)
on conflict (id) do nothing;
