export function isSheetsSyncConfigured(): boolean;

export function syncPriceListToSheet(payload: unknown): Promise<{
  ok: boolean;
  skipped?: boolean;
  action?: string;
  sheetRow?: number | null;
  rows?: string[][];
  error?: string;
}>;
