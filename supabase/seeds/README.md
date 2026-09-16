# Seeds

SQL de carga inicial. Se ejecutan a mano desde el SQL Editor de Supabase,
despues de aplicar la migracion correspondiente de `../migrations`.

- `20260906_lista_precios_seed.sql` — importa los 59 vehiculos de la planilla
  "Lista de precios JD" a `public.gestion_jd_lista_precios`. Solo inserta si la
  tabla esta vacia, asi que se puede volver a correr sin duplicar nada.
