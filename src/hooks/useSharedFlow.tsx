import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fillEmpty, fromShared, nextDocumentLinks, resolveShared, type SharedDocType } from "@/lib/sharedData";
import { getWorkflowContext, saveClientDocument } from "@/services/clientsService";
import { commitSharedData } from "@/services/sharedDataService";
import { clearWorkingData, readWorkingData, type WorkingData } from "@/services/workingData";
import { getVehicleById } from "@/services/vehiclesService";
import type { SaleSyncLink } from "@/services/saleSyncService";
import type { Client, ClientDocument, ClientOperation } from "@/types/clients";
import type { Vehicle } from "@/types/vehicles";
import type { useDocumentWorkflow } from "@/hooks/useDocumentWorkflow";

type Workflow = ReturnType<typeof useDocumentWorkflow>;

export type FlowCommit = {
  messages: string[];
  warnings: string[];
  links: SaleSyncLink[];
  document: ClientDocument | null;
  clientId?: string;
  operationId?: string;
};

type Adopted = { client: Client; operation: ClientOperation; vehicle: Vehicle | null };

function minutesAgo(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  return `hace ${Math.round(minutes / 60)} h`;
}

/**
 * Hace que los documentos se llenen entre si.
 *
 * - Al abrir un documento con cliente / operacion / auto, completa lo que este vacio con lo que
 *   ya cargaron los otros documentos.
 * - Sin cliente abierto, ofrece seguir con la ultima operacion en la que se trabajo.
 * - Al generar, `commit` suma lo cargado a la operacion y al cliente (creandolos si falta) y
 *   deja los links para seguir con el siguiente documento con los mismos datos.
 */
export function useSharedFlow<T extends Record<string, unknown>>(
  docType: SharedDocType,
  workflow: Workflow,
  values: T,
  replace: (next: T) => void,
) {
  const [params] = useSearchParams();
  const [adopted, setAdopted] = useState<Adopted | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [working, setWorking] = useState<WorkingData | null>(() => readWorkingData());
  const applied = useRef("");
  const valuesRef = useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  });

  const client = adopted?.client ?? workflow.client;
  const operation = adopted?.operation ?? workflow.operation;
  const vehicle = workflow.vehicle ?? adopted?.vehicle ?? null;
  const saved = workflow.saved;

  useEffect(() => {
    // Un documento ya guardado se abre tal cual se guardo.
    if (saved) return;
    if (!client && !operation && !vehicle) return;

    const key = [client?.id, operation?.id, operation?.updatedAt, vehicle?.id].join("|");
    if (applied.current === key) return;
    applied.current = key;

    const shared = resolveShared({ client, operation, vehicle });
    replace(fillEmpty(valuesRef.current, fromShared(docType, shared)));
  }, [client, operation, vehicle, saved, docType, replace]);

  const adoptWorking = useCallback(async () => {
    if (!working) return;
    setDismissed(true);

    if (working.clientId && working.operationId) {
      const context = await getWorkflowContext({ clientId: working.clientId, operationId: working.operationId });
      if (context.client && context.operation) {
        const workingVehicle = working.vehicleId ? await getVehicleById(working.vehicleId) : null;
        setAdopted({ client: context.client, operation: context.operation, vehicle: workingVehicle });
        return;
      }
    }

    replace(fillEmpty(valuesRef.current, fromShared(docType, working.shared)));
  }, [working, docType, replace]);

  const discardWorking = useCallback(() => {
    clearWorkingData();
    setWorking(null);
    setDismissed(true);
  }, []);

  const banner: ReactNode =
    !client && !operation && !dismissed && working ? (
      <div className="flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
          <div>
            <p className="font-semibold">Seguir con {working.label}</p>
            <p className="text-sky-800">Cargado {minutesAgo(working.at)}. Completa este documento con esos datos.</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button onClick={() => void adoptWorking()}>Usar estos datos</Button>
          <Button variant="outline" onClick={discardWorking}>
            Empezar de cero
          </Button>
        </div>
      </div>
    ) : null;

  const commit = useCallback(
    async (
      current: T,
      options: { documentId?: string | null; newDocument?: boolean; status?: "borrador" | "generado" } = {},
    ): Promise<FlowCommit> => {
      const result = await commitSharedData({
        docType,
        values: current,
        context: { client, operation, vehicle },
        vehicleId: params.get("vehicleId") ?? undefined,
      });

      if (!result) {
        return {
          messages: [],
          warnings: [
            "No se guardó en una operación porque faltan el nombre y el DNI del cliente. El PDF se genera igual y lo cargado queda disponible para el próximo documento.",
          ],
          links: [],
          document: null,
        };
      }

      if (result.created || !client || !operation) {
        setAdopted({ client: result.client, operation: result.operation, vehicle });
      }

      const document = await saveClientDocument({
        id: options.newDocument ? undefined : (options.documentId ?? saved?.id ?? undefined),
        clientId: result.clientId,
        operationId: result.operationId,
        documentType: docType,
        status: options.status ?? "generado",
        data: current,
      });

      const vehicleId = result.operation.vehicleId ?? vehicle?.id;

      return {
        messages: [
          result.created
            ? `Se creó el cliente ${result.client.nombre} y se guardó su operación.`
            : `Datos guardados en la operación de ${result.client.nombre}.`,
          "Los demás documentos se completan solos con estos datos.",
        ],
        warnings: [result.warning, document.warning].filter((warning): warning is string => Boolean(warning)),
        links: nextDocumentLinks(docType, { clientId: result.clientId, operationId: result.operationId, vehicleId }),
        document: document.document,
        clientId: result.clientId,
        operationId: result.operationId,
      };
    },
    [docType, client, operation, vehicle, params, saved?.id],
  );

  return { client, operation, vehicle, banner, commit };
}
