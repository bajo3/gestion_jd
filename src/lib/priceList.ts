import type { PriceCurrency, PriceListItem } from "@/types/priceList";

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
