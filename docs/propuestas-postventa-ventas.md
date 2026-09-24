# Propuestas: postventa, innovación y más ventas

Revisión del 2026-09-23 sobre el estado actual de `main` (2062063).

## Qué hay hoy

- **Seguimientos** (`commercial_alerts`): solo 2 tipos de alerta, `post_sale_12_months` y `credit_installment_10`, generadas en `syncCommercialAlertsForVehicle` ([commercialAlertsService.ts:186](../src/services/commercialAlertsService.ts)). Acciones: WhatsApp, copiar, contactado, posponer 30 días, descartar.
- **Leads** (`meli_leads`): estados sin_contactar → cerrado, más **encargos** (buscando / encontrado / en_pausa / cancelado).
- **Clientes / operaciones / documentos** con historial por DNI; el cliente ya guarda `fecha_nacimiento`, pero no se usa.
- **Presupuesto** con toma de usado; `saleSyncService.registerTradeIn` da de alta el usado entregado.
- Catálogo público y lista de precios sincronizada con Google Sheets.

## Propuestas, ordenadas por impacto y esfuerzo

### Ganancias rápidas (1–2 días cada una)

1. **Escalera de postventa**: sumar alertas en 7 días (satisfacción + pedido de reseña en Google), 30 días (control de transferencia/08 y cédula), 6 meses (service) y 24/36 meses ("¿renovamos?" con cotización del auto actual). La de 12 meses ya existe. Hoy el primer contacto después de la entrega llega recién al año.
2. **Cumpleaños del cliente**: `gestion_jd_clients.fecha_nacimiento` ya existe. Una alerta anual con saludo por WhatsApp mantiene viva la relación sin costo.
3. **Presupuesto sin cerrar**: si un presupuesto no termina en una operación finalizada a los 3 días, crear un seguimiento. Lo mismo a las 48 h de un **test drive** sin compra. Son los leads más calientes que tiene la agencia y hoy no generan ningún recordatorio.
4. **Lead dormido**: los leads `no_contesta` o `recontactar` sin cambios en 5 días pasan a Seguimientos con un mensaje de reenganche.
5. **Posponer flexible**: ofrecer 7, 15 y 30 días en lugar de 30 fijo, y guardar una nota al marcar "Contactado" (resultado del llamado).

### Motores de venta (3–5 días)

6. **Cruce encargos ↔ stock**: cuando un auto entra (`ingresado`/`publicado`), buscar encargos `buscando` y leads interesados que coincidan en marca, modelo, año y precio, y avisar con un WhatsApp listo para enviar. Es venta casi segura y hoy depende de la memoria del vendedor.
7. **Aviso de baja de precio**: si cambia el precio en la lista, notificar a los leads que consultaron por ese auto.
8. **Fin de crédito = nueva venta**: además de la cuota 10, alertar 3 cuotas antes de terminar (`credit_total_installments` y `credit_start_date` ya están) con una oferta de canje.
9. **Referidos**: un código o link por cliente y un campo "¿Cómo nos conociste? / Referido por" en el Datero. Mostrar en la ficha del cliente cuántas ventas trajo y agradecerle.
10. **Antigüedad de stock**: marcar autos publicados hace más de 45/60/90 días en el dashboard, con sugerencia de ajuste de precio o de destacarlos en el catálogo.

### Tablero comercial

11. **Embudo** lead → datero → presupuesto → operación finalizada, por mes y por origen (MeLi, Instagram, referido).
12. **Margen por unidad** (`sale_price - purchase_price`) y **días en stock** promedio.
13. **Tasa de postventa**: porcentaje de alertas contactadas antes de vencer.

### Innovación con IA (ya está el asistente GLM en `api/`)

14. **Mensaje personalizado**: botón "Redactar con IA" en cada seguimiento que use la historia del cliente (auto comprado, crédito, última charla) en lugar de la plantilla fija.
15. **Resumen de cliente**: en la ficha, un párrafo con lo que compró, qué debe, qué consultó y la próxima mejor acción.
16. **Tasación orientativa del usado** para la alerta "¿renovamos?", a partir del historial de precios propio de la lista.

## Deuda técnica que frena lo anterior

- `alertTypeLabel` está duplicada en [VentasSeguimientosPage.tsx](../src/pages/ventas/VentasSeguimientosPage.tsx) y [VentasDashboardPage.tsx](../src/pages/ventas/VentasDashboardPage.tsx) y es un ternario binario: cualquier tipo nuevo se mostraría como "Postventa 12 meses". Hay que pasarla a un mapa en `types/commercialAlerts` antes de sumar tipos.
- `commercial_alerts` no tiene `client_id` y su índice único es `(vehicle_id, alert_type)`, así que las alertas sin auto (cumpleaños, lead dormido) necesitan una columna `client_id`/`lead_id` y otro índice.
- `commercial_alerts` **no tiene RLS** (comentario en la migración 20260507); el resto de las tablas sí la tiene.
- `message_template` se copia en cada alerta, así que cambiar una plantilla no actualiza las alertas que ya existen.
- Los teléfonos sin `54` solo muestran un aviso. Conviene normalizarlos a `549…` al guardar para que `wa.me` funcione siempre.

## Segunda revisión: Leads, Presupuesto y Catálogo

### Catálogo público: hoy no captura nada

17. **Registrar el interés**: el botón de WhatsApp de [CatalogVehicleCard.tsx](../src/components/catalogo/CatalogVehicleCard.tsx) abre el chat pero no queda registro en la app. Guardar cada clic (auto + fecha) en una tabla de eventos daría un ranking de "autos más consultados" y serviría para la propuesta #7 (baja de precio).
18. **Link propio por auto** (`/catalogo/:id`) con imagen y título para vista previa, para compartir en Instagram, Marketplace y estados de WhatsApp. Hoy solo se puede compartir el catálogo entero.
19. **"Simulá tu cuota"** en cada tarjeta, reutilizando la lógica de la Calculadora 0km o del crédito, que muestre la cuota junto al precio.
20. **"Tomamos tu usado"**: un formulario corto (marca, modelo, año, km, teléfono) que entre a Leads como tipo `permuta`. Es la puerta de entrada más común para cambiar de auto.
21. **Link con referido** (`?ref=CODIGO`): si el lead llega desde el link de un cliente, queda atribuido. Complementa la #9.

### Leads

22. **Mensajes por estado**: `whatsappLink` en [LeadsPage.tsx:206](../src/pages/LeadsPage.tsx) abre el chat vacío. Conviene un mensaje distinto para sin contactar, recontactar y no contesta, que incluya el auto consultado y su link del catálogo.
23. **Relacionar el lead con el auto**: `leads.auto` es texto libre (`item_title`). Guardar además el id del ítem de la lista o del vehículo es lo que permite el cruce automático (#6) y los avisos de precio (#7).
24. **Pasar de lead a Datero en un clic**, con nombre, teléfono y auto ya cargados, y el lead marcado como `cerrado` al finalizar la operación. Así el embudo (#11) se mide solo.

### Presupuesto

25. **Validez del presupuesto** ("válido hasta…", por ejemplo 72 h), impresa en el PDF. Genera urgencia y define cuándo dispara el seguimiento de la #3.
26. **Enviar por WhatsApp desde la pantalla**: un botón que abra el chat del cliente con un resumen (auto, entrega, cuotas) y el PDF listo para adjuntar, además de la descarga que hay hoy.

## Por dónde empezaría

1. Refactorizar los tipos de alerta a un mapa y agregar `client_id` a `commercial_alerts` (deuda, medio día).
2. Escalera de postventa y cumpleaños (#1, #2).
3. Cruce encargos ↔ stock (#6), que es la que más ventas mueve.
