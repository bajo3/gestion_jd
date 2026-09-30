import {
  fromShared,
  IDENTITY_KEYS,
  resolveShared,
  scratchExtras,
  toShared,
  type SharedData,
  type SharedDocType,
} from "@/lib/sharedData";
import { emptyDatero } from "@/services/saleSyncService";
import { rememberWorkingData } from "@/services/workingData";
import { getWorkflowContext, normalizeDni, saveDateroWorkflow } from "@/services/clientsService";
import type { Client, ClientOperation } from "@/types/clients";
import type { DateroFormValues } from "@/types/forms";
import type { Vehicle } from "@/types/vehicles";

export type CommitContext = {
  client?: Client | null;
  operation?: ClientOperation | null;
  vehicle?: Vehicle | null;
};

export type CommitResult = {
  clientId: string;
  operationId: string;
  client: Client;
  operation: ClientOperation;
  created: boolean;
  persistenceMode: "remote" | "offline";
  warning?: string;
};

/**
 * Suma lo que cargo un documento a la operacion y al cliente, para que el resto lo reciba.
 *
 * - Con cliente y operacion abiertos, los actualiza sin pisar lo que ya tenian.
 * - Sin contexto, si el documento trae nombre y DNI, busca al cliente (o lo crea) y
 *   retoma su operacion abierta o abre una nueva.
 * - Sin DNI no se puede crear un cliente: los datos quedan solo en la memoria de trabajo.
 */
export async function commitSharedData(input: {
  docType: SharedDocType;
  values: Record<string, unknown>;
  context: CommitContext;
  vehicleId?: string;
}): Promise<CommitResult | null> {
  const patch = toShared(input.docType, input.values);
  let { client, operation } = input.context;
  const vehicle = input.context.vehicle ?? null;
  let created = false;

  if (!client || !operation) {
    if (!normalizeDni(patch.dni ?? "") || !patch.nombre) {
      rememberWorkingData({ shared: { ...scratchExtras(input.docType, input.values), ...patch }, vehicleId: input.vehicleId ?? vehicle?.id });
      return null;
    }

    // Puede que el cliente ya exista (misma persona, otro documento): se retoma su operacion abierta.
    const existing = await getWorkflowContext({ dni: patch.dni });
    client = existing.client;
    operation = existing.operation && existing.operation.status === "borrador" ? existing.operation : null;
    created = !client || !operation;
  }

  const current = resolveShared({ client, operation, vehicle });
  const sameClient = !client || normalizeDni(patch.dni ?? client.dni) === normalizeDni(client.dni);

  // Otra persona en el documento (DNI distinto): no se toca al cliente, solo el auto y la operacion.
  const safePatch: SharedData = { ...patch };
  if (!sameClient) for (const key of IDENTITY_KEYS) delete safePatch[key];

  const merged: SharedData = { ...current, ...safePatch };
  const flat = { ...((operation?.data ?? {}) as Record<string, unknown>) };
  delete flat.shared;

  const dateroValues = {
    ...emptyDatero,
    ...((client?.data ?? {}) as Partial<DateroFormValues>),
    ...(flat as Partial<DateroFormValues>),
    ...(Object.fromEntries(
      Object.entries(fromShared("datero", merged)).filter(([, value]) => value !== undefined && value !== ""),
    ) as Partial<DateroFormValues>),
  } satisfies DateroFormValues;

  const saved = await saveDateroWorkflow(dateroValues, {
    operationId: operation?.id,
    vehicleId: operation?.vehicleId ?? input.vehicleId ?? vehicle?.id,
    createNewOperation: created && !operation,
    shared: safePatch,
  });

  rememberWorkingData({
    clientId: saved.client.id,
    operationId: saved.operation.id,
    vehicleId: saved.operation.vehicleId ?? input.vehicleId ?? vehicle?.id,
    shared: { ...merged },
  });

  return {
    clientId: saved.client.id,
    operationId: saved.operation.id,
    client: saved.client,
    operation: saved.operation,
    created,
    persistenceMode: saved.persistenceMode,
    warning: saved.warning,
  };
}
