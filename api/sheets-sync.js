import { createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

// La planilla usa las columnas A..L: unidad, anio, km, version, color, combustible,
// traccion, caja, cilindrada, precio contado, precio lista y la marca de control.
const FIRST_COLUMN = "A";
const LAST_COLUMN = "L";

let cachedToken = null;

function getConfig() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SHEET_ID || "";
  const sheetName = process.env.GOOGLE_SHEET_NAME || "";

  return { email, privateKey, spreadsheetId, sheetName };
}

export function isSheetsSyncConfigured() {
  const { email, privateKey, spreadsheetId } = getConfig();
  return Boolean(email && privateKey && spreadsheetId);
}

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Firma un JWT RS256 y lo canjea por un access token de Google. */
async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const { email, privateKey } = getConfig();
  const issuedAt = Math.floor(Date.now() / 1000);
  const claims = {
    iss: email,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600,
  };

  const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(
    JSON.stringify(claims),
  )}`;

  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(privateKey, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || "Google rechazo las credenciales.");
  }

  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000,
  };

  return cachedToken.value;
}

/** Prefija el nombre de hoja solo si esta configurado; si no, Google usa la primera. */
function buildRange(sheetName, cells) {
  if (!sheetName) return cells;
  return `'${sheetName.replace(/'/g, "''")}'!${cells}`;
}

function rowRange(sheetName, row) {
  return buildRange(sheetName, `${FIRST_COLUMN}${row}:${LAST_COLUMN}${row}`);
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** Escribe los precios como texto, igual que se venian cargando a mano en la planilla. */
function formatPrice(value, currency) {
  if (value === null || value === undefined || value === "") return "";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";

  const grouped = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(amount);
  return currency === "USD" ? `${grouped} USD` : `$${grouped}`;
}

function toSheetRow(item) {
  const source = item && typeof item === "object" ? item : {};
  const currency = source.currency === "USD" ? "USD" : "ARS";

  return [
    cleanString(source.unit),
    cleanString(source.yearLabel),
    cleanString(source.kmLabel),
    cleanString(source.version),
    cleanString(source.color),
    cleanString(source.fuel),
    cleanString(source.traction),
    cleanString(source.gearbox),
    cleanString(source.displacement),
    formatPrice(source.cashPrice, currency),
    formatPrice(source.listPrice, currency),
    cleanString(source.controlMark),
  ];
}

async function callSheets(path, { method = "GET", body, token }) {
  const { spreadsheetId } = getConfig();
  const response = await fetch(`${SHEETS_API}/${spreadsheetId}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Google respondio ${response.status}.`);
  }

  return payload;
}

/** "'Hoja 1'!A61:L61" -> 61 */
function parseUpdatedRow(updatedRange) {
  const match = /![A-Z]+(\d+)/.exec(updatedRange || "");
  return match ? Number(match[1]) : null;
}

/**
 * Refleja en la planilla de Google un cambio hecho desde la web.
 *
 * - update: reescribe la fila `sheetRow` completa.
 * - append: agrega una fila al final y devuelve su numero.
 * - clear: vacia la fila sin borrarla, para no correr las filas de abajo
 *   (eso invalidaria el sheetRow guardado del resto de los vehiculos).
 */
export async function syncPriceListToSheet(payload) {
  if (!isSheetsSyncConfigured()) {
    return { ok: false, skipped: true, error: "Sincronizacion con Google Sheets no configurada." };
  }

  const body = payload && typeof payload === "object" ? payload : {};
  const action = cleanString(body.action) || "update";
  const sheetRow = Number(body.sheetRow);
  const { sheetName } = getConfig();
  const token = await getAccessToken();

  if (action === "append") {
    const result = await callSheets(
      `/values/${encodeURIComponent(buildRange(sheetName, `${FIRST_COLUMN}:${LAST_COLUMN}`))}:append` +
        `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", token, body: { values: [toSheetRow(body.item)] } },
    );

    return { ok: true, action, sheetRow: parseUpdatedRow(result?.updates?.updatedRange) };
  }

  if (!Number.isInteger(sheetRow) || sheetRow < 1) {
    return { ok: false, error: "Falta la fila de la planilla para este vehiculo." };
  }

  if (action === "clear") {
    await callSheets(`/values/${encodeURIComponent(rowRange(sheetName, sheetRow))}:clear`, {
      method: "POST",
      token,
      body: {},
    });

    return { ok: true, action, sheetRow };
  }

  if (action !== "update") {
    return { ok: false, error: `Accion no soportada: ${action}` };
  }

  await callSheets(
    `/values/${encodeURIComponent(rowRange(sheetName, sheetRow))}?valueInputOption=RAW`,
    { method: "PUT", token, body: { values: [toSheetRow(body.item)] } },
  );

  return { ok: true, action, sheetRow };
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, error: "Metodo no permitido." });
    return;
  }

  try {
    const result = await syncPriceListToSheet(request.body ?? {});
    response.status(result.ok || result.skipped ? 200 : 400).json(result);
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Error inesperado.",
    });
  }
}
