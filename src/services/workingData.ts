import { readStorage, writeStorage } from "@/lib/storage";
import { hasUsefulData, type SharedData } from "@/lib/sharedData";

const WORKING_KEY = "gestion-jd-working-data";
const WORKING_TTL_MS = 6 * 60 * 60 * 1000;

/** Ultima operacion en la que se trabajo: sirve para ofrecer "seguir con estos datos" en el siguiente documento. */
export type WorkingData = {
  clientId?: string;
  operationId?: string;
  vehicleId?: string;
  shared: SharedData;
  label: string;
  at: string;
};

export function readWorkingData(): WorkingData | null {
  const stored = readStorage<WorkingData | null>(WORKING_KEY, null);
  if (!stored?.shared || !stored.at) return null;
  if (Date.now() - new Date(stored.at).getTime() > WORKING_TTL_MS) return null;
  return stored;
}

export function clearWorkingData() {
  writeStorage(WORKING_KEY, null);
}

export function rememberWorkingData(input: Omit<WorkingData, "at" | "label">) {
  if (!hasUsefulData(input.shared)) return;
  const previous = readWorkingData();
  // Si sigue siendo la misma operacion, se suma; si es otra, arranca de cero.
  const sameOperation = previous && input.operationId && previous.operationId === input.operationId;
  const sameScratch = previous && !previous.operationId && !input.operationId;
  const shared = sameOperation || sameScratch ? { ...previous.shared, ...input.shared } : input.shared;
  const vehicle = [shared.marca, shared.modelo].filter(Boolean).join(" ") || shared.vehiculo || shared.dominio || "";
  const label = [shared.nombre, vehicle].filter(Boolean).join(" · ") || "Operación en curso";
  writeStorage(WORKING_KEY, { ...input, shared, label, at: new Date().toISOString() } satisfies WorkingData);
}
