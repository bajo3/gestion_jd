create table if not exists public.gestion_jd_police_verifications (
  id uuid primary key default gen_random_uuid(),
  app_source text not null default 'gestion_jd',
  vehicle_id uuid not null references public.gestion_jd_vehicles(id) on delete cascade,
  status text not null default 'borrador',
  domain text,
  plate_copy text,
  brand text,
  model text,
  vehicle_type text,
  motor_brand text,
  motor_number text,
  chassis_brand text,
  chassis_number text,
  category text,
  owner_name text,
  owner_person_type text,
  owner_document_type text,
  owner_document text,
  owner_street text,
  owner_number text,
  owner_floor text,
  owner_apartment text,
  owner_postal_code text,
  owner_locality text,
  owner_province text,
  presenter_is_owner boolean not null default true,
  presenter_name text,
  presenter_document_type text,
  presenter_document text,
  presenter_street text,
  presenter_number text,
  presenter_floor text,
  presenter_apartment text,
  presenter_postal_code text,
  presenter_locality text,
  presenter_province text,
  contact_email text,
  contact_email_repeat text,
  phone_area text,
  phone_number text,
  notes text,
  prepared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gestion_jd_police_verifications_app_source_check check (app_source = 'gestion_jd'),
  constraint gestion_jd_police_verifications_status_check check (status in ('borrador', 'preparada', 'completada'))
);

create unique index if not exists gestion_jd_police_verifications_vehicle_idx
  on public.gestion_jd_police_verifications (vehicle_id);

create index if not exists gestion_jd_police_verifications_app_source_idx
  on public.gestion_jd_police_verifications (app_source);

drop trigger if exists gestion_jd_police_verifications_set_updated_at on public.gestion_jd_police_verifications;
create trigger gestion_jd_police_verifications_set_updated_at
before update on public.gestion_jd_police_verifications
for each row
execute procedure public.set_updated_at();

alter table public.gestion_jd_police_verifications enable row level security;

drop policy if exists "allow gestion_jd police verifications" on public.gestion_jd_police_verifications;
create policy "allow gestion_jd police verifications"
on public.gestion_jd_police_verifications
for all
using (app_source = 'gestion_jd')
with check (app_source = 'gestion_jd');
