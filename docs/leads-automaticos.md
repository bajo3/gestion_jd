# Leads automáticos

Hay tres formas de que un lead entre sin tipearlo en la pantalla de Leads.

## 1. Desde el asistente (ya funciona)

Abrí el asistente y escribí, por ejemplo:

```
lead María López 2494123456 pregunta por la Tera
```

Te muestra lo que entendió (nombre, teléfono y auto), avisa si ya hay un lead con
ese teléfono y qué autos de la lista de precios coinciden. Con "Cargar lead" queda
como **Sin contactar** y aparece en "Qué hacer hoy".

## 2. Cruce con el stock (ya funciona)

En "Qué hacer hoy" (pantalla de Inicio):

- Cada lead sin contestar muestra si hay un auto **disponible en la lista de
  precios** que coincide con lo que pidió. Si coincide uno solo, el WhatsApp ya
  sale con el modelo y el precio.
- Los **encargos** que siguen buscando aparecen cuando entra a la lista un auto
  que coincide, con el mensaje para avisarle al cliente.

La coincidencia es por el nombre del modelo, así que conviene revisar el mensaje
antes de mandarlo.

## 3. Entrada automática desde otros sistemas (hay que conectarla)

La app tiene una puerta de entrada, `/api/lead-intake`, para que otro sistema le
mande leads. Sirve para MercadoLibre, formularios de la web, o Instagram y
Facebook a través de Zapier o Make.

### Habilitarla

En Vercel → **Settings → Environment Variables**:

| Variable | Valor |
| --- | --- |
| `LEAD_INTAKE_SECRET` | una clave larga inventada por vos |

Sin esa clave la entrada no acepta nada. Después de cargarla, volvé a desplegar.

### Qué hay que mandarle

```bash
curl -X POST "https://gestion-jd.vercel.app/api/lead-intake" \
  -H "Authorization: Bearer TU_CLAVE" \
  -H "Content-Type: application/json" \
  -d '{"name":"Juan Perez","phone":"2494123456","car":"Amarok V6","source":"meli","externalId":"123","text":"Sigue disponible?"}'
```

| Campo | Para qué |
| --- | --- |
| `name` | nombre de quien consulta |
| `phone` | teléfono |
| `car` | auto por el que consulta |
| `source` | de dónde viene (`meli`, `instagram`, `web`...). Queda guardado en el lead |
| `externalId` | id del lead en el sistema de origen. Con esto, el mismo lead mandado dos veces no se duplica |
| `text` | lo que escribió la persona. Queda en las notas |
| `date` | cuándo consultó. Si no viene, se usa el momento en que llega |

Hace falta `name` o `phone`; el resto es opcional. Para mandar varios juntos:
`{"leads":[{...},{...}]}` (hasta 100).

Agregando `?dryRun=1` a la dirección valida todo pero no guarda nada.

### Qué no carga dos veces

- Un lead con el mismo `source` + `externalId`.
- La misma persona (mismo teléfono) consultando por el mismo auto dentro de los
  últimos 30 días.

### MercadoLibre

Para que las consultas de MercadoLibre entren solas hace falta una aplicación
registrada en MercadoLibre Developers con acceso a la cuenta de la agencia. Esa
parte **no está hecha**: necesita las credenciales de esa cuenta. Una vez
registrada, la integración solo tiene que leer las consultas y mandarlas a
`/api/lead-intake` con `source: "meli"` y el id de la consulta en `externalId`.
