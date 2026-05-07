create extension if not exists "pgcrypto";

alter table if exists public.gestion_jd_vehicles
  add column if not exists has_credit boolean default false,
  add column if not exists credit_start_date date,
  add column if not exists credit_total_installments integer,
  add column if not exists credit_due_day integer;

create table if not exists public.commercial_alerts (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid null references public.gestion_jd_vehicles(id) on delete set null,
  client_name text,
  client_phone text,
  alert_type text not null,
  alert_date date not null,
  status text not null default 'pending',
  message_template text,
  notes text,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commercial_alerts_status_idx
  on public.commercial_alerts (status);

create index if not exists commercial_alerts_alert_date_idx
  on public.commercial_alerts (alert_date);

create index if not exists commercial_alerts_alert_type_idx
  on public.commercial_alerts (alert_type);

create index if not exists commercial_alerts_vehicle_id_idx
  on public.commercial_alerts (vehicle_id);

create unique index if not exists commercial_alerts_active_vehicle_type_idx
  on public.commercial_alerts (vehicle_id, alert_type)
  where vehicle_id is not null and status in ('pending', 'postponed');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists commercial_alerts_set_updated_at on public.commercial_alerts;
create trigger commercial_alerts_set_updated_at
before update on public.commercial_alerts
for each row
execute procedure public.set_updated_at();

comment on table public.commercial_alerts is
  'Commercial follow-up alerts for Gestion JD. RLS is intentionally not enabled in this migration; define auth-specific policies before enabling it.';
