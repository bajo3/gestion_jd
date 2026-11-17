const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5-5";
// Vercel acepta hasta 4,5 MB por pedido: las fotos llegan achicadas desde el navegador.
const MAX_TOTAL_BASE64 = 4_400_000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const extractionTool = {
  name: "registrar_dni",
  description: "Registra los datos leidos de un DNI argentino (frente y/o dorso).",
  input_schema: {
    type: "object",
    properties: {
      esDni: { type: "boolean", description: "false si las fotos no son de un DNI argentino." },
      apellido: { type: "string", description: "Apellido/s tal cual figuran." },
      nombre: { type: "string", description: "Nombre/s tal cual figuran." },
      dni: { type: "string", description: "Numero de documento, solo digitos." },
      sexo: { type: "string", description: "M, F o X." },
      fechaNacimiento: { type: "string", description: "YYYY-MM-DD. Vacio si no se lee." },
      cuil: { type: "string", description: "CUIL como figura en el dorso (XX-XXXXXXXX-X). Vacio si no figura." },
      domicilio: { type: "string", description: "Domicilio completo del dorso, con localidad y provincia. Vacio si no figura." },
      lugarNacimiento: { type: "string", description: "Lugar de nacimiento del dorso. Vacio si no figura." },
      dudas: { type: "array", items: { type: "string" }, description: "Datos que no se leen bien." },
    },
    required: ["esDni", "apellido", "nombre", "dni"],
  },
};

const SYSTEM = `Lees fotos de DNI argentinos (frente y dorso) para completar formularios de una agencia de autos.
Registra SOLO lo que figura escrito: nunca inventes. Un dato que no se ve va vacio.
- Numero de DNI sin puntos. Fechas como YYYY-MM-DD (los DNI usan "15 MAR/ MAR 1985" o "15/03/1985").
- El domicilio y el CUIL suelen estar en el dorso.
- Si un dato se lee a medias, ponelo igual y anotalo en "dudas".`;

function str(value) {
  return typeof value === "string" ? value.trim() : "";
}

function titleCase(value) {
  return str(value)
    .toLowerCase()
    .replace(/(^|[\s'-])([a-záéíóúñü])/g, (_, separator, letter) => separator + letter.toUpperCase());
}

export function sanitizeDni(input) {
  const source = input && typeof input === "object" ? input : {};
  const apellido = titleCase(source.apellido);
  const nombre = titleCase(source.nombre);
  const date = str(source.fechaNacimiento);
  const cuilDigits = str(source.cuil).replace(/\D/g, "");
  const sexo = str(source.sexo).toUpperCase();

  return {
    esDni: source.esDni !== false,
    apellido,
    nombre,
    nombreCompleto: `${apellido} ${nombre}`.trim(),
    dni: str(source.dni).replace(/\D/g, ""),
    sexo: ["M", "F", "X"].includes(sexo) ? sexo : "",
    fechaNacimiento: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "",
    cuil: cuilDigits.length === 11 ? `${cuilDigits.slice(0, 2)}-${cuilDigits.slice(2, 10)}-${cuilDigits.slice(10)}` : "",
    domicilio: str(source.domicilio),
    lugarNacimiento: str(source.lugarNacimiento),
    dudas: Array.isArray(source.dudas) ? source.dudas.map(str).filter(Boolean).slice(0, 8) : [],
  };
}

export async function scanDni(payload) {
  const apiKey = process.env.ANTHROPIC_API_KEY || "";
  if (!apiKey) {
    return { ok: false, error: "Falta configurar ANTHROPIC_API_KEY para leer el DNI con IA." };
  }

  const images = Array.isArray(payload?.images) ? payload.images.slice(0, 2) : [];
  const valid = images
    .map((image) => ({ mediaType: str(image?.mediaType).toLowerCase(), data: str(image?.data), side: str(image?.side) }))
    .filter((image) => image.data && IMAGE_TYPES.has(image.mediaType));
  if (!valid.length) return { ok: false, error: "No llego ninguna foto del DNI." };
  if (valid.reduce((total, image) => total + image.data.length, 0) > MAX_TOTAL_BASE64) {
    return { ok: false, error: "Las fotos son muy pesadas. Probá con fotos mas livianas." };
  }

  const content = [];
  for (const image of valid) {
    if (image.side) content.push({ type: "text", text: `Foto del ${image.side} del DNI:` });
    content.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } });
  }
  content.push({
    type: "text",
    text: `Lee el DNI y registra sus datos llamando a la herramienta "${extractionTool.name}". Responde solo con esa llamada, sin texto.`,
  });

  const model = process.env.DNI_MODEL || process.env.BOLETO_MODEL || DEFAULT_MODEL;
  const response = await fetch(API_URL, {
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
      tools: [extractionTool],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = str(body?.error?.message);
    } catch {
      // Sin cuerpo legible.
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
  if (!block?.input) {
    if (body?.stop_reason === "refusal") return { ok: false, error: "La IA no quiso leer esta foto." };
    return { ok: false, error: "La IA no devolvio datos del DNI. Reintentá con otra foto." };
  }

  const dni = sanitizeDni(block.input);
  if (!dni.esDni) return { ok: false, error: "La foto no parece ser de un DNI." };
  if (!dni.dni && !dni.apellido) return { ok: false, error: "No se pudo leer el DNI en la foto. Probá de mas cerca y sin reflejos." };
  return { ok: true, model, dni };
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, error: "Metodo no permitido." });
    return;
  }

  try {
    const result = await scanDni(request.body ?? {});
    response.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    response.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Error inesperado." });
  }
}
