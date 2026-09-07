const SHEETS_SYNC_URL = "/api/sheets-sync";

export type SheetSyncAction = "read" | "update" | "append" | "clear";

export type SheetSyncResult = {
  ok: boolean;
  /** true cuando el endpoint existe pero todavia no hay credenciales de Google. */
  skipped?: boolean;
  sheetRow?: number | null;
  /** Solo en "read": la planilla entera, sin normalizar. */
  rows?: string[][];
  error?: string;
};

type SheetSyncPayload = {
  action: SheetSyncAction;
  sheetRow?: number | null;
  /** Fila ya formateada por el cliente (columnas A..L). */
  values?: string[];
};

/**
 * Habla con la planilla de Google. Nunca lanza: si Google falla, Supabase ya
 * quedo actualizado y la pagina avisa que la planilla quedo desincronizada.
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
