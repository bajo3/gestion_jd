-- La tabla tenia RLS activo sin ninguna politica: la app no podia guardar las
-- alertas de postventa y cuota 10 (quedaban solo en el navegador).
alter table public.commercial_alerts enable row level security;

drop policy if exists "allow gestion_jd commercial alerts" on public.commercial_alerts;
create policy "allow gestion_jd commercial alerts"
on public.commercial_alerts
for all
using (true)
with check (true);
