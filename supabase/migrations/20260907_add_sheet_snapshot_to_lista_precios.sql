-- Sincronizacion en los dos sentidos con la planilla de Google.
--
-- sheet_snapshot guarda como quedo la fila (columnas A..L) la ultima vez que la
-- app la escribio o la importo. Google no expone fecha de modificacion por fila,
-- asi que este es el unico modo de detectar una edicion hecha a mano sin tener
-- que tocar la planilla agregando columnas de control.
--
-- Comparando contra el snapshot se sabe de que lado hubo cambios:
--   fila de la planilla != snapshot  -> la editaron a mano
--   fila derivada de Supabase != snapshot -> la editaron desde la web
-- Si difieren los dos, hay conflicto y se le pregunta al usuario.

alter table public.gestion_jd_lista_precios
  add column if not exists sheet_snapshot text;
