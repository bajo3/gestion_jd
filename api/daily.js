// Rutina diaria: corre sola todas las mañanas (cron de Vercel, ver vercel.json).
//
// 1. Crea los seguimientos de postventa y de credito que falten para los autos vendidos.
// 2. Arma el resumen "Que hacer hoy" (leads sin contestar, seguimientos vencidos,
//    presupuestos sin cerrar, ventas con datos faltantes y pendientes).
// 3. Si hay un canal configurado (Telegram), manda ese resumen al celular.
//
// Las reglas son las mismas que usa la pantalla de Inicio (src/services/todayService.ts):
// si cambia una, hay que cambiar la otra.

const APP_SOURCE = "gestion_jd";
const QUOTE_MIN_DAYS = 3;
const QUOTE_MAX_DAYS = 45;
const MAX_LINES_PER_SECTION = 5;

function getConfig() {
  return {
    supabaseUrl: (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, ""),
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "",
    cronSecret: process.env.CRON_SECRET || "",
    telegramToken: process.env.TELEGRAM_BOT_TOKEN || "",
    telegramChats: (process.env.TELEGRAM_CHAT_ID || "").split(",").map((id) => id.trim()).filter(Boolean),
    appUrl: (process.env.APP_URL || "").replace(/\/$/, ""),
  };
}

async function db(path, { method = "GET", body, prefer } = {}) {
  const { supabaseUrl, supabaseKey } = getConfig();
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase respondio ${response.status} en ${path.split("?")[0]}. ${detail.slice(0, 200)}`);
  }

  if (response.status === 204) return [];
  return response.json().catch(() => []);
}

/** Una fuente que falla no tira abajo el resto del resumen. */
async function safe(label, promise, errors) {
  try {
    return await promise;
  } catch (error) {
    errors.push(`${label}: ${error instanceof Error ? error.message : "error"}`);
    return [];
  }
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysSince(value) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function ago(days) {
  if (days <= 0) return "hoy";
  if (days === 1) return "hace 1 día";
  return `hace ${days} días`;
}

/** "2025-03-10" + 12 meses -> "2026-03-10" */
function addMonths(dateOnly, months) {
  const date = new Date(`${dateOnly}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

// --- Leads -----------------------------------------------------------------

function leadStatus(raw) {
  const value = text(raw)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/\bsin contactar\b/.test(value)) return "sin_contactar";
  if (/\bno contesta\b/.test(value)) return "no_contesta";
  if (/\bno interesad/.test(value)) return "no_interesado";
  if (/\brecontactar\b/.test(value)) return "recontactar";
  if (/\binteresad/.test(value)) return "interesado";
  if (/\bcontactad/.test(value)) return "contactado";
  if (/\bcerrad/.test(value)) return "cerrado";
  return "sin_contactar";
}

function leadsNeedingReply(rows) {
  return rows
    .filter((row) => {
      const raw = row.raw_json && typeof row.raw_json === "object" ? row.raw_json : {};
      if (row.source === "encargo" || raw.tipo === "encargo") return false;
      const status = leadStatus(row.status);
      if (status === "cerrado" || status === "no_interesado") return false;
      const contact = text(raw.fecha_contacto);
      if (!contact) return true;
      if (status === "sin_contactar" || status === "recontactar") return true;
      return status === "no_contesta" && daysSince(contact || row.date_created) >= 3;
    })
    .map((row) => ({ name: text(row.buyer_name) || "Lead sin nombre", days: daysSince(row.date_created) }))
    .sort((a, b) => b.days - a.days);
}

// --- Ventas con datos faltantes ---------------------------------------------

function missingSaleFields(vehicle) {
  if (vehicle.status !== "vendido" && vehicle.status !== "reservado") return [];
  const missing = [];
  if (!text(vehicle.buyer_name)) missing.push("comprador");
  if (!text(vehicle.buyer_phone)) missing.push("teléfono");
  if (vehicle.status === "vendido") {
    if (!text(vehicle.brand)) missing.push("marca");
    if (!text(vehicle.model)) missing.push("modelo");
    if (!text(vehicle.license_plate)) missing.push("patente");
    if (!vehicle.exit_date) missing.push("fecha de venta");
    if (!vehicle.sale_price) missing.push("precio");
    if (vehicle.has_credit) {
      if (!vehicle.credit_start_date) missing.push("inicio del crédito");
      if (!vehicle.credit_total_installments) missing.push("cuotas");
    }
  }
  return missing;
}

function vehicleName(vehicle) {
  return [vehicle.brand, vehicle.model, vehicle.license_plate].map(text).filter(Boolean).join(" ") || "Auto sin datos";
}

// --- Seguimientos que faltan crear -------------------------------------------

/**
 * Hoy los seguimientos se crean cuando alguien guarda el auto. Esta pasada asegura que
 * ningun auto vendido se quede sin su postventa (12 meses) ni su aviso de credito (cuota 10).
 * No toca los que ya existen, esten pendientes, contactados o descartados.
 */
function alertsToCreate(vehicles, alerts) {
  const existing = new Set(alerts.filter((alert) => alert.vehicle_id).map((alert) => `${alert.vehicle_id}|${alert.alert_type}`));
  const created = [];

  for (const vehicle of vehicles) {
    if (vehicle.status !== "vendido") continue;
    const name = text(vehicle.buyer_name);
    const phone = text(vehicle.buyer_phone);

    if (name && phone && vehicle.exit_date && !existing.has(`${vehicle.id}|post_sale_12_months`)) {
      const date = addMonths(String(vehicle.exit_date).slice(0, 10), 12);
      if (date) created.push({ vehicle_id: vehicle.id, client_name: name, client_phone: phone, alert_type: "post_sale_12_months", alert_date: date, status: "pending" });
    }

    if (vehicle.has_credit && vehicle.credit_start_date && name && phone && !existing.has(`${vehicle.id}|credit_installment_10`)) {
      const date = addMonths(String(vehicle.credit_start_date).slice(0, 10), 9);
      if (date) created.push({ vehicle_id: vehicle.id, client_name: name, client_phone: phone, alert_type: "credit_installment_10", alert_date: date, status: "pending" });
    }
  }

  return created;
}

// --- Resumen ------------------------------------------------------------------

function section(title, lines) {
  if (!lines.length) return [];
  const shown = lines.slice(0, MAX_LINES_PER_SECTION).map((line) => `• ${line}`);
  const rest = lines.length - shown.length;
  return ["", `${title} (${lines.length})`, ...shown, ...(rest > 0 ? [`• y ${rest} más`] : [])];
}

function buildMessage(summary, appUrl) {
  const total = summary.leads.length + summary.followups.length + summary.quotes.length + summary.missingSales.length + summary.pendings.length;
  const date = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

  if (!total) {
    return [`Jesús Díaz Automotores · ${date}`, "", "Estás al día: no hay leads sin contestar, seguimientos vencidos ni ventas con datos faltantes."].join("\n");
  }

  return [
    `Jesús Díaz Automotores · ${date}`,
    `Qué hacer hoy: ${total} ${total === 1 ? "tarea" : "tareas"}`,
    ...section("Leads sin contestar", summary.leads.map((lead) => `${lead.name} (${ago(lead.days)})`)),
    ...section("Seguimientos vencidos", summary.followups.map((item) => `${item.name} · ${item.type} (venció ${ago(item.days)})`)),
    ...section("Presupuestos sin cerrar", summary.quotes.map((quote) => `${quote.name}${quote.car ? ` · ${quote.car}` : ""} (${ago(quote.days)})`)),
    ...section("Ventas con datos faltantes", summary.missingSales.map((item) => `${item.name}: falta ${item.missing.join(", ")}`)),
    ...section("Pendientes", summary.pendings.map((item) => item.title)),
    ...(summary.createdAlerts ? ["", `Se programaron ${summary.createdAlerts} seguimientos nuevos.`] : []),
    ...(appUrl ? ["", `Abrir la app: ${appUrl}`] : []),
  ].join("\n");
}

async function sendTelegram(message) {
  const { telegramToken, telegramChats } = getConfig();
  if (!telegramToken || !telegramChats.length) return { sent: false, reason: "Telegram no esta configurado." };

  const failures = [];
  for (const chatId of telegramChats) {
    const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true }),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      failures.push(detail?.description || `Telegram respondio ${response.status}`);
    }
  }

  return failures.length ? { sent: false, reason: failures.join(" · ") } : { sent: true };
}

/**
 * @param {{ dryRun?: boolean, send?: boolean }} options
 *   dryRun: calcula todo pero no crea seguimientos ni manda nada.
 *   send:   false para no mandar el mensaje aunque haya canal.
 */
export async function runDailyRoutine(options = {}) {
  const { supabaseUrl, supabaseKey, appUrl } = getConfig();
  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, skipped: true, error: "Falta configurar Supabase en el servidor." };
  }

  const dryRun = Boolean(options.dryRun);
  const errors = [];
  const source = `app_source=eq.${APP_SOURCE}`;

  const [vehicles, alerts, leads, quotes, operations, clients, pendings] = await Promise.all([
    safe("autos", db(`gestion_jd_vehicles?select=id,brand,model,license_plate,status,exit_date,sale_price,buyer_name,buyer_phone,has_credit,credit_start_date,credit_total_installments&${source}`), errors),
    safe("seguimientos", db("commercial_alerts?select=id,vehicle_id,client_name,alert_type,alert_date,status"), errors),
    safe("leads", db("meli_leads?select=lead_key,source,buyer_name,status,date_created,raw_json"), errors),
    safe("presupuestos", db(`gestion_jd_documents?select=id,client_id,operation_id,data,updated_at&${source}&document_type=eq.presupuesto_cliente&order=updated_at.desc&limit=100`), errors),
    safe("operaciones", db(`gestion_jd_operations?select=id,status&${source}`), errors),
    safe("clientes", db(`gestion_jd_clients?select=id,nombre&${source}`), errors),
    safe("pendientes", db(`gestion_jd_pendientes?select=id,title,completed_at&${source}`), errors),
  ]);

  // 1. Seguimientos que faltan.
  const newAlerts = alertsToCreate(vehicles, alerts);
  let createdAlerts = 0;
  if (newAlerts.length && !dryRun) {
    try {
      await db("commercial_alerts", { method: "POST", body: newAlerts, prefer: "return=minimal" });
      createdAlerts = newAlerts.length;
    } catch (error) {
      errors.push(`crear seguimientos: ${error instanceof Error ? error.message : "error"}`);
    }
  }

  // 2. Resumen del dia.
  const today = todayIso();
  const operationStatus = new Map(operations.map((operation) => [operation.id, operation.status]));
  const clientName = new Map(clients.map((client) => [client.id, text(client.nombre)]));
  const latestQuote = new Map();
  for (const quote of quotes) {
    const current = latestQuote.get(quote.operation_id);
    if (!current || quote.updated_at > current.updated_at) latestQuote.set(quote.operation_id, quote);
  }

  const summary = {
    leads: leadsNeedingReply(leads),
    followups: alerts
      .filter((alert) => (alert.status === "pending" || alert.status === "postponed") && alert.alert_date <= today)
      .map((alert) => ({
        name: text(alert.client_name) || "Cliente sin nombre",
        type: alert.alert_type === "credit_installment_10" ? "crédito, cuota 10" : "postventa 12 meses",
        days: daysSince(alert.alert_date),
      }))
      .sort((a, b) => b.days - a.days),
    quotes: [...latestQuote.values()]
      .filter((quote) => {
        const status = operationStatus.get(quote.operation_id);
        const days = daysSince(quote.updated_at);
        return status !== "finalizada" && status !== "cancelada" && days >= QUOTE_MIN_DAYS && days <= QUOTE_MAX_DAYS;
      })
      .map((quote) => ({
        name: clientName.get(quote.client_id) || text(quote.data?.nombre) || "Presupuesto sin nombre",
        car: text(quote.data?.vehModelo),
        days: daysSince(quote.updated_at),
      })),
    missingSales: vehicles
      .map((vehicle) => ({ name: vehicleName(vehicle), missing: missingSaleFields(vehicle) }))
      .filter((item) => item.missing.length),
    pendings: pendings.filter((item) => !item.completed_at).map((item) => ({ title: text(item.title) })),
    createdAlerts,
  };

  const message = buildMessage(summary, appUrl);

  // 3. Aviso al celular.
  const delivery = dryRun || options.send === false ? { sent: false, reason: "Prueba: no se envio." } : await sendTelegram(message);

  return {
    ok: true,
    dryRun,
    counts: {
      leads: summary.leads.length,
      followups: summary.followups.length,
      quotes: summary.quotes.length,
      missingSales: summary.missingSales.length,
      pendings: summary.pendings.length,
      alertsToCreate: newAlerts.length,
      alertsCreated: createdAlerts,
    },
    delivery,
    message,
    errors,
  };
}

export default async function handler(request, response) {
  const { cronSecret } = getConfig();

  // El resumen tiene nombres de clientes: sin la clave del cron nadie de afuera lo puede pedir.
  if (!cronSecret) {
    response.status(503).json({ ok: false, error: "Falta configurar CRON_SECRET en Vercel para habilitar la rutina diaria." });
    return;
  }
  if (request.headers?.authorization !== `Bearer ${cronSecret}`) {
    response.status(401).json({ ok: false, error: "No autorizado." });
    return;
  }

  try {
    const dryRun = request.query?.dryRun === "1";
    const result = await runDailyRoutine({ dryRun });
    // Hacia afuera van solo los numeros: el detalle viaja por el canal privado.
    response.status(result.ok ? 200 : 500).json({
      ok: result.ok,
      dryRun: result.dryRun,
      counts: result.counts,
      delivery: result.delivery,
      errors: result.errors,
      error: result.error,
    });
  } catch (error) {
    response.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Error inesperado." });
  }
}
