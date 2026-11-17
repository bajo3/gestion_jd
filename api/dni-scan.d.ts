export function sanitizeDni(input: unknown): Record<string, unknown>;

export function scanDni(payload: unknown): Promise<{
  ok: boolean;
  model?: string;
  dni?: Record<string, unknown>;
  error?: string;
}>;
