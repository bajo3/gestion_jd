create extension if not exists "pgcrypto";

create table if not exists public.gestion_jd_documentos (
  id uuid primary key default gen_random_uuid(),
  app_source text not null default 'gestion_jd',
  document_type text not null,
  document_label text not null,
  title text not null,
  person_name text,
  document_number text,
  license_plate text,
  phone text,
  vehicle_label text,
  amount numeric,
  document_date date,
  file_name text,
  file_url text,
  storage_path text,
  form_data jsonb not null default '{}'::jsonb,
  search_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gestion_jd_documentos_app_source_check check (app_source = 'gestion_jd')
);

create index if not exists gestion_jd_documentos_created_at_idx
  on public.gestion_jd_documentos (app_source, created_at desc);

create index if not exists gestion_jd_documentos_license_plate_idx
  on public.gestion_jd_documentos (app_source, license_plate);

create index if not exists gestion_jd_documentos_type_idx
  on public.gestion_jd_documentos (app_source, document_type);

-- Acelera las busquedas parciales por patente o nombre (ilike '%texto%').
create extension if not exists pg_trgm;

create index if not exists gestion_jd_documentos_search_text_idx
  on public.gestion_jd_documentos using gin (search_text gin_trgm_ops);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gestion_jd_documentos_set_updated_at on public.gestion_jd_documentos;
create trigger gestion_jd_documentos_set_updated_at
before update on public.gestion_jd_documentos
for each row
execute procedure public.set_updated_at();

alter table public.gestion_jd_documentos enable row level security;

drop policy if exists "allow gestion_jd documentos" on public.gestion_jd_documentos;
create policy "allow gestion_jd documentos"
on public.gestion_jd_documentos
for all
using (app_source = 'gestion_jd')
with check (app_source = 'gestion_jd');

insert into storage.buckets (id, name, public)
values ('gestion-jd-documentos', 'gestion-jd-documentos', true)
on conflict (id) do nothing;

drop policy if exists "allow gestion_jd documentos storage" on storage.objects;
create policy "allow gestion_jd documentos storage"
on storage.objects
for all
using (bucket_id = 'gestion-jd-documentos')
with check (bucket_id = 'gestion-jd-documentos');
