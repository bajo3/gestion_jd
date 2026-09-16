import type { PriceCurrency, PriceListItem, PriceListItemInput } from "@/types/priceList";

/** Reduce un item a su forma editable: lo que se manda a Supabase y a la planilla. */
export function priceListItemToInput(item: PriceListItem): PriceListItemInput {
  return {
    brand: item.brand,
    unit: item.unit,
    yearLabel: item.yearLabel,
    kmLabel: item.kmLabel,
    version: item.version,
    color: item.color,
    fuel: item.fuel,
    traction: item.traction,
    gearbox: item.gearbox,
    displacement: item.displacement,
    cashPrice: item.cashPrice,
    listPrice: item.listPrice,
    currency: item.currency,
    controlMark: item.controlMark,
    photoUrl: item.photoUrl,
    isPublic: item.isPublic,
    sheetRow: item.sheetRow,
    sortOrder: item.sortOrder,
  };
}

/** Formatea un precio con el simbolo de su moneda: "$ 22.900.000" o "USD 31.400". */
export function formatPrice(value: number | null, currency: PriceCurrency) {
  if (value === null || !Number.isFinite(value)) return "A consultar";
  const amount = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);
  return currency === "USD" ? `USD ${amount}` : `$ ${amount}`;
}

/** Convierte "31.400" o "22,900,000" en 31400 / 22900000. Devuelve null si no hay digitos. */
export function parsePriceInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  return Number(digits);
}

/** Agrupa los digitos con puntos mientras se escribe en el celular. */
export function formatPriceInput(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);
}

/** Titulo visible del vehiculo: "BJ 30 4 X 4" o solo la unidad si no hay version. */
export function priceListItemTitle(item: PriceListItem) {
  return [item.unit, item.version].filter(Boolean).join(" ").trim() || item.brand;
}

/** Etiquetas cortas para los chips de la card (combustible, caja, traccion, color). */
export function priceListItemTags(item: PriceListItem) {
  return [item.fuel, item.gearbox, item.traction, item.displacement, item.color]
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** Texto para buscar sin acentos ni mayusculas. */
export function priceListItemSearchText(item: PriceListItem) {
  return [
    item.brand,
    item.unit,
    item.version,
    item.yearLabel,
    item.kmLabel,
    item.color,
    item.fuel,
    item.traction,
    item.gearbox,
    item.displacement,
  ]
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeSearchTerm(term: string) {
  return term
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function groupByBrand(items: PriceListItem[]) {
  const groups = new Map<string, PriceListItem[]>();
  for (const item of items) {
    const brand = item.brand || "Sin marca";
    const current = groups.get(brand);
    if (current) current.push(item);
    else groups.set(brand, [item]);
  }
  return [...groups.entries()];
}

// --- Puente con la planilla de Google -------------------------------------
// La planilla usa las columnas A..L en este orden. El cliente arma y lee las
// filas para que el endpoint sea un escritor tonto y no haya dos formatos.

export const SHEET_COLUMN_COUNT = 12;

const SIGNATURE_SEPARATOR = "\u0001";

/** Escribe el precio como texto, igual que se venia cargando a mano. */
function formatSheetPrice(value: number | null, currency: PriceCurrency) {
  if (value === null || !Number.isFinite(value)) return "";
  const amount = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);
  return currency === "USD" ? `${amount} USD` : `$${amount}`;
}

export function priceListItemToSheetValues(item: PriceListItem | PriceListItemInput) {
  return [
    item.unit,
    item.yearLabel,
    item.kmLabel,
    item.version,
    item.color,
    item.fuel,
    item.traction,
    item.gearbox,
    item.displacement,
    formatSheetPrice(item.cashPrice, item.currency),
    formatSheetPrice(item.listPrice, item.currency),
    item.controlMark,
  ].map((value) => (typeof value === "string" ? value.trim() : ""));
}

/**
 * Texto estable de una fila, para detectar si la planilla cambio.
 * Normaliza el largo porque Google recorta las celdas vacias del final.
 */
export function sheetValuesSignature(values: readonly string[]) {
  const normalized = Array.from({ length: SHEET_COLUMN_COUNT }, (_, index) =>
    (values[index] ?? "").trim(),
  );
  return normalized.join(SIGNATURE_SEPARATOR);
}

/** "31.400 USD" -> 31400 en dolares; "$24.900.000" -> 24900000 en pesos. */
function parseSheetPrice(raw: string): { value: number | null; currency: PriceCurrency | null } {
  const text = (raw ?? "").trim();
  if (!text) return { value: null, currency: null };

  const digits = text.replace(/\D/g, "");
  if (!digits) return { value: null, currency: null };

  return { value: Number(digits), currency: /usd|u\$s|dolar/i.test(text) ? "USD" : "ARS" };
}

/** Convierte una fila de la planilla en los campos editables de un vehiculo. */
export function sheetValuesToPriceListInput(
  values: readonly string[],
  base: PriceListItemInput,
): PriceListItemInput {
  const at = (index: number) => (values[index] ?? "").trim();
  const cash = parseSheetPrice(at(9));
  const list = parseSheetPrice(at(10));

  return {
    ...base,
    unit: at(0),
    yearLabel: at(1),
    kmLabel: at(2),
    version: at(3),
    color: at(4),
    fuel: at(5),
    traction: at(6),
    gearbox: at(7),
    displacement: at(8),
    cashPrice: cash.value,
    listPrice: list.value,
    currency: cash.currency ?? list.currency ?? base.currency,
    controlMark: at(11),
  };
}

/**
 * Pasa la fila cruda por el mismo formateo que usa la app al escribir.
 * Asi "$24,900,000" y "$24.900.000" son la misma fila, y solo cuentan los
 * cambios de valor reales, no como quedo tipeado a mano en la planilla.
 */
export function normalizeSheetValues(values: readonly string[], base: PriceListItemInput) {
  return priceListItemToSheetValues(sheetValuesToPriceListInput(values, base));
}

/** Una fila con solo la columna A cargada es un titulo de marca, no un vehiculo. */
export function isSheetBrandHeader(values: readonly string[]) {
  const [first, ...rest] = Array.from({ length: SHEET_COLUMN_COUNT }, (_, i) => (values[i] ?? "").trim());
  return Boolean(first) && rest.every((value) => !value);
}

export function isSheetRowEmpty(values: readonly string[]) {
  return Array.from({ length: SHEET_COLUMN_COUNT }, (_, i) => (values[i] ?? "").trim()).every(
    (value) => !value,
  );
}
