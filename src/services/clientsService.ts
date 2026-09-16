import { readStorage, writeStorage } from "@/lib/storage";
import { generateId } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import { getVehicleById, listVehicles } from "@/services/vehiclesService";
import { syncCommercialAlertsForVehicle } from "@/services/commercialAlertsService";
import type { Client, ClientDocument, ClientOperation, DocumentType, FinalizedSale } from "@/types/clients";
import type { DateroFormValues } from "@/types/forms";

const CLIENTS_KEY = "gestion-jd-clients";
const OPERATIONS_KEY = "gestion-jd-client-operations";
const DOCUMENTS_KEY = "gestion-jd-client-documents";
const APP_SOURCE = "gestion_jd";

export function normalizeDni(value: string) {
  return value.trim().replace(/\D/g, "");
}

function localClients() { return readStorage<Client[]>(CLIENTS_KEY, []); }
function localOperations() { return readStorage<ClientOperation[]>(OPERATIONS_KEY, []); }
function localDocuments() { return readStorage<ClientDocument[]>(DOCUMENTS_KEY, []); }

function clientFromDatero(values: DateroFormValues, existing?: Client): Client {
  const now = new Date().toISOString();
  return {
    id: existing?.id ?? generateId(),
    dni: values.dni,
    dniNormalized: normalizeDni(values.dni),
    nombre: values.nombre,
    telefono: values.telefono,
    celular: values.celular,
    email: values.email,
    domicilio: values.direccionReal || values.direccionDni,
    localidad: values.localidad,
    provincia: values.provincia,
    cuil: values.cuil,
    estadoCivil: values.estadoCivil,
    condicionFiscal: values.condicionFiscal,
    fechaNacimiento: values.fechaNacimiento,
    data: { ...values },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

async function remoteUpsertClient(client: Client) {
  if (!isSupabaseConfigured || !supabase) return client;
  const payload = {
    app_source: APP_SOURCE,
    dni: client.dni,
    dni_normalized: client.dniNormalized,
    nombre: client.nombre,
    telefono: client.telefono,
    celular: client.celular,
    email: client.email,
    domicilio: client.domicilio,
    localidad: client.localidad,
    provincia: client.provincia,
    cuil: client.cuil,
    estado_civil: client.estadoCivil,
    condicion_fiscal: client.condicionFiscal,
    fecha_nacimiento: client.fechaNacimiento || null,
    data: client.data,
    created_at: client.createdAt,
    updated_at: client.updatedAt,
  };
  const { data: existing } = await supabase.from("gestion_jd_clients").select("id").eq("app_source", APP_SOURCE).eq("dni_normalized", client.dniNormalized).maybeSingle();
  if (existing?.id) {
    const { error } = await supabase.from("gestion_jd_clients").update(payload).eq("id", existing.id).eq("app_source", APP_SOURCE);
    if (error) throw new Error(`No se pudo actualizar el cliente: ${error.message}`);
    return { ...client, id: String(existing.id) };
  }
  const { error } = await supabase.from("gestion_jd_clients").insert({ id: client.id, ...payload });
  if (error) throw new Error(`No se pudo guardar el cliente: ${error.message}`);
  return client;
}

export async function saveDateroWorkflow(values: DateroFormValues, options: { operationId?: string; vehicleId?: string; createNewOperation?: boolean } = {}) {
  const operationId = options.operationId;
  const dniNormalized = normalizeDni(values.dni);
  if (!dniNormalized) throw new Error("El DNI es necesario para guardar el cliente.");
  let remoteExisting: Client | undefined;
  let lookupWarning: string | undefined;
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("gestion_jd_clients").select("*").eq("app_source", APP_SOURCE).eq("dni_normalized", dniNormalized).maybeSingle();
    if (error) lookupWarning = `No se pudo consultar el cliente en Supabase: ${error.message}`;
    if (data) remoteExisting = mapRemoteClient(data);
  }
  const existing = remoteExisting ?? localClients().find((item) => item.dniNormalized === dniNormalized);
  const client = clientFromDatero(values, existing);
  const clients = [...localClients().filter((item) => item.dniNormalized !== dniNormalized), client];
  writeStorage(CLIENTS_KEY, clients);

  const now = new Date().toISOString();
  let existingOperation = options.createNewOperation ? undefined : operationId ? localOperations().find((item) => item.id === operationId && item.clientId === client.id) : undefined;
  if (operationId && !options.createNewOperation && isSupabaseConfigured && supabase && !existingOperation) {
    const { data } = await supabase.from("gestion_jd_operations").select("*").eq("app_source", APP_SOURCE).eq("id", operationId).eq("client_id", client.id).maybeSingle();
    if (data) existingOperation = mapRemoteOperation(data);
  }
  const operation: ClientOperation = {
    id: options.createNewOperation ? generateId() : existingOperation?.id ?? operationId ?? generateId(),
    clientId: client.id,
    vehicleId: existingOperation?.vehicleId ?? options.vehicleId ?? null,
    status: existingOperation?.status ?? "borrador",
    fecha: values.fechaOperacion || now.slice(0, 10),
    data: { ...values },
    createdAt: existingOperation?.createdAt ?? now,
    updatedAt: now,
  };
  const operations = [...localOperations().filter((item) => item.id !== operation.id), operation];
  writeStorage(OPERATIONS_KEY, operations);

  let persistenceMode: "remote" | "offline" = "offline";
  let warning: string | undefined = lookupWarning;
  if (isSupabaseConfigured && supabase) {
    try {
      const canonicalClient = await remoteUpsertClient(client);
      if (canonicalClient.id !== client.id) {
        client.id = canonicalClient.id;
        operation.clientId = canonicalClient.id;
        writeStorage(CLIENTS_KEY, [...localClients().filter((item) => item.id !== client.id), canonicalClient]);
        writeStorage(OPERATIONS_KEY, localOperations().map((item) => item.id === operation.id ? operation : item));
      }
      const { error } = await supabase.from("gestion_jd_operations").upsert({
        id: operation.id,
        app_source: APP_SOURCE,
        client_id: operation.clientId,
        vehicle_id: operation.vehicleId,
        status: operation.status,
        fecha: operation.fecha || null,
        data: operation.data,
        created_at: operation.createdAt,
        updated_at: operation.updatedAt,
      });
      if (error) throw new Error(`No se pudo guardar la operación: ${error.message}`);
      persistenceMode = "remote";
    } catch (error) {
      warning = error instanceof Error ? error.message : "Supabase no disponible; se guardó como borrador offline.";
    }
  }
  return { client, operation, persistenceMode, warning };
}

export async function saveClientDocument(input: Omit<ClientDocument, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  const now = new Date().toISOString();
  const existing = input.id ? localDocuments().find((item) => item.id === input.id && item.clientId === input.clientId && item.operationId === input.operationId) : undefined;
  let remoteExisting = false;
  if (input.id && isSupabaseConfigured && supabase) {
    const { data } = await supabase.from("gestion_jd_documents").select("id").eq("id", input.id).eq("app_source", APP_SOURCE).maybeSingle();
    remoteExisting = Boolean(data);
  }
  const document: ClientDocument = { ...input, id: existing?.id ?? input.id ?? generateId(), createdAt: existing?.createdAt ?? now, updatedAt: now };
  writeStorage(DOCUMENTS_KEY, existing ? localDocuments().map((item) => item.id === existing.id ? document : item) : [...localDocuments(), document]);
  let warning: string | undefined;
  let persistenceMode: "remote" | "offline" = "offline";
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = existing || remoteExisting
        ? await supabase.from("gestion_jd_documents").update({ status: document.status, data: document.data, updated_at: document.updatedAt }).eq("id", document.id).eq("app_source", APP_SOURCE)
        : await supabase.from("gestion_jd_documents").insert({
        id: document.id, app_source: APP_SOURCE, client_id: document.clientId, operation_id: document.operationId,
        document_type: document.documentType, status: document.status, data: document.data,
        created_at: document.createdAt, updated_at: document.updatedAt,
      });
      if (error) throw new Error(`No se pudo guardar el documento: ${error.message}`);
      persistenceMode = "remote";
    } catch (error) { warning = error instanceof Error ? error.message : "Supabase no disponible; documento offline."; }
  }
  return { document, persistenceMode, warning };
}

function mapRemoteClient(row: Record<string, unknown>): Client {
  return {
    id: String(row.id), dni: String(row.dni ?? ""), dniNormalized: String(row.dni_normalized ?? ""), nombre: String(row.nombre ?? ""),
    telefono: String(row.telefono ?? ""), celular: String(row.celular ?? ""), email: String(row.email ?? ""), domicilio: String(row.domicilio ?? ""),
    localidad: String(row.localidad ?? ""), provincia: String(row.provincia ?? ""), cuil: String(row.cuil ?? ""), estadoCivil: String(row.estado_civil ?? ""),
    condicionFiscal: String(row.condicion_fiscal ?? ""), fechaNacimiento: String(row.fecha_nacimiento ?? ""), data: (row.data as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at ?? new Date().toISOString()), updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function mapRemoteOperation(row: Record<string, unknown>): ClientOperation {
  return { id: String(row.id), clientId: String(row.client_id), vehicleId: row.vehicle_id ? String(row.vehicle_id) : null, status: (row.status as ClientOperation["status"]) ?? "borrador", fecha: String(row.fecha ?? ""), data: (row.data as Record<string, unknown>) ?? {}, createdAt: String(row.created_at ?? ""), updatedAt: String(row.updated_at ?? "") };
}

function mapRemoteDocument(row: Record<string, unknown>): ClientDocument {
  return { id: String(row.id), clientId: String(row.client_id), operationId: String(row.operation_id), documentType: row.document_type as DocumentType, status: (row.status as ClientDocument["status"]) ?? "borrador", data: (row.data as Record<string, unknown>) ?? {}, createdAt: String(row.created_at ?? ""), updatedAt: String(row.updated_at ?? "") };
}

export async function listClients() {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("gestion_jd_clients").select("*").eq("app_source", APP_SOURCE).order("updated_at", { ascending: false });
    if (!error && data) {
      const clients = data.map((row) => mapRemoteClient(row));
      writeStorage(CLIENTS_KEY, clients);
      return clients;
    }
  }
  return listLocalClients();
}

export async function finalizeSaleAtomic(input: {
  operationId: string;
  vehicleId: string;
  salePrice: number;
  buyerName: string;
  buyerPhone: string;
  hasCredit: boolean;
  saleDate: string;
  creditStartDate?: string;
  creditInstallmentsText?: string;
  creditTotalInstallments?: number | null;
  creditDueDay?: number | null;
}) {
  if (!isSupabaseConfigured || !supabase) return { mode: "offline" as const };
  const { error } = await supabase.rpc("gestion_jd_finalize_sale", {
    p_operation_id: input.operationId,
    p_vehicle_id: input.vehicleId,
    p_sale_price: input.salePrice,
    p_buyer_name: input.buyerName,
    p_buyer_phone: input.buyerPhone,
    p_has_credit: input.hasCredit,
    p_sale_date: input.saleDate || null,
    p_credit_start_date: input.creditStartDate || null,
    p_credit_installments_text: input.creditInstallmentsText || null,
    p_credit_total_installments: input.creditTotalInstallments ?? null,
    p_credit_due_day: input.creditDueDay ?? null,
  });
  if (error) throw new Error(`No se pudo finalizar la venta: ${error.message}`);
  const updatedVehicle = await getVehicleById(input.vehicleId);
  if (updatedVehicle) await syncCommercialAlertsForVehicle(updatedVehicle);
  return { mode: "remote" as const };
}

export function markLocalOperationFinalized(operationId: string, vehicleId: string) {
  const now = new Date().toISOString();
  const next = localOperations().map((operation) => operation.id === operationId ? { ...operation, vehicleId, status: "finalizada" as const, updatedAt: now } : operation);
  writeStorage(OPERATIONS_KEY, next);
}

export async function getWorkflowContext(params: { dni?: string; clientId?: string; operationId?: string }) {
  const clients = localClients();
  const operations = localOperations();
  let client = params.clientId
    ? clients.find((item) => item.id === params.clientId)
    : clients.find((item) => item.dniNormalized === normalizeDni(params.dni ?? ""));
  let operation = params.operationId
    ? operations.find((item) => item.id === params.operationId)
    : operations.filter((item) => item.clientId === client?.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (isSupabaseConfigured && supabase) {
    let clientQuery = supabase.from("gestion_jd_clients").select("*").eq("app_source", APP_SOURCE).limit(1);
    if (params.clientId) clientQuery = clientQuery.eq("id", params.clientId); else if (params.dni) clientQuery = clientQuery.eq("dni_normalized", normalizeDni(params.dni));
    const { data: remoteClients } = await clientQuery;
    if (remoteClients?.[0]) client = mapRemoteClient(remoteClients[0]);
    if (client) {
      let operationQuery = supabase.from("gestion_jd_operations").select("*").eq("app_source", APP_SOURCE).eq("client_id", client.id).order("updated_at", { ascending: false }).limit(1);
      if (params.operationId) operationQuery = supabase.from("gestion_jd_operations").select("*").eq("app_source", APP_SOURCE).eq("client_id", client.id).eq("id", params.operationId).limit(1);
      const { data: remoteOperations } = await operationQuery;
      if (remoteOperations?.[0]) operation = mapRemoteOperation(remoteOperations[0]);
    }
  }
  let documents = localDocuments().filter((item) => item.clientId === client?.id && (!operation || item.operationId === operation.id));
  if (isSupabaseConfigured && supabase && client && operation) {
    const { data: remoteDocuments } = await supabase.from("gestion_jd_documents").select("*").eq("app_source", APP_SOURCE).eq("client_id", client.id).eq("operation_id", operation.id).order("updated_at", { ascending: false });
    if (remoteDocuments) documents = remoteDocuments.map(mapRemoteDocument);
  }
  return { client: client ?? null, operation: operation ?? null, documents };
}

export function listLocalClients() { return localClients().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
export function listClientOperations(clientId: string) { return localOperations().filter((item) => item.clientId === clientId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
export async function getClientHistory(clientId: string) {
  let operations = listClientOperations(clientId);
  let documents = localDocuments().filter((item) => item.clientId === clientId);
  if (isSupabaseConfigured && supabase) {
    const [{ data: remoteOperations }, { data: remoteDocuments }] = await Promise.all([
      supabase.from("gestion_jd_operations").select("*").eq("app_source", APP_SOURCE).eq("client_id", clientId).order("updated_at", { ascending: false }),
      supabase.from("gestion_jd_documents").select("*").eq("app_source", APP_SOURCE).eq("client_id", clientId).order("updated_at", { ascending: false }),
    ]);
    if (remoteOperations) operations = remoteOperations.map(mapRemoteOperation);
    if (remoteDocuments) documents = remoteDocuments.map(mapRemoteDocument);
  }
  return { operations, documents };
}

export async function listFinalizedSales(): Promise<FinalizedSale[]> {
  const [clients, vehicles] = await Promise.all([listClients(), listVehicles()]);
  let operations = localOperations().filter((operation) => operation.status === "finalizada");

  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase
      .from("gestion_jd_operations")
      .select("*")
      .eq("app_source", APP_SOURCE)
      .eq("status", "finalizada")
      .order("updated_at", { ascending: false });
    if (data) operations = data.map(mapRemoteOperation);
  }

  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const clientsByName = new Map(clients.map((client) => [client.nombre.trim().toLowerCase(), client]));

  const finalizedSales = operations
    .map((operation): FinalizedSale | null => {
      if (!operation.vehicleId) return null;
      const client = clientsById.get(operation.clientId);
      const vehicle = vehiclesById.get(operation.vehicleId);
      const finalizedData = operation.data.ventaFinalizada as Record<string, unknown> | undefined;
      return {
        operationId: operation.id,
        clientId: operation.clientId,
        clientName: client?.nombre || vehicle?.buyerName || "Sin cliente",
        clientDni: client?.dni || "",
        vehicleId: operation.vehicleId,
        vehicleLabel: vehicle ? `${vehicle.brand} ${vehicle.model}`.trim() : "Auto vendido",
        licensePlate: vehicle?.licensePlate || String(operation.data.dominio ?? ""),
        saleDate: String(finalizedData?.fecha ?? vehicle?.exitDate ?? operation.fecha ?? ""),
        salePrice: Number(finalizedData?.precioVenta ?? vehicle?.salePrice ?? 0),
        hasCredit: Boolean(finalizedData?.tomaCredito ?? vehicle?.hasCredit),
        source: "operation" as const,
      } satisfies FinalizedSale;
    })
    .filter((sale): sale is FinalizedSale => sale !== null);

  const finalizedVehicleIds = new Set(finalizedSales.map((sale) => sale.vehicleId));
  const historicalSales: FinalizedSale[] = vehicles
    .filter((vehicle) => vehicle.status === "vendido" && !finalizedVehicleIds.has(vehicle.id))
    .map((vehicle) => {
      const matchedClient = clientsByName.get(vehicle.buyerName.trim().toLowerCase());
      return {
        operationId: `vehicle-history-${vehicle.id}`,
        clientId: matchedClient?.id ?? "",
        clientName: matchedClient?.nombre || vehicle.buyerName || "Cliente sin vincular",
        clientDni: matchedClient?.dni || "",
        vehicleId: vehicle.id,
        vehicleLabel: `${vehicle.brand} ${vehicle.model}`.trim() || "Auto vendido",
        licensePlate: vehicle.licensePlate,
        saleDate: vehicle.exitDate || vehicle.updatedAt.slice(0, 10),
        salePrice: Number(vehicle.salePrice ?? 0),
        hasCredit: vehicle.hasCredit,
        source: "vehicle_history" as const,
      };
    });

  return [...finalizedSales, ...historicalSales]
    .sort((a, b) => b.saleDate.localeCompare(a.saleDate));
}

export function documentTypeLabel(type: DocumentType) {
  return { datero: "Datero", recibo: "Recibo", autorizacion: "Autorización", operacion_finalizada: "Operación finalizada", compra_venta: "Boleto compra-venta", presupuesto_cliente: "Presupuesto", formulario_cliente: "Formulario cliente" }[type];
}
