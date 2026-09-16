create table if not exists public.gestion_jd_clients (
  id uuid primary key default gen_random_uuid(), app_source text not null default 'gestion_jd',
  dni text not null, dni_normalized text not null, nombre text not null default '', telefono text default '', celular text default '',
  email text default '', domicilio text default '', localidad text default '', provincia text default '', cuil text default '',
  estado_civil text default '', condicion_fiscal text default '', fecha_nacimiento date, data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(app_source, dni_normalized),
  constraint gestion_jd_clients_app_source_check check (app_source = 'gestion_jd')
);
create table if not exists public.gestion_jd_operations (
  id uuid primary key default gen_random_uuid(), app_source text not null default 'gestion_jd', client_id uuid not null references public.gestion_jd_clients(id) on delete cascade,
  vehicle_id uuid, status text not null default 'borrador', fecha date, data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint gestion_jd_operations_app_source_check check (app_source = 'gestion_jd')
);
create table if not exists public.gestion_jd_documents (
  id uuid primary key default gen_random_uuid(), app_source text not null default 'gestion_jd', client_id uuid not null references public.gestion_jd_clients(id) on delete cascade,
  operation_id uuid not null references public.gestion_jd_operations(id) on delete cascade, document_type text not null, status text not null default 'borrador',
  data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint gestion_jd_documents_app_source_check check (app_source = 'gestion_jd')
);
create index if not exists gestion_jd_clients_dni_idx on public.gestion_jd_clients(app_source, dni_normalized);
create index if not exists gestion_jd_operations_client_idx on public.gestion_jd_operations(client_id, updated_at desc);
create unique index if not exists gestion_jd_operations_id_client_uidx on public.gestion_jd_operations(id, client_id);
create unique index if not exists gestion_jd_operations_final_vehicle_uidx on public.gestion_jd_operations(vehicle_id) where status = 'finalizada' and vehicle_id is not null;
alter table if exists public.gestion_jd_vehicles add column if not exists credit_installments_text text;
do $$ begin
  if to_regclass('public.gestion_jd_vehicles') is not null and not exists (select 1 from pg_constraint where conname = 'gestion_jd_operations_vehicle_fk') then
    alter table public.gestion_jd_operations add constraint gestion_jd_operations_vehicle_fk foreign key (vehicle_id) references public.gestion_jd_vehicles(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gestion_jd_documents_operation_client_fk') then
    alter table public.gestion_jd_documents add constraint gestion_jd_documents_operation_client_fk foreign key (operation_id, client_id) references public.gestion_jd_operations(id, client_id);
  end if;
end $$;
alter table public.gestion_jd_clients enable row level security;
alter table public.gestion_jd_operations enable row level security;
alter table public.gestion_jd_documents enable row level security;
drop policy if exists "allow all gestion_jd clients" on public.gestion_jd_clients;
create policy "allow all gestion_jd clients" on public.gestion_jd_clients for all using (app_source = 'gestion_jd') with check (app_source = 'gestion_jd');
drop policy if exists "allow all gestion_jd operations" on public.gestion_jd_operations;
create policy "allow all gestion_jd operations" on public.gestion_jd_operations for all using (app_source = 'gestion_jd') with check (app_source = 'gestion_jd');
drop policy if exists "allow all gestion_jd documents" on public.gestion_jd_documents;
create policy "allow all gestion_jd documents" on public.gestion_jd_documents for all using (app_source = 'gestion_jd') with check (app_source = 'gestion_jd');

create or replace function public.gestion_jd_finalize_sale(
  p_operation_id uuid,
  p_vehicle_id uuid,
  p_sale_price numeric,
  p_buyer_name text,
  p_buyer_phone text,
  p_has_credit boolean,
  p_sale_date date,
  p_credit_start_date date,
  p_credit_installments_text text,
  p_credit_total_installments integer,
  p_credit_due_day integer
) returns void
language plpgsql
security invoker
as $$
declare
  v_client_id uuid;
  v_existing_vehicle_id uuid;
  v_buyer_name text;
  v_buyer_phone text;
begin
  if p_operation_id is null or p_vehicle_id is null then raise exception 'operation_id y vehicle_id son obligatorios'; end if;
  if coalesce(p_sale_price, 0) <= 0 then raise exception 'El precio de venta debe ser mayor a cero'; end if;
  if p_sale_date is null then raise exception 'La fecha de venta es obligatoria'; end if;
  if coalesce(p_has_credit, false) and coalesce(nullif(trim(p_credit_installments_text), ''), '') = '' then raise exception 'Indique las cuotas del crédito'; end if;
  if coalesce(p_has_credit, false) and (p_credit_total_installments is null or p_credit_total_installments <= 0) then raise exception 'Indique una cantidad de cuotas válida'; end if;
  if coalesce(p_has_credit, false) and p_credit_start_date is null then raise exception 'Indique la fecha de inicio del crédito'; end if;
  if coalesce(p_has_credit, false) and p_credit_due_day is null then raise exception 'Indique el día de vencimiento del crédito'; end if;
  if p_credit_due_day is not null and (p_credit_due_day < 1 or p_credit_due_day > 31) then raise exception 'El día de vencimiento debe estar entre 1 y 31'; end if;
  select client_id, vehicle_id into v_client_id, v_existing_vehicle_id from public.gestion_jd_operations where id = p_operation_id and app_source = 'gestion_jd' for update;
  if v_client_id is null then raise exception 'La operación no existe'; end if;
  if exists (select 1 from public.gestion_jd_operations where id = p_operation_id and status = 'finalizada') then raise exception 'La operación ya está finalizada'; end if;
  if v_existing_vehicle_id is not null and v_existing_vehicle_id <> p_vehicle_id then raise exception 'La operación ya está vinculada a otro vehículo'; end if;
  select nombre, coalesce(nullif(telefono, ''), celular) into v_buyer_name, v_buyer_phone from public.gestion_jd_clients where id = v_client_id and app_source = 'gestion_jd';
  if v_buyer_name is null then raise exception 'El cliente de la operación no existe'; end if;
  perform 1 from public.gestion_jd_vehicles where id = p_vehicle_id and app_source = 'gestion_jd' for update;
  if not found then raise exception 'El vehículo no existe en gestion_jd_vehicles'; end if;
  if exists (select 1 from public.gestion_jd_operations o where o.vehicle_id = p_vehicle_id and o.id <> p_operation_id and o.status = 'finalizada' and o.app_source = 'gestion_jd') then raise exception 'El vehículo ya está asociado a otra operación finalizada'; end if;
  update public.gestion_jd_vehicles
  set status = 'vendido', exit_date = p_sale_date, sale_price = p_sale_price,
      buyer_name = v_buyer_name, buyer_phone = v_buyer_phone, has_credit = coalesce(p_has_credit, false),
      credit_start_date = case when coalesce(p_has_credit, false) then p_credit_start_date else null end,
      credit_installments_text = case when coalesce(p_has_credit, false) then p_credit_installments_text else null end,
      credit_total_installments = case when coalesce(p_has_credit, false) then p_credit_total_installments else null end,
      credit_due_day = case when coalesce(p_has_credit, false) then p_credit_due_day else null end, updated_at = now()
  where id = p_vehicle_id and app_source = 'gestion_jd';
  if not found then raise exception 'El vehículo no existe en gestion_jd_vehicles'; end if;
  update public.gestion_jd_operations set status = 'finalizada', vehicle_id = p_vehicle_id,
    data = coalesce(data, '{}'::jsonb) || jsonb_build_object('ventaFinalizada', jsonb_build_object('fecha', p_sale_date, 'precioVenta', p_sale_price, 'tomaCredito', coalesce(p_has_credit, false), 'cuotas', p_credit_installments_text)), updated_at = now()
  where id = p_operation_id and app_source = 'gestion_jd';
  if not found then raise exception 'La operación no existe'; end if;
end;
$$;
