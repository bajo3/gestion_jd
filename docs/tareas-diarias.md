# Rutina diaria automática

Todas las mañanas, a las 8:00 de Argentina, Vercel llama a `/api/daily`
(programado en `vercel.json`). Esa rutina:

1. **Programa los seguimientos que falten.** Recorre los autos vendidos y crea la
   postventa (12 meses) y el aviso de crédito (cuota 10) de los que no lo tengan.
   No toca los que ya existen.
2. **Arma el resumen "Qué hacer hoy"**: leads sin contestar, seguimientos vencidos,
   presupuestos sin cerrar, ventas con datos faltantes y pendientes. Es la misma
   lista que se ve en la pantalla de Inicio.
3. **Manda ese resumen al celular** por Telegram, si está configurado.

Sin configurar nada, la rutina no corre: hace falta el paso 1 de abajo.

## 1. Habilitar la rutina (obligatorio)

En Vercel → proyecto → **Settings → Environment Variables**, agregá:

| Variable | Valor |
| --- | --- |
| `CRON_SECRET` | una clave larga inventada por vos (letras y números) |

Vercel la manda sola en cada ejecución programada. Sirve para que nadie de afuera
pueda pedir el resumen, que tiene nombres de clientes. Después de agregarla hay
que volver a desplegar (Deployments → Redeploy).

## 2. Recibir el resumen por Telegram (opcional)

1. En Telegram, abrí un chat con **@BotFather** y mandale `/newbot`. Elegí un
   nombre y te da un **token** (algo como `123456:ABC...`).
2. Abrí el chat con tu bot nuevo y mandale cualquier mensaje (por ejemplo `hola`).
3. Entrá desde el navegador a
   `https://api.telegram.org/bot<TOKEN>/getUpdates` (reemplazando `<TOKEN>`).
   Buscá `"chat":{"id":` — ese número es tu **chat id**.
4. En Vercel agregá:

| Variable | Valor |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | el token del paso 1 |
| `TELEGRAM_CHAT_ID` | tu chat id. Para avisar a más de una persona, separalos con coma |
| `APP_URL` | opcional: `https://gestion-jd.vercel.app`, para que el mensaje traiga el link |

El token es una credencial: no lo subas al repo ni lo mandes por chat.

## Probar sin esperar a mañana

Con `CRON_SECRET` ya cargado, desde una terminal:

```bash
curl -H "Authorization: Bearer TU_CRON_SECRET" "https://gestion-jd.vercel.app/api/daily?dryRun=1"
```

`dryRun=1` calcula todo pero no crea seguimientos ni manda el mensaje. Sin ese
parámetro corre de verdad. La respuesta trae solo los números (cuántos leads,
seguimientos, etc.); el detalle viaja por Telegram.

## Limitaciones

- En el plan gratuito de Vercel la rutina corre **una vez por día** y la hora puede
  correrse algunos minutos.
- La rutina **no lee la planilla de Google**: la lista de precios se sigue
  sincronizando cuando alguien abre esa pantalla.
- Las reglas del resumen están escritas dos veces (acá en `api/daily.js` y en
  `src/services/todayService.ts` para la pantalla de Inicio). Si se cambia una,
  hay que cambiar la otra.
