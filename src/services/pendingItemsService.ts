import { readStorage, writeStorage } from "@/lib/storage";
import { generateId } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { PendingItem, PendingItemInput } from "@/types/pendingItems";

const STORAGE_KEY = "gestion-jd-pendientes";
const PENDING_ITEMS_TABLE = "gestion_jd_pendientes";
const APP_SOURCE = "gestion_jd";

type DbPendingItem = {
  id: string;
  app_source: string;
  title: string;
  details?: string | null;
  style_index?: number | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
};

function readLocalItems() {
  const stored = readStorage<PendingItem[]>(STORAGE_KEY, []);
  return Array.isArray(stored) ? stored : [];
}

function saveLocalItems(items: PendingItem[]) {
  writeStorage(STORAGE_KEY, items);
}

function mapDbItem(item: DbPendingItem): PendingItem {
  return {
    id: item.id,
    title: item.title,
    details: item.details ?? "",
    styleIndex: Number.isInteger(item.style_index) ? Math.abs(item.style_index ?? 0) : 0,
    createdAt: item.created_at,
    completedAt: item.completed_at ?? null,
  };
}

function itemPayload(item: PendingItem) {
  return {
    id: item.id,
    app_source: APP_SOURCE,
    title: item.title,
    details: item.details || null,
    style_index: item.styleIndex,
    completed_at: item.completedAt,
    created_at: item.createdAt,
    updated_at: new Date().toISOString(),
  };
}

function sortItems(items: PendingItem[]) {
  return [...items].sort((a, b) => {
    if (Boolean(a.completedAt) !== Boolean(b.completedAt)) return a.completedAt ? 1 : -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

async function fetchRemoteItems(): Promise<PendingItem[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from(PENDING_ITEMS_TABLE)
      .select("*")
      .eq("app_source", APP_SOURCE)
      .order("completed_at", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: false });

    if (error || !data) return null;
    return (data as DbPendingItem[]).map(mapDbItem);
  } catch {
    return null;
  }
}

async function insertRemoteItem(item: PendingItem) {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from(PENDING_ITEMS_TABLE)
      .insert(itemPayload(item))
      .select("*")
      .single();

    if (error || !data) return null;
    return mapDbItem(data as DbPendingItem);
  } catch {
    return null;
  }
}

async function updateRemoteItem(item: PendingItem) {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from(PENDING_ITEMS_TABLE)
      .update({
        title: item.title,
        details: item.details || null,
        style_index: item.styleIndex,
        completed_at: item.completedAt,
      })
      .eq("id", item.id)
      .eq("app_source", APP_SOURCE)
      .select("*")
      .single();

    if (error || !data) return null;
    return mapDbItem(data as DbPendingItem);
  } catch {
    return null;
  }
}

/**
 * Loads Supabase data and imports any notes created before remote persistence
 * was enabled, so the first migration does not discard local notes.
 */
export async function listPendingItems() {
  const localItems = readLocalItems();
  const remoteItems = await fetchRemoteItems();

  if (remoteItems === null) return sortItems(localItems);

  const remoteIds = new Set(remoteItems.map((item) => item.id));
  const localOnlyItems = localItems.filter((item) => !remoteIds.has(item.id));
  const importedItems: PendingItem[] = [];

  for (const item of localOnlyItems) {
    const imported = await insertRemoteItem(item);
    if (imported) importedItems.push(imported);
  }

  const nextItems = sortItems([...remoteItems, ...importedItems]);
  saveLocalItems(nextItems);
  return nextItems;
}

export async function createPendingItem(input: PendingItemInput) {
  const localItem: PendingItem = {
    id: generateId(),
    title: input.title,
    details: input.details,
    styleIndex: input.styleIndex,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  const localItems = readLocalItems().filter((item) => item.id !== localItem.id);
  saveLocalItems(sortItems([localItem, ...localItems]));

  const remoteItem = await insertRemoteItem(localItem);
  if (!remoteItem) return { item: localItem, persisted: false };

  const nextItems = readLocalItems().map((item) => (item.id === localItem.id ? remoteItem : item));
  saveLocalItems(sortItems(nextItems));
  return { item: remoteItem, persisted: true };
}

export async function setPendingItemCompleted(id: string, completedAt: string | null) {
  const current = readLocalItems().find((item) => item.id === id);
  if (!current) return { item: null, persisted: false };

  const localItem = { ...current, completedAt };
  saveLocalItems(sortItems(readLocalItems().map((item) => (item.id === id ? localItem : item))));

  const remoteItem = await updateRemoteItem(localItem);
  if (!remoteItem) return { item: localItem, persisted: false };

  const nextItems = readLocalItems().map((item) => (item.id === id ? remoteItem : item));
  saveLocalItems(sortItems(nextItems));
  return { item: remoteItem, persisted: true };
}
