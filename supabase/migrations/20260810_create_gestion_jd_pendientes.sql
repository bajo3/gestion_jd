create extension if not exists "pgcrypto";

create table if not exists public.gestion_jd_pendientes (
  id uuid primary key default gen_random_uuid(),
  app_source text not null default 'gestion_jd',
  title text not null,
  details text,
  style_index smallint not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gestion_jd_pendientes_app_source_check check (app_source = 'gestion_jd')
);

create index if not exists gestion_jd_pendientes_status_idx
  on public.gestion_jd_pendientes (app_source, completed_at, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gestion_jd_pendientes_set_updated_at on public.gestion_jd_pendientes;
create trigger gestion_jd_pendientes_set_updated_at
before update on public.gestion_jd_pendientes
for each row
execute procedure public.set_updated_at();

alter table public.gestion_jd_pendientes enable row level security;

drop policy if exists "allow gestion_jd pendientes" on public.gestion_jd_pendientes;
create policy "allow gestion_jd pendientes"
on public.gestion_jd_pendientes
for all
using (app_source = 'gestion_jd')
with check (app_source = 'gestion_jd');
