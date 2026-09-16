export function runWorkspaceAssistant(payload: unknown): Promise<{
  ok: boolean;
  model?: string;
  reply?: string;
  actionType?: string;
  routeKey?: string;
  path?: string;
  documentType?: string;
  title?: string;
  values?: Record<string, unknown>;
  missing?: string[];
  error?: string;
}>;
