// Lee las condiciones de la venta que se escriben en el Datero ("Detalles") y las devuelve
// ordenadas (precio, entrega, seña, usado, credito, tipo de auto) para completar el resto
// de los documentos de la operacion: Compra y Venta, Recibo, Presupuesto, Operacion
// finalizada y Autorizacion.
//
// Usa Anthropic si esta ANTHROPIC_API_KEY; si no, el modelo GLM de Z.ai (ZAI_API_KEY).
// Al modelo no le llegan nombre, DNI ni domicilio del cliente: solo la operacion.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5-5";
const DEFAULT_GLM_BASE_URL = "https://api.z.ai/api/coding/paas/v4";
const DEFAULT_GLM_MODEL = "glm-5.2";
const MAX_DETAILS_LENGTH = 4000;
const PAYMENT_FORMS = ["Efectivo", "Transferencia", "Tarjeta", "Deposito", "Otro"];

const operationSchema = {
  type: "object",
  properties: {
    precio: { type: "number", description: "Precio total de venta del auto que compra el cliente. 0 si no figura." },
    moneda: { type: "string", enum: ["ARS", "USD"] },
    entregaDinero: {
      type: "number",
      description: "Total que paga en dinero (efectivo + transferencia, seña incluida), sin contar el usado ni el credito. 0 si no figura.",
    },
    sena: { type: "number", description: "Seña, reserva o anticipo que deja ahora. 0 si no hay." },
    formaPago: {
      type: "string",
      enum: PAYMENT_FORMS,
      description: "Como paga la seña o el dinero. Si no se dice, Efectivo.",
    },
    usado: {
      type: "object",
      description: "Auto que el cliente entrega en parte de pago. Todo vacio o 0 si no entrega.",
      properties: {
        marca: { type: "string" },
        modelo: { type: "string" },
        anio: { type: "integer" },
        km: { type: "integer" },
        dominio: { type: "string", description: "Patente en mayusculas sin espacios." },
        valorToma: { type: "number", description: "En cuanto se toma el usado. 0 si no figura." },
      },
    },
    credito: {
      type: "object",
      description: "Financiacion (credito prendario o cuotas). Todo 0 o vacio si no hay.",
      properties: {
        monto: { type: "number", description: "Monto financiado." },
        cuotas: { type: "integer", description: "Cantidad de cuotas." },
        valorCuota: { type: "number", description: "Valor de cada cuota." },
      },
    },
    tipoVehiculo: {
      type: "string",
      description:
        "Carroceria del auto que compra (ej: 'Sedan 4 puertas', 'Hatchback 5 puertas', 'Pick-up doble cabina', 'SUV'). Solo si se deduce con seguridad de la marca y el modelo; si no, vacio.",
    },
    observaciones: {
      type: "string",
      description:
        "Condiciones de pago redactadas para el boleto de compra-venta, en una a tres frases claras, solo con lo que figura. Vacio si no hay condiciones.",
    },
    dudas: {
      type: "array",
      items: { type: "string" },
      description: "Lo que no queda claro o habria que confirmar con el vendedor.",
    },
  },
  required: ["precio", "moneda", "entregaDinero", "sena", "formaPago", "dudas"],
};

const completionTool = {
  name: "completar_operacion",
  description: "Registra las condiciones de una venta de auto de una agencia argentina.",
  input_schema: operationSchema,
};

const SYSTEM = `Sos un asistente de una agencia de autos argentina (Jesus Diaz Automotores).
Te pasan lo que el vendedor anoto en el Datero de una venta y tenes que ordenar las condiciones de la operacion.
- Registra solo lo que figura: nunca inventes montos, cuotas ni datos del usado.
- Montos argentinos: "$17.800.000" => 17800000; "52 millones" o "52 palos" => 52000000; "500 lucas" o "500 mil" => 500000; "u$s", "usd" o "dolares" => moneda USD.
- "entrega", "pone", "paga en efectivo/transferencia" es dinero; "seña", "reserva", "deja" es la seña.
- El usado es el auto que el cliente entrega como parte de pago, no el que compra.
- Si el datero ya trae datos ordenados del usado o del credito, respetalos y completa solo lo que falte.
- Lo que no se entiende o es contradictorio va en "dudas".`;

function str(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** Acepta numeros o texto argentino ("80.000", "13.500.000,50"): el punto es de miles, la coma decimal. */
function toNumber(value) {
  if (typeof value === "number") return value;
  const text = str(String(value ?? "")).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  return text ? Number(text) : NaN;
}

function amount(value) {
  const parsed = Math.round(toNumber(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function year(value) {
  const parsed = amount(value);
  return parsed >= 1950 && parsed <= 2100 ? parsed : 0;
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function sanitizeOperation(input) {
  const source = object(input);
  const usado = object(source.usado);
  const credito = object(source.credito);

  return {
    precio: amount(source.precio),
    moneda: source.moneda === "USD" ? "USD" : "ARS",
    entregaDinero: amount(source.entregaDinero),
    sena: amount(source.sena),
    formaPago: PAYMENT_FORMS.includes(source.formaPago) ? source.formaPago : "Efectivo",
    usado: {
      marca: str(usado.marca),
      modelo: str(usado.modelo),
      anio: year(usado.anio),
      km: amount(usado.km),
      dominio: str(usado.dominio).toUpperCase().replace(/[^A-Z0-9]/g, ""),
      valorToma: amount(usado.valorToma),
    },
    credito: {
      monto: amount(credito.monto),
      cuotas: Math.min(amount(credito.cuotas), 120),
      valorCuota: amount(credito.valorCuota),
    },
    tipoVehiculo: str(source.tipoVehiculo).slice(0, 60),
    observaciones: str(source.observaciones).slice(0, 600),
    dudas: Array.isArray(source.dudas) ? source.dudas.map(str).filter(Boolean).slice(0, 8) : [],
  };
}

/** Solo lo que hace falta para entender la operacion: nada de nombre, DNI ni domicilio. */
function buildContext(payload) {
  const source = object(payload);
  const vehiculo = object(source.vehiculo);
  const credito = object(source.credito);
  const usado = object(source.usado);

  return {
    fechaOperacion: str(source.fechaOperacion),
    detalles: str(source.detalles).slice(0, MAX_DETAILS_LENGTH),
    autoQueCompra: {
      marca: str(vehiculo.marca),
      modelo: str(vehiculo.modelo),
      anio: str(String(vehiculo.anio ?? "")),
      dominio: str(vehiculo.dominio),
    },
    creditoCargadoEnElDatero: {
      tomaCredito: str(credito.tomaCredito),
      total: str(credito.total),
      cuotas: str(credito.cuotas),
    },
    usadoCargadoEnElDatero: {
      entrega: str(usado.entrega),
      dominio: str(usado.dominio),
      marca: str(usado.marca),
      modelo: str(usado.modelo),
      anio: str(usado.anio),
    },
  };
}

function extractJson(content) {
  if (typeof content !== "string") return null;
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(content.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function errorDetail(response) {
  try {
    const body = await response.json();
    return str(body?.error?.message) || str(body?.message);
  } catch {
    return "";
  }
}

async function completeWithAnthropic(context, apiKey) {
  const model = process.env.DATERO_MODEL || DEFAULT_ANTHROPIC_MODEL;
  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      ...(process.env.ANTHROPIC_WORKSPACE_ID ? { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID } : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      output_config: { effort: "low" },
      system: SYSTEM,
      tools: [completionTool],
      tool_choice: { type: "auto" },
      messages: [
        {
          role: "user",
          content: `Ordena esta operacion llamando a la herramienta "${completionTool.name}". Responde solo con esa llamada.\n\n${JSON.stringify(context)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await errorDetail(response);
    const reason =
      response.status === 401
        ? "La clave de Anthropic no es valida."
        : response.status === 429
          ? "Se agoto el limite o el credito de la cuenta de Anthropic."
          : detail || "La IA no respondio bien.";
    return { ok: false, error: `${reason} (codigo ${response.status})` };
  }

  const body = await response.json();
  const block = Array.isArray(body?.content) ? body.content.find((item) => item.type === "tool_use") : null;
  if (!block?.input) return { ok: false, error: "La IA no devolvio las condiciones de la operacion. Reintenta." };
  return { ok: true, model, operation: sanitizeOperation(block.input) };
}

async function completeWithGlm(context, apiKey) {
  const baseUrl = (process.env.ZAI_BASE_URL || DEFAULT_GLM_BASE_URL).replace(/\/$/, "");
  const model = process.env.ZAI_MODEL || DEFAULT_GLM_MODEL;
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `${SYSTEM}\n\nResponde solo un JSON, sin markdown, con esta forma (JSON Schema):\n${JSON.stringify(operationSchema)}`,
        },
        { role: "user", content: JSON.stringify(context) },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await errorDetail(response);
    return { ok: false, error: `GLM respondio ${response.status}. ${detail}`.trim() };
  }

  const body = await response.json();
  const parsed = extractJson(body?.choices?.[0]?.message?.content);
  if (!parsed) return { ok: false, error: "La IA no devolvio un JSON valido. Reintenta." };
  return { ok: true, model, operation: sanitizeOperation(parsed) };
}

export async function completeDatero(payload) {
  const context = buildContext(payload);
  if (!context.detalles) return { ok: false, error: "No hay detalles de la operacion para leer." };

  const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
  if (anthropicKey) return completeWithAnthropic(context, anthropicKey);

  const glmKey = process.env.ZAI_API_KEY || process.env.GLM_API_KEY || "";
  if (glmKey) return completeWithGlm(context, glmKey);

  return { ok: false, error: "Falta configurar ANTHROPIC_API_KEY (o ZAI_API_KEY) para completar con IA." };
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, error: "Metodo no permitido." });
    return;
  }

  try {
    const result = await completeDatero(request.body ?? {});
    response.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    response.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Error inesperado." });
  }
}
