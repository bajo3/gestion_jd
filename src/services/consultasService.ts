import { formatCurrency, parseNumberish } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";

const APP_SOURCE = "gestion_jd";
const LIMIT = 300;

export const consultaDocumentLabels = {
  datero: "Datero",
  recibo: "Recibo",
  autorizacion: "Autorización",
  operacion_finalizada: "Operación finalizada",
  compra_venta: "Boleto compra-venta",
  presupuesto_cliente: "Presupuesto",
  formulario_cliente: "Formulario cliente",
  test_drive: "Test Drive",
} as const;

export type ConsultaDocumentType = keyof typeof consultaDocumentLabels;
export type ConsultaFilter = "todos" | "archivos" | ConsultaDocumentType;

export type ConsultaDocument = {
  id: string;
  source: "archivo" | "registro";
  documentType: ConsultaDocumentType;
  documentLabel: string;
  title: string;
  personName: string;
  documentNumber: string;
  licensePlate: string;
  phone: string;
  vehicleLabel: string;
  amount: number | null;
  documentDate: string | null;
  createdAt: string;
  fileName: string;
  fileUrl: string | null;
  formData: Record<string, unknown>;
  clientId?: string;
  clientName?: string;
  clientDni?: string;
  operationId?: string;
  documentId?: string;
};

type LegacyDocumentRow = {
  id: string;
  document_type?: string | null;
  document_label?: string | null;
  title?: string | null;
  person_name?: string | null;
  document_number?: string | null;
  license_plate?: string | null;
  phone?: string | null;
  vehicle_label?: string | null;
  amount?: string | number | null;
  document_date?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  form_data?: Record<string, unknown> | null;
  created_at?: string | null;
};

type CurrentDocumentRow = {
  id: string;
  client_id: string;
  operation_id: string;
  document_type: string;
  data?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ClientRow = {
  id: string;
  nombre?: string | null;
  dni?: string | null;
  telefono?: string | null;
  celular?: string | null;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstText(values: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = text(values[key]);
    if (value) return value;
  }
  return "";
}

function joinParts(parts: string[]) {
  return parts.filter(Boolean).join(" ").trim();
}

function toDocumentType(type: string | null | undefined): ConsultaDocumentType {
  const normalized = (type ?? "").trim();
  const aliases: Record<string, ConsultaDocumentType> = {
    compraVenta: "compra_venta",
    formularioCliente: "formulario_cliente",
    presupuesto: "presupuesto_cliente",
    testDrive: "test_drive",
  };
  if (normalized in consultaDocumentLabels) return normalized as ConsultaDocumentType;
  return aliases[normalized] ?? "operacion_finalizada";
}

function buildTitle(label: string, personName: string, licensePlate: string) {
  if (personName && licensePlate) return `${label} - ${personName} (${licensePlate})`;
  return personName ? `${label} - ${personName}` : licensePlate ? `${label} - ${licensePlate}` : label;
}

function mapLegacyDocument(row: LegacyDocumentRow): ConsultaDocument {
  const documentType = toDocumentType(row.document_type);
  const documentLabel = row.document_label?.trim() || consultaDocumentLabels[documentType];
  const amount = row.amount === null || row.amount === undefined ? null : parseNumberish(row.amount);
  return {
    id: `archivo-${row.id}`,
    source: "archivo",
    documentType,
    documentLabel,
    title: row.title?.trim() || buildTitle(documentLabel, row.person_name ?? "", row.license_plate ?? ""),
    personName: row.person_name ?? "",
    documentNumber: row.document_number ?? "",
    licensePlate: row.license_plate ?? "",
    phone: row.phone ?? "",
    vehicleLabel: row.vehicle_label ?? "",
    amount: amount && amount > 0 ? amount : null,
    documentDate: row.document_date ?? null,
    createdAt: row.created_at ?? "",
    fileName: row.file_name ?? "",
    fileUrl: row.file_url ?? null,
    formData: row.form_data ?? {},
  };
}

function mapCurrentDocument(row: CurrentDocumentRow, client?: ClientRow): ConsultaDocument {
  const values = row.data ?? {};
  const documentType = toDocumentType(row.document_type);
  const documentLabel = consultaDocumentLabels[documentType];
  const personName = firstText(values, ["nombre", "cliente", "recibido", "autorizado", "titular", "propietarioNombre"]) || client?.nombre?.trim() || "";
  const documentNumber = firstText(values, ["dni", "doc", "numeroDoc", "propietarioDni", "cuil"]) || client?.dni?.trim() || "";
  const licensePlate = firstText(values, ["dominio", "vehiculoDominio", "patente", "ppaDominio"]).toUpperCase();
  const phone = firstText(values, ["telefono", "celular"]) || client?.telefono?.trim() || client?.celular?.trim() || "";
  const vehicleLabel = firstText(values, ["vehiculo", "vehiculoDescripcion"]) || joinParts([
    firstText(values, ["marca", "vehiculoMarca", "ppaMarca"]),
    firstText(values, ["modelo", "vehiculoModelo", "ppaModelo"]),
    firstText(values, ["anio", "vehiculoAnio", "ppaAnio"]),
  ]);
  const amount = parseNumberish(firstText(values, ["monto", "precioVenta", "cantidadNum", "creditoTotal", "importe"]));
  const documentDate = firstText(values, ["fecha", "fechaOperacion", "fechaVenta"]) || null;

  return {
    id: `registro-${row.id}`,
    source: "registro",
    documentType,
    documentLabel,
    title: buildTitle(documentLabel, personName, licensePlate),
    personName,
    documentNumber,
    licensePlate,
    phone,
    vehicleLabel,
    amount: amount > 0 ? amount : null,
    documentDate,
    createdAt: row.created_at ?? row.updated_at ?? "",
    // Los documentos pasados desde Consultas conservan el PDF original.
    fileName: text(values.fileName),
    fileUrl: text(values.fileUrl) || null,
    formData: values,
    clientId: row.client_id,
    clientName: client?.nombre?.trim() || personName,
    clientDni: client?.dni?.trim() || documentNumber,
    operationId: row.operation_id,
    documentId: row.id,
  };
}

export function normalizeConsultaText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function searchTerms(query: string) {
  return normalizeConsultaText(query).split(/\s+/).filter((term) => term.length >= 2).slice(0, 6);
}

function searchableDocumentText(document: ConsultaDocument) {
  const formValues = Object.values(document.formData)
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .join(" ");
  return normalizeConsultaText([
    document.documentLabel,
    document.title,
    document.personName,
    document.documentNumber,
    document.licensePlate,
    document.phone,
    document.vehicleLabel,
    formValues,
  ].join(" "));
}

function matches(document: ConsultaDocument, query: string, filter: ConsultaFilter) {
  if (filter === "archivos" && !document.fileUrl) return false;
  if (filter !== "todos" && filter !== "archivos" && document.documentType !== filter) return false;
  const terms = searchTerms(query);
  if (!terms.length) return true;
  const haystack = searchableDocumentText(document);
  return terms.every((term) => haystack.includes(term));
}

/** Busca el archivo histórico y los documentos del flujo comercial vigente. */
export async function searchConsultas(query = "", filter: ConsultaFilter = "todos") {
  if (!isSupabaseConfigured || !supabase) return { documents: [] as ConsultaDocument[], connected: false };

  const [legacyResult, currentResult, clientsResult] = await Promise.all([
    supabase.from("gestion_jd_documentos").select("*").eq("app_source", APP_SOURCE).order("created_at", { ascending: false }).limit(LIMIT),
    supabase.from("gestion_jd_documents").select("*").eq("app_source", APP_SOURCE).order("updated_at", { ascending: false }).limit(LIMIT),
    supabase.from("gestion_jd_clients").select("id,nombre,dni,telefono,celular").eq("app_source", APP_SOURCE).limit(LIMIT),
  ]);

  const clientsById = new Map(((clientsResult.data ?? []) as ClientRow[]).map((client) => [client.id, client]));
  const currentRows = currentResult.error ? [] : ((currentResult.data ?? []) as CurrentDocumentRow[]);
  // Un PDF archivado que ya se asigno a un cliente se muestra una sola vez, dentro del cliente.
  const assignedLegacyIds = new Set(currentRows.map((row) => text(row.data?.legacyDocumentId)).filter(Boolean));
  const legacyDocuments = legacyResult.error
    ? []
    : ((legacyResult.data ?? []) as LegacyDocumentRow[]).filter((row) => !assignedLegacyIds.has(row.id)).map(mapLegacyDocument);
  const currentDocuments = currentRows.map((document) => mapCurrentDocument(document, clientsById.get(document.client_id)));

  return {
    documents: [...legacyDocuments, ...currentDocuments]
      .filter((document) => matches(document, query, filter))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    connected: !legacyResult.error || !currentResult.error,
  };
}

export function formatConsultaAmount(value: number | null) {
  return value === null ? "" : formatCurrency(value);
}
