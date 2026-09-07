import { readStorage, writeStorage } from "@/lib/storage";
import { generateId } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { PriceCurrency, PriceListItem, PriceListItemInput } from "@/types/priceList";

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

export async function createPriceListItem(input: PriceListItemInput) {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from(PRICE_LIST_TABLE)
        .insert(itemPayload(input))
        .select("*")
        .single();

      if (!error && data) {
        const item = mapDbItem(data as DbPriceListItem);
        saveLocalItems([...readLocalItems(), item]);
        return { item, persisted: true };
      }
    } catch {
      // Cae al guardado local.
    }
  }

  const now = new Date().toISOString();
  const item: PriceListItem = { ...input, id: generateId(), createdAt: now, updatedAt: now };
  saveLocalItems([...readLocalItems(), item]);
  return { item, persisted: false };
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
        const item = mapDbItem(data as DbPriceListItem);
        saveLocalItems(readLocalItems().map((current) => (current.id === id ? item : current)));
        return { item, persisted: true };
      }
    } catch {
      // Cae al guardado local.
    }
  }

  const current = readLocalItems().find((item) => item.id === id);
  const item: PriceListItem = {
    ...input,
    id,
    createdAt: current?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveLocalItems(readLocalItems().map((entry) => (entry.id === id ? item : entry)));
  return { item, persisted: false };
}

export async function deletePriceListItem(id: string) {
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
  return { persisted };
}
