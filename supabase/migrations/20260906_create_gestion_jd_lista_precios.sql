create extension if not exists "pgcrypto";

create table if not exists public.gestion_jd_lista_precios (
  id uuid primary key default gen_random_uuid(),
  app_source text not null default 'gestion_jd',
  brand text not null,
  unit text not null,
  year_label text,
  km_label text,
  version text,
  color text,
  fuel text,
  traction text,
  gearbox text,
  displacement text,
  cash_price numeric,
  list_price numeric,
  currency text not null default 'ARS',
  control_mark text,
  photo_url text,
  is_public boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gestion_jd_lista_precios_app_source_check check (app_source = 'gestion_jd'),
  constraint gestion_jd_lista_precios_currency_check check (currency in ('ARS', 'USD'))
);

create index if not exists gestion_jd_lista_precios_orden_idx
  on public.gestion_jd_lista_precios (app_source, brand, sort_order);

create index if not exists gestion_jd_lista_precios_publicas_idx
  on public.gestion_jd_lista_precios (app_source, is_public, brand, sort_order);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gestion_jd_lista_precios_set_updated_at on public.gestion_jd_lista_precios;
create trigger gestion_jd_lista_precios_set_updated_at
before update on public.gestion_jd_lista_precios
for each row
execute procedure public.set_updated_at();

alter table public.gestion_jd_lista_precios enable row level security;

drop policy if exists "allow gestion_jd lista precios" on public.gestion_jd_lista_precios;
create policy "allow gestion_jd lista precios"
on public.gestion_jd_lista_precios
for all
using (app_source = 'gestion_jd')
with check (app_source = 'gestion_jd');
