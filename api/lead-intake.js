// Entrada automatica de leads: cualquier sistema externo (una integracion con MercadoLibre,
// un formulario web, Zapier/Make con Instagram o Facebook) puede mandar leads aca y quedan
// cargados como "Sin contactar", igual que si se tipearan en la pantalla de Leads.
//
// POST /api/lead-intake
// Authorization: Bearer <LEAD_INTAKE_SECRET>
// { "name": "Juan Perez", "phone": "2494123456", "car": "Amarok V6", "source": "meli",
//   "externalId": "123", "text": "Hola, sigue disponible?", "date": "2026-10-07T12:00:00Z" }
// Tambien acepta { "leads": [ {...}, {...} ] } para mandar varios juntos.

const STATUS_NEW = "⏳ Sin contactar";
const MAX_BATCH = 100;
const DUPLICATE_WINDOW_DAYS = 30;

function getConfig() {
  return {
    supabaseUrl: (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, ""),
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "",
    secret: process.env.LEAD_INTAKE_SECRET || "",
  };
}

function text(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function phoneTail(phone) {
  return text(phone).replace(/\D/g, "").slice(-10);
}

function normalize(value) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "meli", "Instagram Ads" -> "meli", "instagram_ads". "encargo" y "manual" son de uso interno. */
function cleanSource(value) {
  const source = normalize(value).replace(/\s+/g, "_").slice(0, 30);
  if (!source || source === "encargo" || source === "manual") return "web";
  return source;
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
    throw new Error(`Supabase respondio ${response.status}. ${detail.slice(0, 200)}`);
  }
  if (response.status === 204) return [];
  return response.json().catch(() => []);
}

function toRow(input) {
  const source = cleanSource(input.source);
  const externalId = text(input.externalId ?? input.external_id ?? input.id);
  const created = new Date(text(input.date ?? input.createdAt) || Date.now());
  const name = text(input.name ?? input.nombre);
  const phone = text(input.phone ?? input.telefono);
  const car = text(input.car ?? input.auto ?? input.item ?? input.itemTitle);
  const message = text(input.text ?? input.message ?? input.mensaje);

  return {
    // Con id externo la clave es estable: el mismo lead mandado dos veces no se duplica.
    lead_key: externalId ? `${source}_${externalId}` : `${source}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    source,
    external_id: externalId || null,
    buyer_name: name,
    item_title: car,
    phone,
    email: text(input.email) || null,
    status: STATUS_NEW,
    lead_text: message || null,
    date_created: Number.isNaN(created.getTime()) ? new Date().toISOString() : created.toISOString(),
    raw_json: { notas: message, fecha_contacto: "" },
  };
}

/**
 * @param {unknown} payload un lead o { leads: [...] }
 * @param {{ dryRun?: boolean }} options dryRun: valida y deduplica, pero no guarda.
 */
export async function intakeLeads(payload, options = {}) {
  const { supabaseUrl, supabaseKey } = getConfig();
  if (!supabaseUrl || !supabaseKey) return { ok: false, error: "Falta configurar Supabase en el servidor." };

  const body = payload && typeof payload === "object" ? payload : {};
  const inputs = (Array.isArray(body) ? body : Array.isArray(body.leads) ? body.leads : [body]).slice(0, MAX_BATCH);

  const since = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 86400000).toISOString();
  const existing = await db(`meli_leads?select=lead_key,phone,item_title,date_created&date_created=gte.${encodeURIComponent(since)}`);
  const existingKeys = new Set(existing.map((row) => row.lead_key));
  const recent = new Set(existing.map((row) => `${phoneTail(row.phone)}|${normalize(row.item_title)}`));

  const rows = [];
  const skipped = [];

  for (const input of inputs) {
    if (!input || typeof input !== "object") {
      skipped.push({ reason: "formato invalido" });
      continue;
    }

    const row = toRow(input);
    const label = row.buyer_name || row.phone || "sin datos";

    // Sin nombre ni telefono no hay a quien contestarle.
    if (!row.buyer_name && !row.phone) {
      skipped.push({ lead: label, reason: "falta nombre o telefono" });
      continue;
    }
    if (existingKeys.has(row.lead_key)) {
      skipped.push({ lead: label, reason: "ya estaba cargado (mismo id)" });
      continue;
    }
    // La misma persona consultando por el mismo auto dentro del mes es el mismo lead.
    const signature = `${phoneTail(row.phone)}|${normalize(row.item_title)}`;
    if (phoneTail(row.phone).length >= 8 && recent.has(signature)) {
      skipped.push({ lead: label, reason: "ya estaba cargado (mismo telefono y auto)" });
      continue;
    }

    existingKeys.add(row.lead_key);
    recent.add(signature);
    rows.push(row);
  }

  if (rows.length && !options.dryRun) {
    await db("meli_leads", { method: "POST", body: rows, prefer: "return=minimal" });
  }

  return { ok: true, dryRun: Boolean(options.dryRun), created: rows.length, skipped };
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, error: "Metodo no permitido." });
    return;
  }

  const { secret } = getConfig();
  if (!secret) {
    response.status(503).json({ ok: false, error: "Falta configurar LEAD_INTAKE_SECRET en Vercel para recibir leads." });
    return;
  }

  const provided = request.headers?.authorization?.replace(/^Bearer\s+/i, "") || request.headers?.["x-api-key"] || "";
  if (provided !== secret) {
    response.status(401).json({ ok: false, error: "No autorizado." });
    return;
  }

  try {
    const result = await intakeLeads(request.body ?? {}, { dryRun: request.query?.dryRun === "1" });
    response.status(result.ok ? 200 : 500).json(result);
  } catch (error) {
    response.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Error inesperado." });
  }
}
