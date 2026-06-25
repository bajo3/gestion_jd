const DEFAULT_BASE_URL = "https://api.z.ai/api/coding/paas/v4";
const DEFAULT_MODEL = "glm-5.2";

const allowedStatuses = new Set([
  "ingresado",
  "en_preparacion",
  "publicado",
  "reservado",
  "vendido",
  "egresado",
  "archivado",
]);

function getApiKey() {
  return process.env.ZAI_API_KEY || process.env.GLM_API_KEY || "";
}

function toDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function cleanNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizePatch(input) {
  const source = input && typeof input === "object" ? input : {};
  const values = source.values && typeof source.values === "object" ? source.values : source;
  const patch = {};

  const stringFields = [
    "brand",
    "model",
    "licensePlate",
    "vin",
    "engine",
    "color",
    "entryDate",
    "exitDate",
    "observations",
    "buyerName",
    "buyerPhone",
    "creditStartDate",
  ];

  for (const field of stringFields) {
    if (field in values) patch[field] = cleanString(values[field]);
  }

  const numberFields = [
    "year",
    "kilometers",
    "purchasePrice",
    "salePrice",
    "creditTotalInstallments",
    "creditDueDay",
  ];

  for (const field of numberFields) {
    if (field in values) patch[field] = cleanNumber(values[field]);
  }

  if ("status" in values && allowedStatuses.has(values.status)) {
    patch.status = values.status;
  }

  if ("hasCredit" in values) {
    patch.hasCredit = Boolean(values.hasCredit);
  }

  return {
    values: patch,
    targetVehicleId: cleanString(source.targetVehicleId),
    notes: Array.isArray(source.notes) ? source.notes.map(cleanString).filter(Boolean).slice(0, 4) : [],
    assistantText: cleanString(source.assistantText),
  };
}

function extractJson(content) {
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  }
}

export async function parseAssistantWithGlm(payload) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: "Falta configurar ZAI_API_KEY o GLM_API_KEY en el entorno.",
    };
  }

  const baseUrl = process.env.ZAI_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.ZAI_MODEL || DEFAULT_MODEL;
  const vehicles = Array.isArray(payload.vehicles) ? payload.vehicles.slice(0, 80) : [];
  const currentValues = payload.currentValues && typeof payload.currentValues === "object" ? payload.currentValues : {};
  const currentDate = payload.currentDate || toDateOnly();

  const system = `Sos un asistente para una agencia automotor argentina llamada Gestion JD.
Tu tarea es convertir mensajes cortos de vendedores en datos estructurados de un vehiculo/venta.
Responde solamente JSON valido, sin markdown.

Campos permitidos en values:
brand, model, licensePlate, year, vin, engine, color, kilometers, entryDate, exitDate, status, observations, purchasePrice, salePrice, buyerName, buyerPhone, hasCredit, creditStartDate, creditTotalInstallments, creditDueDay.

Estados validos:
ingresado, en_preparacion, publicado, reservado, vendido, egresado, archivado.

Reglas:
- Si el mensaje dice vendido/vendida, status debe ser vendido.
- Si dice vendido/egresado/entregado y no hay fecha explicita, usa currentDate como exitDate.
- En Argentina, importes como "$17.800.000" son ARS 17800000.
- "39.000km" significa 39000 kilometros.
- Si menciona credito, financiado o cuotas, hasCredit debe ser true.
- Si falta un dato, no lo inventes.
- Si podes identificar un auto existente por patente o por coincidencia muy clara de marca/modelo/anio, devuelve targetVehicleId.
- Si hay duda entre varios autos, no devuelvas targetVehicleId.

Formato exacto:
{
  "values": { ...campos detectados },
  "targetVehicleId": "id existente o string vacio",
  "notes": ["suposiciones breves"],
  "assistantText": "respuesta breve en castellano"
}`;

  const user = JSON.stringify({
    currentDate,
    message: payload.message,
    currentValues,
    vehicles,
  });

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return {
      ok: false,
      error: `GLM respondio ${response.status}. ${detail.slice(0, 240)}`,
    };
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  const parsed = extractJson(content);

  if (!parsed) {
    return {
      ok: false,
      error: "GLM no devolvio JSON valido.",
    };
  }

  return {
    ok: true,
    model,
    ...sanitizePatch(parsed),
  };
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, error: "Metodo no permitido." });
    return;
  }

  try {
    const result = await parseAssistantWithGlm(request.body ?? {});
    response.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Error inesperado.",
    });
  }
}
