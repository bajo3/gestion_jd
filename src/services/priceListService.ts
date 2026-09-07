import {
  isSheetBrandHeader,
  isSheetRowEmpty,
  normalizeSheetValues,
  priceListItemToInput,
  priceListItemToSheetValues,
  sheetValuesSignature,
  sheetValuesToPriceListInput,
} from "@/lib/priceList";
import { readStorage, writeStorage } from "@/lib/storage";
import { generateId } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import { syncToSheet } from "@/services/sheetsSyncService";
import { emptyPriceListItem, type PriceCurrency, type PriceListItem, type PriceListItemInput } from "@/types/priceList";

const STORAGE_KEY = "gestion-jd-lista-precios";
const PRICE_LIST_TABLE = "gestion_jd_lista_precios";
const APP_SOURCE = "gestion_jd";

type DbPriceListItem = {
  id: string;
  app_source: string;
  brand: string;
  unit: string;
  year_label?: string | null;
  km_label?: string | null;
  version?: string | null;
  color?: string | null;
  fuel?: string | null;
  traction?: string | null;
  gearbox?: string | null;
  displacement?: string | null;
  cash_price?: number | string | null;
  list_price?: number | string | null;
  currency?: string | null;
  control_mark?: string | null;
  photo_url?: string | null;
  is_public?: boolean | null;
  sheet_row?: number | null;
  sheet_snapshot?: string | null;
  sort_order?: number | null;
  created_at: string;
  updated_at: string;
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toCurrency(value: string | null | undefined): PriceCurrency {
  return value === "USD" ? "USD" : "ARS";
}

function mapDbItem(item: DbPriceListItem): PriceListItem {
  return {
    id: item.id,
    brand: item.brand ?? "",
    unit: item.unit ?? "",
    yearLabel: item.year_label ?? "",
    kmLabel: item.km_label ?? "",
    version: item.version ?? "",
    color: item.color ?? "",
    fuel: item.fuel ?? "",
    traction: item.traction ?? "",
    gearbox: item.gearbox ?? "",
    displacement: item.displacement ?? "",
    cashPrice: toNumber(item.cash_price),
    listPrice: toNumber(item.list_price),
    currency: toCurrency(item.currency),
    controlMark: item.control_mark ?? "",
    photoUrl: item.photo_url ?? "",
    isPublic: item.is_public !== false,
    sheetRow: toNumber(item.sheet_row),
    sheetSnapshot: item.sheet_snapshot ?? "",
    sortOrder: Number.isFinite(item.sort_order) ? Number(item.sort_order) : 0,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

function itemPayload(input: PriceListItemInput) {
  return {
    app_source: APP_SOURCE,
    brand: input.brand.trim(),
    unit: input.unit.trim(),
    year_label: input.yearLabel.trim() || null,
    km_label: input.kmLabel.trim() || null,
    version: input.version.trim() || null,
    color: input.color.trim() || null,
    fuel: input.fuel.trim() || null,
    traction: input.traction.trim() || null,
    gearbox: input.gearbox.trim() || null,
    displacement: input.displacement.trim() || null,
    cash_price: input.cashPrice,
    list_price: input.listPrice,
    currency: input.currency,
    control_mark: input.controlMark.trim() || null,
    photo_url: input.photoUrl.trim() || null,
    is_public: input.isPublic,
    sheet_row: input.sheetRow,
    sort_order: input.sortOrder,
  };
}

/** Ordena por marca y, dentro de cada marca, por el orden manual de la planilla. */
export function sortPriceListItems(items: PriceListItem[]) {
  return [...items].sort((a, b) => {
    const byBrand = a.brand.localeCompare(b.brand, "es");
    if (byBrand !== 0) return byBrand;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.unit.localeCompare(b.unit, "es");
  });
}

function readLocalItems() {
  const stored = readStorage<PriceListItem[]>(STORAGE_KEY, []);
  return Array.isArray(stored) ? stored : [];
}

function saveLocalItems(items: PriceListItem[]) {
  writeStorage(STORAGE_KEY, sortPriceListItems(items));
}

/**
 * Devuelve la lista completa. Cuando Supabase responde, la cachea en el
 * navegador para que el catalogo siga visible aunque se caiga la conexion.
 */
export async function listPriceListItems({ onlyPublic = false } = {}) {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from(PRICE_LIST_TABLE).select("*").eq("app_source", APP_SOURCE);
      if (onlyPublic) query = query.eq("is_public", true);

      const { data, error } = await query
        .order("brand", { ascending: true })
        .order("sort_order", { ascending: true });

      if (!error && data) {
        const items = sortPriceListItems((data as DbPriceListItem[]).map(mapDbItem));
        if (!onlyPublic) saveLocalItems(items);
        return items;
      }
    } catch {
      // Cae al cache local.
    }
  }

  const localItems = sortPriceListItems(readLocalItems());
  return onlyPublic ? localItems.filter((item) => item.isPublic) : localItems;
}

export function priceListItemSignature(item: PriceListItem | PriceListItemInput) {
  return sheetValuesSignature(priceListItemToSheetValues(item));
}

/**
 * Anota que este vehiculo y su fila de la planilla estan alineados.
 * El snapshot es lo que despues permite distinguir quien cambio que.
 */
async function markSheetSynced(item: PriceListItem, sheetRow: number | null, snapshot: string) {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from(PRICE_LIST_TABLE)
      .update({ sheet_row: sheetRow ?? item.sheetRow, sheet_snapshot: snapshot })
      .eq("id", item.id)
      .eq("app_source", APP_SOURCE)
      .select("*")
      .single();

    if (error || !data) return null;
    return mapDbItem(data as DbPriceListItem);
  } catch {
    return null;
  }
}

/** Empuja el vehiculo a la planilla: reescribe su fila o la crea si no tiene. */
async function pushItemToSheet(item: PriceListItem) {
  const values = priceListItemToSheetValues(item);
  const sheet = item.sheetRow
    ? await syncToSheet({ action: "update", sheetRow: item.sheetRow, values })
    : await syncToSheet({ action: "append", values });

  if (!sheet.ok) return { sheet, item };

  const synced = await markSheetSynced(item, sheet.sheetRow ?? item.sheetRow, sheetValuesSignature(values));
  return { sheet, item: synced ?? item };
}

export async function createPriceListItem(input: PriceListItemInput) {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from(PRICE_LIST_TABLE)
        .insert(itemPayload(input))
        .select("*")
        .single();

      if (!error && data) {
        // La planilla asigna la fila; recien ahi sabemos que sheetRow guardar.
        const { item, sheet } = await pushItemToSheet(mapDbItem(data as DbPriceListItem));
        saveLocalItems([...readLocalItems(), item]);
        return { item, persisted: true, sheet };
      }
    } catch {
      // Cae al guardado local.
    }
  }

  const now = new Date().toISOString();
  const item: PriceListItem = {
    ...input,
    id: generateId(),
    sheetSnapshot: "",
    createdAt: now,
    updatedAt: now,
  };
  saveLocalItems([...readLocalItems(), item]);
  return { item, persisted: false, sheet: null };
}

export async function updatePriceListItem(id: string, input: PriceListItemInput) {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from(PRICE_LIST_TABLE)
        .update(itemPayload(input))
        .eq("id", id)
        .eq("app_source", APP_SOURCE)
        .select("*")
        .single();

      if (!error && data) {
        const { item, sheet } = await pushItemToSheet(mapDbItem(data as DbPriceListItem));
        saveLocalItems(readLocalItems().map((current) => (current.id === id ? item : current)));
        return { item, persisted: true, sheet };
      }
    } catch {
      // Cae al guardado local.
    }
  }

  const current = readLocalItems().find((item) => item.id === id);
  const item: PriceListItem = {
    ...input,
    id,
    sheetSnapshot: current?.sheetSnapshot ?? "",
    createdAt: current?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveLocalItems(readLocalItems().map((entry) => (entry.id === id ? item : entry)));
  return { item, persisted: false, sheet: null };
}

export async function deletePriceListItem(id: string) {
  const current = readLocalItems().find((item) => item.id === id);
  let persisted = false;

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from(PRICE_LIST_TABLE)
        .delete()
        .eq("id", id)
        .eq("app_source", APP_SOURCE);

      persisted = !error;
    } catch {
      persisted = false;
    }
  }

  saveLocalItems(readLocalItems().filter((item) => item.id !== id));

  // Se vacia la fila en lugar de eliminarla: borrarla correria todas las de abajo
  // y dejaria mal el sheetRow del resto de los vehiculos.
  const sheet =
    persisted && current?.sheetRow
      ? await syncToSheet({ action: "clear", sheetRow: current.sheetRow })
      : null;

  return { persisted, sheet };
}

// --- Traer cambios hechos a mano en la planilla ---------------------------

export type SheetConflict = {
  item: PriceListItem;
  /** Como quedaria el vehiculo si ganara la planilla. */
  sheetInput: PriceListItemInput;
  sheetSignature: string;
};

export type SheetPullResult = {
  /** Vehiculos que solo cambiaron en la planilla y ya se importaron. */
  imported: PriceListItem[];
  /** Filas nuevas de la planilla, dadas de alta como vehiculos. */
  created: PriceListItem[];
  /** Vehiculos que se editaron de los dos lados: los resuelve el usuario. */
  conflicts: SheetConflict[];
  skipped?: boolean;
  error?: string;
};

const EMPTY_PULL: SheetPullResult = { imported: [], created: [], conflicts: [] };

/** Guarda en Supabase una fila importada de la planilla, sin volver a escribirla ahi. */
async function applySheetImport(item: PriceListItem, input: PriceListItemInput, signature: string) {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from(PRICE_LIST_TABLE)
      .update({ ...itemPayload(input), sheet_snapshot: signature })
      .eq("id", item.id)
      .eq("app_source", APP_SOURCE)
      .select("*")
      .single();

    if (error || !data) return null;
    return mapDbItem(data as DbPriceListItem);
  } catch {
    return null;
  }
}

/** La marca de un vehiculo es el ultimo titulo de marca que aparece arriba suyo. */
function brandForRow(rows: string[][], rowIndex: number) {
  for (let index = rowIndex - 1; index >= 0; index -= 1) {
    if (isSheetBrandHeader(rows[index] ?? [])) return (rows[index][0] ?? "").trim().toUpperCase();
  }
  return "";
}

/**
 * Lee la planilla y decide, fila por fila, de que lado hubo cambios comparando
 * contra el snapshot guardado:
 *
 * - nadie cambio nada        -> no se toca
 * - solo cambio la planilla  -> se importa solo
 * - solo cambio la web       -> se reescribe la fila (recupera un push fallido)
 * - cambiaron los dos        -> conflicto, lo resuelve el usuario
 *
 * Las filas de marca y las vacias se ignoran; las filas nuevas se dan de alta.
 */
export async function pullSheetChanges(items: PriceListItem[]): Promise<SheetPullResult> {
  const sheet = await syncToSheet({ action: "read" });
  if (!sheet.ok) {
    return { ...EMPTY_PULL, skipped: sheet.skipped, error: sheet.error };
  }

  const rows = sheet.rows ?? [];
  const bySheetRow = new Map(items.filter((item) => item.sheetRow).map((item) => [item.sheetRow, item]));
  const result: SheetPullResult = { imported: [], created: [], conflicts: [] };

  for (const [index, values] of rows.entries()) {
    const sheetRow = index + 1;
    if (isSheetRowEmpty(values) || isSheetBrandHeader(values)) continue;

    const item = bySheetRow.get(sheetRow);
    const base = item ? priceListItemToInput(item) : emptyPriceListItem();
    const signature = sheetValuesSignature(normalizeSheetValues(values, base));

    if (!item) {
      // Fila cargada a mano en la planilla: se da de alta como vehiculo nuevo.
      const brand = brandForRow(rows, index);
      if (!brand || (values[0] ?? "").trim().toUpperCase() === "UNIDAD") continue;

      const input = sheetValuesToPriceListInput(values, {
        ...emptyPriceListItem(brand),
        sheetRow,
        sortOrder: sheetRow * 10,
      });

      const created = await insertImportedItem(input, signature);
      if (created) result.created.push(created);
      continue;
    }

    // Sin snapshot no hay con que comparar: pasa la primera vez, con la lista
    // recien importada. Como la base se sembro desde la planilla, la planilla
    // manda, y si ya coinciden solo se adopta el snapshot sin ruido.
    if (!item.sheetSnapshot) {
      if (signature === priceListItemSignature(item)) {
        await markSheetSynced(item, item.sheetRow, signature);
      } else {
        const input = sheetValuesToPriceListInput(values, base);
        const imported = await applySheetImport(item, input, signature);
        if (imported) result.imported.push(imported);
      }
      continue;
    }

    const sheetChanged = signature !== item.sheetSnapshot;
    const webChanged = priceListItemSignature(item) !== item.sheetSnapshot;

    if (!sheetChanged && !webChanged) continue;

    if (sheetChanged && webChanged) {
      result.conflicts.push({
        item,
        sheetInput: sheetValuesToPriceListInput(values, base),
        sheetSignature: signature,
      });
      continue;
    }

    if (sheetChanged) {
      const input = sheetValuesToPriceListInput(values, base);
      const imported = await applySheetImport(item, input, signature);
      if (imported) result.imported.push(imported);
      continue;
    }

    // Solo cambio la web: la planilla quedo atras, se reescribe.
    await pushItemToSheet(item);
  }

  return result;
}

/** Alta de un vehiculo que aparecio a mano en la planilla. */
async function insertImportedItem(input: PriceListItemInput, signature: string) {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from(PRICE_LIST_TABLE)
      .insert({ ...itemPayload(input), sheet_snapshot: signature })
      .select("*")
      .single();

    if (error || !data) return null;
    return mapDbItem(data as DbPriceListItem);
  } catch {
    return null;
  }
}

/** El usuario eligio que gane la planilla en un conflicto. */
export async function resolveConflictWithSheet(conflict: SheetConflict) {
  const item = await applySheetImport(conflict.item, conflict.sheetInput, conflict.sheetSignature);
  return item ?? conflict.item;
}

/** El usuario eligio que gane la web: se reescribe la fila de la planilla. */
export async function resolveConflictWithWeb(conflict: SheetConflict) {
  const { item } = await pushItemToSheet(conflict.item);
  return item;
}
