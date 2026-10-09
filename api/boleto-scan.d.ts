export function sanitizeExtraction(input: unknown): Record<string, unknown>;

export function scanBoleto(payload: unknown): Promise<{
  ok: boolean;
  model?: string;
  extraction?: Record<string, unknown>;
  error?: string;
}>;
