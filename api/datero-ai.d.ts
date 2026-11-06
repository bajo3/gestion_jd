export function sanitizeOperation(input: unknown): Record<string, unknown>;

export function completeDatero(payload: unknown): Promise<{
  ok: boolean;
  model?: string;
  operation?: Record<string, unknown>;
  error?: string;
}>;
