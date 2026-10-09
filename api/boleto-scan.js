const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5-5";
// Vercel acepta hasta 4,5 MB por pedido: en base64 eso son ~3,3 MB de archivo.
const MAX_BASE64_LENGTH = 4_400_000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function getApiKey() {
  return process.env.ANTHROPIC_API_KEY || "";
}

const personSchema = {
  type: "object",
  properties: {
    nombre: { type: "string", description: "Apellido y nombre completos, como figuran en el boleto." },
    dni: { type: "string", description: "Solo digitos del DNI. Vacio si no figura." },
    cuit: { type: "string", description: "CUIT/CUIL tal cual figura. Vacio si no figura." },
    domicilio: { type: "string", description: "Domicilio completo con localidad. Vacio si no figura." },
    telefono: { type: "string", description: "Telefono. Vacio si no figura." },
    estadoCivil: { type: "string" },
  },
  required: ["nombre", "dni"],
};

const extractionTool = {
  name: "registrar_boleto",
  description: "Registra los datos leidos de un boleto de compra-venta de un automotor argentino.",
  input_schema: {
    type: "object",
    properties: {
      esBoleto: {
        type: "boolean",
        description: "false si el archivo no es un boleto de compra-venta de un vehiculo.",
      },
      fecha: { type: "string", description: "Fecha del boleto en formato YYYY-MM-DD. Vacio si no se lee." },
      vendedor: personSchema,
      comprador: personSchema,
      vehiculo: {
        type: "object",
        properties: {
          marca: { type: "string" },
          modelo: { type: "string", description: "Modelo y version, por ejemplo 'Cronos 1.3 Drive'." },
          tipo: { type: "string", description: "Tipo de vehiculo: sedan, pick-up, SUV, etc." },
          dominio: { type: "string", description: "Patente sin espacios ni guiones, en mayusculas." },
          anio: { type: "integer" },
          km: { type: "integer" },
          motor: { type: "string", description: "Numero de motor." },
          chasis: { type: "string", description: "Numero de chasis o VIN." },
          color: { type: "string" },
        },
        required: ["dominio"],
      },
      precio: { type: "number", description: "Precio total de la operacion, solo el numero, sin puntos ni signos." },
      moneda: { type: "string", enum: ["ARS", "USD"] },
      formaPago: {
        type: "string",
        description: "Como se paga: efectivo, transferencia, cheque, credito prendario, cuotas, auto en parte de pago, etc. Incluye la cantidad de cuotas si figura.",
      },
      observaciones: { type: "string", description: "Clausulas o aclaraciones relevantes (garantia, deudas, gastos). Breve." },
      legibilidad: { type: "string", enum: ["alta", "media", "baja"] },
      dudas: {
        type: "array",
        items: { type: "string" },
        description: "Datos que no se leen bien o que dudas, indicando cual es.",
      },
    },
    required: ["esBoleto", "vendedor", "comprador", "vehiculo", "legibilidad", "dudas"],
  },
};

const SYSTEM = `Sos un asistente que lee boletos de compra-venta de automotores de una agencia argentina (Jesus Diaz Automotores, tambien escrita JD).
Lee el documento con atencion y registra SOLO lo que figura escrito: nunca inventes ni completes datos.
- Un campo que no figura o no se lee va vacio. Si dudas de un dato, ponelo igual y anotalo en "dudas".
- Montos argentinos: "$17.800.000" => 17800000. Si el precio esta en dolares, moneda USD.
- Fechas dd/mm/aaaa => YYYY-MM-DD. DNI sin puntos. Patente en mayusculas sin espacios (viejas ABC123, nuevas AB123CD).
- "Vendedor" es quien entrega el auto y "comprador" quien lo recibe, segun el boleto.`;

function str(value) {
  return typeof value === "string" ? value.trim() : "";
}

function digits(value) {
  return str(String(value ?? "")).replace(/\D/g, "");
}

/** Acepta numeros o texto argentino ("80.000", "13.500.000,50"): el punto es de miles, la coma decimal. */
function toNumber(value) {
  if (typeof value === "number") return value;
  const text = str(String(value ?? "")).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  return text ? Number(text) : NaN;
}

function int(value) {
  const parsed = Math.round(toNumber(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function cleanPerson(input) {
  const person = input && typeof input === "object" ? input : {};
  return {
    nombre: str(person.nombre),
    dni: digits(person.dni),
    cuit: str(person.cuit),
    domicilio: str(person.domicilio),
    telefono: str(person.telefono),
    estadoCivil: str(person.estadoCivil),
  };
}

export function sanitizeExtraction(input) {
  const source = input && typeof input === "object" ? input : {};
  const vehicle = source.vehiculo && typeof source.vehiculo === "object" ? source.vehiculo : {};
  const date = str(source.fecha);
  const price = toNumber(source.precio);
  const legibility = ["alta", "media", "baja"].includes(source.legibilidad) ? source.legibilidad : "media";

  return {
    esBoleto: source.esBoleto !== false,
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "",
    vendedor: cleanPerson(source.vendedor),
    comprador: cleanPerson(source.comprador),
    vehiculo: {
      marca: str(vehicle.marca),
      modelo: str(vehicle.modelo),
      tipo: str(vehicle.tipo),
      dominio: str(vehicle.dominio).toUpperCase().replace(/[^A-Z0-9]/g, ""),
      anio: int(vehicle.anio),
      km: int(vehicle.km),
      motor: str(vehicle.motor),
      chasis: str(vehicle.chasis),
      color: str(vehicle.color),
    },
    precio: Number.isFinite(price) && price > 0 ? Math.round(price) : null,
    moneda: source.moneda === "USD" ? "USD" : "ARS",
    formaPago: str(source.formaPago),
    observaciones: str(source.observaciones),
    legibilidad: legibility,
    dudas: Array.isArray(source.dudas) ? source.dudas.map(str).filter(Boolean).slice(0, 12) : [],
  };
}

export async function scanBoleto(payload) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, error: "Falta configurar ANTHROPIC_API_KEY en el entorno para leer boletos con IA." };
  }

  const mediaType = str(payload?.mediaType).toLowerCase();
  const data = str(payload?.data);
  const isPdf = mediaType === "application/pdf";
  if (!data) return { ok: false, error: "No llego ningun archivo." };
  if (!isPdf && !IMAGE_TYPES.has(mediaType)) {
    return { ok: false, error: "Solo se pueden leer PDF o imagenes (JPG, PNG, WebP)." };
  }
  if (data.length > MAX_BASE64_LENGTH) {
    return { ok: false, error: "El archivo es muy pesado (maximo ~3 MB). Sacale una foto mas liviana o comprimi el PDF." };
  }

  const model = process.env.BOLETO_MODEL || DEFAULT_MODEL;
  const fileBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data } };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: SYSTEM,
      tools: [extractionTool],
      tool_choice: { type: "tool", name: extractionTool.name },
      messages: [
        {
          role: "user",
          content: [fileBlock, { type: "text", text: "Lee este boleto y registra sus datos con la herramienta." }],
        },
      ],
    }),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = str(body?.error?.message);
    } catch {
      // Sin cuerpo legible: alcanza con el codigo de estado.
    }
    const reason =
      response.status === 401
        ? "La clave de Anthropic no es valida."
        : response.status === 429
          ? "Se agoto el limite o el credito de la cuenta de Anthropic."
          : detail || "El servicio de lectura no respondio bien.";
    return { ok: false, error: `${reason} (codigo ${response.status})` };
  }

  const body = await response.json();
  const block = Array.isArray(body?.content) ? body.content.find((item) => item.type === "tool_use") : null;
  if (!block?.input) return { ok: false, error: "No se pudo leer el boleto: la IA no devolvio datos." };

  return { ok: true, model, extraction: sanitizeExtraction(block.input) };
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, error: "Metodo no permitido." });
    return;
  }

  try {
    const result = await scanBoleto(request.body ?? {});
    response.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    response.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Error inesperado." });
  }
}
