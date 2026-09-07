# Sincronizar la lista de precios con la planilla de Google

Cuando editás un precio en `/lista-precios`, el cambio se guarda en Supabase y
además se escribe en la planilla de Google. Para que la segunda mitad funcione
hay que darle a la app permiso de edición sobre el documento.

Mientras no esté configurado, la app funciona igual: guarda en Supabase y avisa
*"La planilla de Google todavía no está conectada"*.

## 1. Crear la cuenta de servicio

Una cuenta de servicio es un "usuario robot" de Google. Es la forma correcta de
darle acceso a un sistema sin compartir tu contraseña.

1. Entrá a <https://console.cloud.google.com/> con la cuenta dueña de la planilla.
2. Creá un proyecto (o usá uno existente).
3. **APIs y servicios → Biblioteca** → buscá **Google Sheets API** → **Habilitar**.
4. **APIs y servicios → Credenciales → Crear credenciales → Cuenta de servicio**.
   Ponele un nombre (ej. `gestion-jd`) y creala.
5. Entrá a la cuenta recién creada → pestaña **Claves** → **Agregar clave → Crear
   clave nueva → JSON**. Se descarga un archivo.

Ese JSON es una credencial: no lo subas al repo ni lo mandes por chat.

## 2. Compartir la planilla con la cuenta de servicio

Dentro del JSON hay un campo `client_email`, algo como
`gestion-jd@tu-proyecto.iam.gserviceaccount.com`.

Abrí la planilla **Lista de precios JD** en Google Sheets → **Compartir** → pegá
ese mail → permiso **Editor** → Enviar.

Sin este paso Google va a rechazar cada escritura con "The caller does not have
permission".

## 3. Cargar las variables de entorno

Del JSON descargado salen dos valores:

| Variable | De dónde sale |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | el campo `client_email` |
| `GOOGLE_PRIVATE_KEY` | el campo `private_key`, tal cual, con los `\n` incluidos |

Y una tercera que sale de la URL de la planilla al abrirla normalmente
(no la del "publicar en la web"):

```
https://docs.google.com/spreadsheets/d/ESTE_PEDAZO_ES_EL_ID/edit
```

| Variable | Valor |
| --- | --- |
| `GOOGLE_SHEET_ID` | ese `ESTE_PEDAZO_ES_EL_ID` |
| `GOOGLE_SHEET_NAME` | opcional: nombre de la pestaña. Vacío = la primera |

Cargalas en dos lugares:

- **Local**: en tu `.env` (que ya está en `.gitignore`).
- **Producción**: en Vercel → Settings → Environment Variables. Ojo con
  `GOOGLE_PRIVATE_KEY`: pegala completa, desde `-----BEGIN PRIVATE KEY-----`
  hasta el final.

Ninguna de estas variables lleva el prefijo `VITE_`, justamente para que la
clave privada nunca llegue al navegador: solo la usa el endpoint del servidor.

## 4. Probar

Editá un precio desde `/lista-precios` y guardá. Si todo está bien, el mensaje
dice **"Cambios guardados y la planilla quedó actualizada"** y en la planilla
vas a ver el valor nuevo.

Si algo falla, el mensaje te muestra el error que devolvió Google.

## Cómo escribe en la planilla

- Cada vehículo recuerda su fila original (columna `sheet_row` en Supabase). Al
  guardar se reescribe esa fila completa, de la columna **A** a la **L**.
- Un vehículo **nuevo** se agrega al final de la planilla, y la app se guarda el
  número de fila que Google le asignó.
- **Borrar** vacía la fila en vez de eliminarla. Es a propósito: eliminar la fila
  correría todas las de abajo y dejaría mal el `sheet_row` del resto.
- Los precios se escriben como texto (`$25.900.000` o `31.400 USD`), que es el
  formato con el que se venían cargando a mano.

## Limitaciones que conviene tener presentes

- **La sincronización es en un solo sentido.** Si editás directo en Google
  Sheets, la web no se entera. Conviene editar siempre desde la web.
- **Las filas de marca y las filas vacías no se tocan.** La app solo escribe en
  las filas de vehículos.
- **Si Google falla, Supabase ya guardó.** El mensaje te avisa que la planilla
  quedó desactualizada; volvé a guardar el vehículo para reintentar.
