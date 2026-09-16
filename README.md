# Gestión JD

Aplicación interna para ventas y documentación de operaciones de vehículos.

## Migración de datos

Aplicar en Supabase, en este orden:

1. `supabase/migrations/20260507_create_gestion_jd_vehicle_documents.sql`
2. `supabase/migrations/20260507_add_buyer_info_to_gestion_jd_vehicles.sql`
3. `supabase/migrations/20260507_create_commercial_alerts.sql`
4. `supabase/migrations/20260908_create_gestion_jd_clients_operations_documents.sql`

La última migración crea clientes deduplicados por DNI normalizado, operaciones, snapshots de documentos, RLS limitado a `app_source = 'gestion_jd'` y la RPC `gestion_jd_finalize_sale`. La aplicación conserva un borrador local cuando Supabase no está disponible y lo identifica en pantalla; no se deben cargar datos de prueba en el proyecto real.

## Flujo de ventas

El Datero guarda o actualiza una operación existente; “Guardar nueva operación” crea otra y conserva el historial. Desde Clientes se puede buscar por nombre, DNI, teléfono o dominio y reabrir cada snapshot usando `documentId`. Presupuesto para cliente sólo genera una propuesta; Operación finalizada es la acción que ejecuta el cierre transaccional.

