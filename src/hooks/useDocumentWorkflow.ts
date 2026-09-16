import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getWorkflowContext, saveClientDocument } from "@/services/clientsService";
import type { Client, ClientDocument, ClientOperation, DocumentType } from "@/types/clients";
import { getVehicleById, listVehicles } from "@/services/vehiclesService";
import type { Vehicle } from "@/types/vehicles";

export function prefillClientData(client: Client | null, operation: ClientOperation | null, vehicle: Vehicle | null) {
  const data = (operation?.data ?? {}) as Record<string, unknown>;
  return { nombre: client?.nombre ?? "", dni: client?.dni ?? "", telefono: client?.telefono || client?.celular || "", email: client?.email ?? "", domicilio: client?.domicilio ?? "", localidad: client?.localidad ?? "", provincia: client?.provincia ?? "", dominio: vehicle?.licensePlate || String(data.dominio ?? ""), vehiculo: vehicle ? `${vehicle.brand} ${vehicle.model}`.trim() : "", vehiculoMarca: vehicle?.brand ?? "", vehiculoModelo: vehicle?.model ?? "", vehiculoAnio: vehicle?.year ? String(vehicle.year) : "", vehiculoKm: vehicle?.kilometers ? String(vehicle.kilometers) : "", fechaOperacion: String(data.fechaOperacion ?? ""), usadoDominio: String(data.ppaDominio ?? ""), usadoMarca: String(data.ppaMarca ?? ""), usadoModelo: String(data.ppaModelo ?? ""), usadoAnio: String(data.ppaAnio ?? "") };
}

export function useDocumentWorkflow(type: DocumentType) {
  const [params] = useSearchParams();
  const dni = params.get("dni") ?? "";
  const clientId = params.get("clientId") ?? "";
  const operationId = params.get("operationId") ?? "";
  const vehicleId = params.get("vehicleId") ?? "";
  const documentId = params.get("documentId") ?? "";
  const contextKey = `${clientId}:${operationId}:${vehicleId}:${documentId}:${dni}:${type}`;
  const [client, setClient] = useState<Client | null>(null);
  const [operation, setOperation] = useState<ClientOperation | null>(null);
  const [saved, setSaved] = useState<ClientDocument | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(Boolean(clientId || operationId || dni));
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"remote" | "offline" | null>(null);

  useEffect(() => {
    let active = true;
    if (!dni && !clientId && !operationId && !vehicleId) return undefined;
    const contextPromise = dni || clientId || operationId ? getWorkflowContext({ dni, clientId, operationId }) : Promise.resolve({ client: null, operation: null, documents: [] });
    Promise.all([contextPromise, vehicleId ? getVehicleById(vehicleId) : Promise.resolve(null)]).then(async ([context, directVehicle]) => {
      if (!active) return;
      let resolvedVehicle = directVehicle;
      if (!resolvedVehicle && context.operation?.vehicleId) resolvedVehicle = await getVehicleById(context.operation.vehicleId);
      if (!resolvedVehicle) {
        const domain = String((context.operation?.data as Record<string, unknown> | undefined)?.dominio ?? "").toUpperCase();
        if (domain) resolvedVehicle = (await listVehicles()).find((item) => item.licensePlate.toUpperCase() === domain) ?? null;
      }
      if (!active) return;
      setClient(context.client); setOperation(context.operation); setVehicle(resolvedVehicle);
      const document = documentId ? context.documents.find((item) => item.id === documentId) : null;
      setSaved(document ?? null); setLoading(false);
    }).catch((reason: unknown) => { if (!active) return; setError(reason instanceof Error ? reason.message : "No se pudo cargar el contexto"); setLoading(false); });
    return () => { active = false; };
  }, [contextKey, clientId, dni, documentId, operationId, vehicleId]);

  const save = useCallback(async (data: Record<string, unknown>, status: "borrador" | "generado" = "borrador", id?: string, options?: { newDocument?: boolean }) => {
    if (!client || !operation) { setError("Elegí un cliente y una operación antes de guardar."); return null; }
    try { const result = await saveClientDocument({ id: options?.newDocument ? undefined : id ?? (documentId ? saved?.id : undefined), clientId: client.id, operationId: operation.id, documentType: type, status, data }); setSaved(result.document); setMode(result.persistenceMode); setError(result.warning ?? null); return result; }
    catch (reason: unknown) { const message = reason instanceof Error ? reason.message : "No se pudo guardar el documento"; setError(message); return null; }
  }, [client, operation, saved, type, documentId]);

  const prefill = useMemo(() => prefillClientData(client, operation, vehicle), [client, operation, vehicle]);
  return { client, operation, vehicle, saved, loading, error, mode, hasContext: Boolean(client && operation), prefill, save };
}
