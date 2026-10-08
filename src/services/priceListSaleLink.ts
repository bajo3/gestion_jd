import { priceListItemStatus, priceListItemTitle } from "@/lib/priceList";
import { listPriceListItems, setItemHighlight } from "@/services/priceListService";
import type { PriceListItem } from "@/types/priceList";

/**
 * El Historial de Autos y la Lista de precios son dos listas separadas, sin un dato que las una.
 * Al cerrar una venta se busca a que fila de la lista corresponde el auto para pintarla de
 * amarillo en la planilla: el estado "vendido" lo decide despues quien maneja la lista.
 */
export type SoldCar = {
  brand?: string;
  model?: string;
  year?: number | string | null;
  kilometers?: number | string | null;
  color?: string;
};

function norm(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compact(value: unknown) {
  return norm(value).replace(/\s+/g, "");
}

function digits(value: unknown) {
  const found = String(value ?? "").replace(/\D/g, "");
  return found ? Number(found) : null;
}

/** Puntaje de parecido entre el auto vendido y una fila de la lista. 0 = no es el mismo modelo. */
function scoreItem(item: PriceListItem, car: SoldCar) {
  const carText = compact(`${car.brand ?? ""} ${car.model ?? ""}`);
  const unit = compact(item.unit);
  // Sin la unidad ("amarok", "t cross") adentro del modelo vendido no hay coincidencia posible.
  if (!unit || !carText.includes(unit)) return 0;

  let score = 3;
  if (car.brand && compact(item.brand) === compact(car.brand)) score += 2;

  for (const word of norm(item.version).split(" ").filter((part) => part.length >= 2)) {
    if (carText.includes(word)) score += 1;
  }

  const year = digits(car.year);
  if (year && digits(item.yearLabel) === year) score += 2;

  const km = digits(car.kilometers);
  const itemKm = digits(item.kmLabel);
  if (km !== null && itemKm !== null && Math.abs(km - itemKm) <= Math.max(2000, km * 0.05)) score += 2;

  if (car.color && norm(item.color) === norm(car.color)) score += 1;
  return score;
}

export type PriceListMatch = { item: PriceListItem; score: number };

/** Filas disponibles que podrian ser el auto vendido, de mas a menos parecida. */
export function rankPriceListMatches(items: PriceListItem[], car: SoldCar): PriceListMatch[] {
  // Si la app tiene dos registros iguales del mismo auto (una copia vieja de cuando se movio la
  // fila en la planilla), vale el que se actualizo ultimo: la copia apunta a una fila vacia.
  const unique = new Map<string, PriceListItem>();
  for (const item of items) {
    if (!item.sheetRow || priceListItemStatus(item) === "vendido") continue;
    const key = [item.brand, item.unit, item.version, item.yearLabel, item.kmLabel, item.color].map(norm).join("|");
    const current = unique.get(key);
    if (!current || item.updatedAt > current.updatedAt) unique.set(key, item);
  }

  return [...unique.values()]
    .map((item) => ({ item, score: scoreItem(item, car) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** La fila correcta solo si no hay duda: una sola candidata, o una claramente mejor que el resto. */
export function pickConfidentMatch(matches: PriceListMatch[]): PriceListItem | null {
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0].item;
  return matches[0].score - matches[1].score >= 2 ? matches[0].item : null;
}

/**
 * Autos disponibles de la lista que se nombran en un texto libre (lo que pidio un lead o un
 * encargo). Compara por palabras enteras: "ka" no coincide con "kangoo".
 */
export function matchPriceListByText(items: PriceListItem[], text: string): PriceListItem[] {
  const words = new Set(norm(text).split(" ").filter(Boolean));
  if (!words.size) return [];
  const seen = new Set<string>();

  return items.filter((item) => {
    if (priceListItemStatus(item) === "vendido") return false;
    const unitWords = norm(item.unit).split(" ").filter(Boolean);
    if (!unitWords.length || !unitWords.every((word) => words.has(word))) return false;
    // Una unidad de una sola letra o numero ("3", "c") no alcanza para afirmar nada.
    if (unitWords.join("").length < 2) return false;
    const key = [item.brand, item.unit, item.version, item.yearLabel, item.kmLabel].map(norm).join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function priceListItemLabel(item: PriceListItem) {
  const details = [item.yearLabel, item.kmLabel, item.color].map((part) => part.trim()).filter(Boolean).join(" · ");
  return `${item.brand} ${priceListItemTitle(item)}${details ? ` · ${details}` : ""}`;
}

export type HighlightOutcome = { ok: boolean; message: string };

/** Pinta de amarillo la fila elegida de la lista de precios. */
export async function highlightPriceListItem(item: PriceListItem): Promise<HighlightOutcome> {
  const result = await setItemHighlight(item, true);
  if (result.ok) return { ok: true, message: `Fila de ${priceListItemLabel(item)} pintada de amarillo en la lista de precios.` };
  return {
    ok: false,
    message: `No se pudo pintar de amarillo la fila en la lista de precios: ${result.error ?? "error desconocido"}.`,
  };
}

/**
 * Para los cierres automaticos (sin pantalla donde elegir): pinta la fila solo si hay una
 * coincidencia clara. Si hay dudas no adivina y avisa para marcarla a mano.
 */
export async function highlightSoldCarAutomatically(car: SoldCar): Promise<HighlightOutcome> {
  const matches = rankPriceListMatches(await listPriceListItems(), car);
  const match = pickConfidentMatch(matches);
  if (match) return highlightPriceListItem(match);
  return {
    ok: false,
    message: matches.length
      ? "Hay mas de un auto parecido en la lista de precios: pintalo de amarillo desde Lista de precios."
      : "No encontre el auto en la lista de precios: si figura ahi, pintalo de amarillo a mano.",
  };
}
