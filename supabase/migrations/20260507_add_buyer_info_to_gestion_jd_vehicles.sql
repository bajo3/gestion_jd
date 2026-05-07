alter table if exists public.gestion_jd_vehicles
  add column if not exists buyer_name text,
  add column if not exists buyer_phone text;
