import type { PriceListItemInput } from "@/types/priceList";

const SHEETS_SYNC_URL = "/api/sheets-sync";

export type SheetSyncAction = "update" | "append" | "clear";

export type SheetSyncResult = {
  ok: boolean;
  /** true cuando el endpoint existe pero todavia no hay credenciales de Google. */
  skipped?: boolean;
  sheetRow?: number | null;
  error?: string;
};

type SheetSyncPayload = {
  action: SheetSyncAction;
  sheetRow?: number | null;
  item?: PriceListItemInput;
};

/**
 * Refleja en la planilla de Google el cambio que ya se guardo en Supabase.
 * Nunca lanza: si Google falla, Supabase igual quedo actualizado y la pagina
 * avisa que la planilla quedo desincronizada.
 */
export async function syncToSheet(payload: SheetSyncPayload): Promise<SheetSyncResult> {
  try {
    const response = await fetch(SHEETS_SYNC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as SheetSyncResult | null;
    if (!body) {
      return { ok: false, error: `La planilla respondio ${response.status}.` };
    }

    return body;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo contactar la planilla.",
    };
  }
}
