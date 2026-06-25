export function parseAssistantWithGlm(payload: unknown): Promise<{
  ok: boolean;
  model?: string;
  values?: Record<string, unknown>;
  targetVehicleId?: string;
  notes?: string[];
  assistantText?: string;
  error?: string;
}>;
