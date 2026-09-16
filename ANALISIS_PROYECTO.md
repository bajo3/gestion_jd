# Análisis del proyecto — Gestión JD

Aplicación de gestión para una agencia de autos (compra/venta de vehículos, documentación comercial, seguimiento de leads y clientes). Nombre de paquete: `gestion-jd`.

## Stack tecnológico

- **Frontend**: React 19 + TypeScript + Vite 8, enrutado con `react-router-dom` v7.
- **Estilos**: Tailwind CSS v4 (`@tailwindcss/vite`) + `styles.css` propio, componentes UI tipo shadcn (`src/components/ui`), iconos `lucide-react`.
- **Backend/datos**: Supabase (`@supabase/supabase-js`), Postgres con Row Level Security.
- **PDFs**: generación de documentos con `jspdf` (`src/pdf/*`).
- **IA**: dos endpoints serverless (`api/ai-assistant.js`, `api/workspace-assistant.js`) que llaman a un modelo GLM vía Z.ai (`ZAI_API_KEY`, modelo `glm-5.2`).
- **Deploy**: Vercel (`vercel.json` con rewrite SPA a `index.html`).

## Estructura

- `src/app/router.tsx` — define todas las rutas de la SPA, protegidas por `isAuthenticated()` (login simple, ver `src/lib/auth.ts`).
- `src/pages/` — una página por funcionalidad: Home, Autos (listado/alta/edición/detalle), Ventas (dashboard, seguimientos, documentos), Leads, Infracciones, y varias páginas de documentos (Compra-Venta, Autorización de conducción, Datero, Recibo, Presupuesto, Test Drive, Calculadora 0km, Formulario Cliente).
- `src/components/` — organizado en `layout` (AppShell, AppIntro), `vehicles` (tarjetas, formularios, timeline, archivos, panel de venta), `shared` (inputs de dinero, campos de formulario) y `ui` (primitivas: button, card, input, select, checkbox, textarea, badge).
- `src/services/` — capa de acceso a datos: `vehiclesService`, `filesService`, `leadsService`, `documentDraftService`, `receiptCounterService`, `commercialAlertsService`, más `vehicleAssistantService`/`workspaceAssistantService` que consumen las funciones serverless de IA. `supabaseClient.ts` centraliza el cliente.
- `src/pdf/` — un generador por tipo de documento, más `common.ts` con utilidades compartidas.
- `src/types/` — tipado de vehículos, alertas comerciales y formularios.
- `api/` — funciones serverless (Vercel) que exponen los asistentes de IA: uno para editar/parchar datos de vehículos (`ai-assistant.js`, con validación de campos y estados permitidos) y otro workspace-wide para navegación/documentos (`workspace-assistant.js`).
- `supabase/` — `schema.sql` (esquema base: tablas `vehicles` y `vehicle_files`, RLS abierta "allow all", bucket de storage `vehicle-files`) y `migrations/` con altas incrementales (info de comprador, documentos de vehículo, alertas comerciales).
- Archivos HTML/JS sueltos en la raíz (`datero.html/js`, `recibo.html/js`, `presupuesto.html/js`, `test_drive.html/js`, `compra_venta.html/js`, `calculadora_0km.html/js`, `autorizacion.js`, `formulario_cliente.html/js`, `utils.js`) — parecen ser una versión previa/standalone (pre-SPA) de las mismas herramientas, ahora también reimplementadas como páginas React equivalentes. Conviven con la app Vite/React actual.
- `dist/` y `public/` — build de salida y estáticos (logos, planilla `cotizador-032026.xlsx`, carpeta `leads`).
- `output/pdf` — carpeta de salida no versionada (aparece en `git status` como untracked).

## Funcionalidad principal

1. **Gestión de vehículos** (`/autos`): alta, edición, detalle, archivos adjuntos, línea de tiempo, panel de venta — con posible autocompletado/patch asistido por IA (estados: ingresado, en_preparación, publicado, reservado, vendido, egresado, archivado).
2. **Ventas** (`/ventas`): dashboard, seguimientos comerciales, documentos de venta.
3. **Leads** (`/leads`) e **Infracciones** (`/infracciones`).
4. **Generador de documentos comerciales**: Compra-Venta, Autorización de conducción, Datero, Recibo, Presupuesto, Test Drive, Calculadora 0km, Formulario de cliente — cada uno con su página, su JS legado equivalente y su generador de PDF.
5. **Asistente de IA integrado** (`VehicleAssistant.tsx` + servicios) para interactuar en lenguaje natural con datos de vehículos y navegación del workspace.

## Observaciones

- Hay duplicación funcional entre las páginas HTML/JS de la raíz y las páginas React equivalentes bajo `src/pages`; vale la pena confirmar si las HTML sueltas siguen en uso o son remanentes a limpiar.
- Las políticas RLS de Supabase (`schema.sql`) son "allow all" (`using (true)`), es decir sin restricción real de acceso a nivel de base de datos — la seguridad depende del login de la app, no de RLS.
- La clave de IA (`ZAI_API_KEY`) se maneja solo del lado servidor (`api/*.js`), correctamente no expuesta con prefijo `VITE_`.
- Carpeta `output/` no está en el `.gitignore` actual (`.gitignore` solo 18 bytes) — revisar si conviene ignorarla junto con `dist/` y `node_modules/`.
