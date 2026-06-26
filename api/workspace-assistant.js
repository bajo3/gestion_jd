const DEFAULT_BASE_URL = "https://api.z.ai/api/coding/paas/v4";
const DEFAULT_MODEL = "glm-5.2";

const documentTypes = new Set([
  "compraVenta",
  "autorizacion",
  "datero",
  "recibo",
  "presupuesto",
  "testDrive",
  "formularioCliente",
]);

const routeMap = {
  home: "/",
  autos: "/autos",
  ventas: "/ventas",
  seguimientos: "/ventas/seguimientos",
  documentos: "/ventas/documentos",
  leads: "/leads",
  infracciones: "/infracciones",
  compraVenta: "/compra-venta",
  autorizacion: "/autorizacion-conduccion",
  datero: "/datero",
  recibo: "/recibo",
  presupuesto: "/presupuesto",
  testDrive: "/test-drive",
  formularioCliente: "/formulario-cliente",
};

function getApiKey() {
  return process.env.ZAI_API_KEY || process.env.GLM_API_KEY || "";
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined && item !== null)
      .map(([key, item]) => [key, typeof item === "string" ? item.trim() : item]),
  );
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

function sanitizeAction(input) {
  const source = input && typeof input === "object" ? input : {};
  const actionType = cleanString(source.actionType) || "answer";
  const documentType = cleanString(source.documentType);
  const routeKey = cleanString(source.routeKey);

  return {
    ok: true,
    model: cleanString(source.model),
    reply: cleanString(source.reply) || "Listo.",
    actionType: ["answer", "navigate", "documentDraft", "vehicleDraft"].includes(actionType) ? actionType : "answer",
    routeKey: routeMap[routeKey] ? routeKey : "",
    path: cleanString(source.path) || routeMap[routeKey] || "",
    documentType: documentTypes.has(documentType) ? documentType : "",
    values: cleanObject(source.values),
    title: cleanString(source.title),
    missing: Array.isArray(source.missing) ? source.missing.map(cleanString).filter(Boolean).slice(0, 10) : [],
  };
}

export async function runWorkspaceAssistant(payload) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: "Falta configurar ZAI_API_KEY o GLM_API_KEY en el entorno.",
    };
  }

  const baseUrl = process.env.ZAI_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.ZAI_MODEL || DEFAULT_MODEL;

  const system = `Sos el asistente general de Gestion JD, una web interna de agencia automotor.
Tenes que entender toda la web y ayudar a operar mas rapido.
Responde solamente JSON valido.

Secciones disponibles:
- home: /
- autos: /autos
- ventas: /ventas
- seguimientos: /ventas/seguimientos
- documentos: /ventas/documentos
- leads: /leads
- infracciones: /infracciones
- compraVenta: /compra-venta
- autorizacion: /autorizacion-conduccion
- datero: /datero
- recibo: /recibo
- presupuesto: /presupuesto
- testDrive: /test-drive
- formularioCliente: /formulario-cliente

Documentos y campos permitidos:
compraVenta: fecha, recibido, numeroDoc, telefono, domicilio, cantidadNum, dominio, marca, modelo, tipo, nMotor, nChasis, observaciones, sinGarantia.
autorizacion: diasValidos, lugar, fecha, autorizado, titular, marca, modelo, tipo, anio, motor, chasis, dominio, domicilioAuto, otrasCaracteristicas, propietarioNombre, propietarioDni, propietarioDomicilio, propietarioLocalidad.
datero: nombre, dni, fechaNacimiento, lugar, direccionReal, direccionDni, localidad, codigoPostal, provincia, telefono, celular, email, cuil, condicionFiscal, estadoCivil, detalles, conyugeNombre, conyugeDni, fechaOperacion, dominio, tomaCredito, creditoTotal, creditoCuotas, entregaPpa, ppaDominio, ppaMarca, ppaModelo, ppaAnio.
recibo: fecha, tipo, duplicado, cliente, doc, domicilio, localidad, concepto, monto, montoLetras, forma, detallePago, vehiculo, vehiculoDominio, obs.
presupuesto: fecha, moneda, nombre, telefono, dni, detalles, vehModelo, vehAnio, vehKm, precioVenta, entregaEfectivo, usadoModelo, usadoAnio, usadoKm, usadoToma, tomaCredito, creditoTotal, cuotasCant, gastosAdm, transferencia.
testDrive: fecha, horaSalida, horaLlegada, concesionario, marca, modelo, version, dominio, color, recorrido, kmInicial, kmFinal, combustibleInicial, combustibleFinal, sinDanos, rayones, golpes, observaciones, docDni, docLicencia, docCedula, nombreConductor, dniConductor, lugar, aclaracionConductor, nombreAsesor, aclaracionAsesor, docLicenciaCopia.
formularioCliente: dni, cuil, situacionLaboral.

Acciones:
- answer: para responder preguntas, resumen del mes, leads pendientes, estado de ventas.
- navigate: para abrir una seccion.
- documentDraft: para preparar/autocompletar un documento y abrir su pantalla.
- vehicleDraft: si el usuario quiere cargar una venta/auto; el frontend tiene otro flujo especializado.

Reglas:
- Para "que lead falta contestar", usa context.leads.urgent y responde con los mas importantes.
- Para "resumen del mes", resume autos vendidos, ingresos, leads, alertas y documentos segun contexto.
- Para "me haces un boleto compra venta", usa actionType documentDraft, documentType compraVenta, path /compra-venta.
- No inventes datos faltantes: ponelos en missing.
- Nunca digas que ya generaste PDF; deci que dejaste el borrador listo para revisar y generar.

Formato exacto:
{
  "reply": "texto breve en castellano",
  "actionType": "answer|navigate|documentDraft|vehicleDraft",
  "routeKey": "opcional",
  "path": "opcional",
  "documentType": "opcional",
  "title": "opcional",
  "values": {},
  "missing": []
}`;

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(payload) },
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
    ...sanitizeAction({ ...parsed, model }),
    model,
  };
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, error: "Metodo no permitido." });
    return;
  }

  try {
    const result = await runWorkspaceAssistant(request.body ?? {});
    response.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Error inesperado.",
    });
  }
}
