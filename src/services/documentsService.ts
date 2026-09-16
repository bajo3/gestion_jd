import { readStorage, writeStorage } from "@/lib/storage";
import { generateId, parseNumberish } from "@/lib/utils";
import { documentLabels, type DocumentType } from "@/services/documentDraftService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { DocumentSearchFilters, StoredDocument } from "@/types/documents";

const STORAGE_KEY = "gestion-jd-documentos";
const DOCUMENTS_TABLE = "gestion_jd_documentos";
const BUCKET = "gestion-jd-documentos";
const APP_SOURCE = "gestion_jd";
const LOCAL_LIMIT = 300;

type DbDocument = {
  id: string;
  app_source: string;
  document_type: string;
  document_label: string;
  title: string;
  person_name?: string | null;
  document_number?: string | null;
  license_plate?: string | null;
  phone?: string | null;
  vehicle_label?: string | null;
  amount?: number | string | null;
  document_date?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  storage_path?: string | null;
  form_data?: Record<string, unknown> | null;
  search_text?: string | null;
  created_at: string;
};

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function normalizePlate(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

function text(values: Record<string, unknown>, key: string) {
  const value = values[key];
  return typeof value === "string" ? value.trim() : "";
}

function firstText(values: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = text(values, key);
    if (value) return value;
  }
  return "";
}

function joinParts(parts: Array<string | undefined | null>) {
  return parts.map((part) => (part ?? "").trim()).filter(Boolean).join(" ");
}

type DocumentMeta = {
  personName: string;
  documentNumber: string;
  licensePlate: string;
  phone: string;
  vehicleLabel: string;
  amount: number | null;
  documentDate: string | null;
};

/**
 * Cada documento guarda los datos en campos distintos, asi que normalizamos
 * lo que sirve para buscar (nombre, DNI, patente, telefono, auto e importe).
 */
export function buildDocumentMeta(documentType: DocumentType, values: Record<string, unknown>): DocumentMeta {
  const base: DocumentMeta = {
    personName: "",
    documentNumber: "",
    licensePlate: "",
    phone: "",
    vehicleLabel: "",
    amount: null,
    documentDate: null,
  };

  const amountFrom = (key: string) => {
    const raw = text(values, key);
    if (!raw) return null;
    const parsed = parseNumberish(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const dateFrom = (keys: string[]) => {
    const raw = firstText(values, keys);
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  };

  switch (documentType) {
    case "compraVenta":
      return {
        ...base,
        personName: text(values, "recibido"),
        documentNumber: text(values, "numeroDoc"),
        licensePlate: text(values, "dominio").toUpperCase(),
        phone: text(values, "telefono"),
        vehicleLabel: joinParts([text(values, "marca"), text(values, "modelo"), text(values, "tipo")]),
        amount: amountFrom("cantidadNum"),
        documentDate: dateFrom(["fecha"]),
      };
    case "autorizacion":
      return {
        ...base,
        personName: firstText(values, ["autorizado", "propietarioNombre", "titular"]),
        documentNumber: text(values, "propietarioDni"),
        licensePlate: text(values, "dominio").toUpperCase(),
        vehicleLabel: joinParts([text(values, "marca"), text(values, "modelo"), text(values, "anio")]),
        documentDate: dateFrom(["fecha"]),
      };
    case "datero":
      return {
        ...base,
        personName: text(values, "nombre"),
        documentNumber: firstText(values, ["dni", "cuil"]),
        licensePlate: firstText(values, ["dominio", "ppaDominio"]).toUpperCase(),
        phone: firstText(values, ["celular", "telefono"]),
        vehicleLabel: joinParts([text(values, "ppaMarca"), text(values, "ppaModelo"), text(values, "ppaAnio")]),
        amount: amountFrom("creditoTotal"),
        documentDate: dateFrom(["fechaOperacion"]),
      };
    case "recibo":
      return {
        ...base,
        personName: text(values, "cliente"),
        documentNumber: text(values, "doc"),
        licensePlate: text(values, "vehiculoDominio").toUpperCase(),
        vehicleLabel: text(values, "vehiculo"),
        amount: amountFrom("monto"),
        documentDate: dateFrom(["fecha"]),
      };
    case "presupuesto":
      return {
        ...base,
        personName: text(values, "nombre"),
        documentNumber: text(values, "dni"),
        phone: text(values, "telefono"),
        vehicleLabel: joinParts([text(values, "vehModelo"), text(values, "vehAnio")]),
        amount: amountFrom("precioVenta"),
        documentDate: dateFrom(["fecha"]),
      };
    case "testDrive":
      return {
        ...base,
        personName: firstText(values, ["nombreConductor", "aclaracionConductor"]),
        documentNumber: text(values, "dniConductor"),
        licensePlate: text(values, "dominio").toUpperCase(),
        vehicleLabel: joinParts([text(values, "marca"), text(values, "modelo"), text(values, "version")]),
        documentDate: dateFrom(["fecha"]),
      };
    case "formularioCliente":
      return {
        ...base,
        personName: text(values, "nombre"),
        documentNumber: firstText(values, ["dni", "cuil"]),
        documentDate: dateFrom(["fecha"]),
      };
    default:
      return base;
  }
}

function buildTitle(documentType: DocumentType, meta: DocumentMeta) {
  const label = documentLabels[documentType];
  const who = meta.personName || meta.documentNumber;
  const plate = meta.licensePlate;

  if (who && plate) return `${label} - ${who} (${plate})`;
  if (who) return `${label} - ${who}`;
  if (plate) return `${label} - ${plate}`;
  return label;
}

function buildSearchText(documentType: DocumentType, meta: DocumentMeta, values: Record<string, unknown>) {
  const extras = Object.values(values)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  const parts = [
    documentLabels[documentType],
    documentType,
    meta.personName,
    meta.documentNumber,
    meta.licensePlate,
    normalizePlate(meta.licensePlate),
    meta.phone,
    meta.vehicleLabel,
    ...extras,
  ];

  return normalizeText(parts.filter(Boolean).join(" ")).replace(/\s+/g, " ").slice(0, 4000);
}

function readLocalDocuments() {
  const stored = readStorage<StoredDocument[]>(STORAGE_KEY, []);
  return Array.isArray(stored) ? stored : [];
}

function sortDocuments(documents: StoredDocument[]) {
  return [...documents].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * Los PDF guardados como data URL pueden llenar el localStorage, asi que si no
 * entran los volvemos a escribir sin el archivo antes de perder la metadata.
 */
function saveLocalDocuments(documents: StoredDocument[]) {
  const limited = sortDocuments(documents).slice(0, LOCAL_LIMIT);

  try {
    writeStorage(STORAGE_KEY, limited);
    return;
  } catch {
    // sigue abajo sin archivos locales
  }

  try {
    writeStorage(
      STORAGE_KEY,
      limited.map((document) =>
        document.fileUrl?.startsWith("data:") ? { ...document, fileUrl: null } : document,
      ),
    );
  } catch {
    // localStorage lleno: no podemos hacer mas
  }
}

function mapDbDocument(row: DbDocument): StoredDocument {
  const amount = row.amount === null || row.amount === undefined ? null : Number(row.amount);

  return {
    id: row.id,
    documentType: row.document_type as DocumentType,
    documentLabel: row.document_label || documentLabels[row.document_type as DocumentType] || "Documento",
    title: row.title,
    personName: row.person_name ?? "",
    documentNumber: row.document_number ?? "",
    licensePlate: row.license_plate ?? "",
    phone: row.phone ?? "",
    vehicleLabel: row.vehicle_label ?? "",
    amount: amount !== null && Number.isFinite(amount) ? amount : null,
    documentDate: row.document_date ?? null,
    fileName: row.file_name ?? "",
    fileUrl: row.file_url ?? null,
    storagePath: row.storage_path ?? null,
    formData: (row.form_data ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

function documentPayload(document: StoredDocument) {
  return {
    id: document.id,
    app_source: APP_SOURCE,
    document_type: document.documentType,
    document_label: document.documentLabel,
    title: document.title,
    person_name: document.personName || null,
    document_number: document.documentNumber || null,
    license_plate: document.licensePlate || null,
    phone: document.phone || null,
    vehicle_label: document.vehicleLabel || null,
    amount: document.amount,
    document_date: document.documentDate,
    file_name: document.fileName || null,
    file_url: document.fileUrl?.startsWith("data:") ? null : document.fileUrl,
    storage_path: document.storagePath,
    form_data: document.formData,
    search_text: buildSearchText(document.documentType, document, document.formData),
    created_at: document.createdAt,
  };
}

async function uploadDocumentFile(document: StoredDocument, blob: Blob) {
  if (!isSupabaseConfigured || !supabase) return null;

  const objectPath = `${document.documentType}/${document.id}-${document.fileName || "documento.pdf"}`;

  try {
    const { error } = await supabase.storage.from(BUCKET).upload(objectPath, blob, {
      upsert: true,
      contentType: "application/pdf",
    });

    if (error) return null;

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);

    return { fileUrl: publicUrl, storagePath: objectPath };
  } catch {
    return null;
  }
}

async function insertRemoteDocument(document: StoredDocument) {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from(DOCUMENTS_TABLE)
      .insert(documentPayload(document))
      .select("*")
      .single();

    if (error || !data) return null;
    return mapDbDocument(data as DbDocument);
  } catch {
    return null;
  }
}

async function blobToDataUrl(blob: Blob) {
  try {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export type ArchiveDocumentInput = {
  documentType: DocumentType;
  values: Record<string, unknown>;
  fileName: string;
  blob?: Blob | null;
};

/**
 * Guarda el documento recien generado: sube el PDF al bucket, escribe la fila
 * en Supabase y deja una copia local para poder consultarlo sin conexion.
 */
export async function archiveDocument(input: ArchiveDocumentInput) {
  const meta = buildDocumentMeta(input.documentType, input.values);
  const localDocument: StoredDocument = {
    id: generateId(),
    documentType: input.documentType,
    documentLabel: documentLabels[input.documentType],
    title: buildTitle(input.documentType, meta),
    ...meta,
    fileName: input.fileName,
    fileUrl: null,
    storagePath: null,
    formData: input.values,
    createdAt: new Date().toISOString(),
  };

  const uploaded = input.blob ? await uploadDocumentFile(localDocument, input.blob) : null;
  if (uploaded) {
    localDocument.fileUrl = uploaded.fileUrl;
    localDocument.storagePath = uploaded.storagePath;
  } else if (input.blob) {
    localDocument.fileUrl = await blobToDataUrl(input.blob);
  }

  saveLocalDocuments([localDocument, ...readLocalDocuments()]);

  const remoteDocument = await insertRemoteDocument(localDocument);
  if (!remoteDocument) return { document: localDocument, persisted: false };

  const merged: StoredDocument = { ...remoteDocument, fileUrl: remoteDocument.fileUrl ?? localDocument.fileUrl };
  saveLocalDocuments(readLocalDocuments().map((item) => (item.id === localDocument.id ? merged : item)));
  return { document: merged, persisted: true };
}

async function fetchRemoteDocuments(filters: DocumentSearchFilters = {}): Promise<StoredDocument[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    let request = supabase
      .from(DOCUMENTS_TABLE)
      .select("*")
      .eq("app_source", APP_SOURCE)
      .order("created_at", { ascending: false })
      .limit(filters.limit ?? 200);

    if (filters.documentType && filters.documentType !== "todos") {
      request = request.eq("document_type", filters.documentType);
    }

    for (const term of searchTerms(filters.query ?? "")) {
      request = request.ilike("search_text", `%${term}%`);
    }

    const { data, error } = await request;
    if (error || !data) return null;
    return (data as DbDocument[]).map(mapDbDocument);
  } catch {
    return null;
  }
}

function searchTerms(query: string) {
  const normalized = normalizeText(query);
  if (!normalized) return [];

  return normalized
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 6);
}

export function matchesDocument(document: StoredDocument, query: string) {
  const terms = searchTerms(query);
  if (!terms.length) return true;

  const haystack = buildSearchText(document.documentType, document, document.formData);
  return terms.every((term) => haystack.includes(term));
}

function filterLocalDocuments(documents: StoredDocument[], filters: DocumentSearchFilters) {
  const byType =
    filters.documentType && filters.documentType !== "todos"
      ? documents.filter((document) => document.documentType === filters.documentType)
      : documents;

  return sortDocuments(byType.filter((document) => matchesDocument(document, filters.query ?? ""))).slice(
    0,
    filters.limit ?? 200,
  );
}

/**
 * Busca por patente, nombre, DNI, telefono o auto. Usa Supabase y, si no
 * responde, cae a la copia local del navegador.
 */
export async function searchDocuments(filters: DocumentSearchFilters = {}) {
  const remote = await fetchRemoteDocuments(filters);
  const local = readLocalDocuments();

  if (remote === null) {
    return { documents: filterLocalDocuments(local, filters), source: "local" as const };
  }

  const remoteIds = new Set(remote.map((document) => document.id));
  const localOnly = filterLocalDocuments(
    local.filter((document) => !remoteIds.has(document.id)),
    filters,
  );

  // Completa la URL local (data URL) cuando el archivo no llego al bucket.
  const localById = new Map(local.map((document) => [document.id, document]));
  const documents = remote.map((document) => ({
    ...document,
    fileUrl: document.fileUrl ?? localById.get(document.id)?.fileUrl ?? null,
  }));

  return {
    documents: sortDocuments([...documents, ...localOnly]).slice(0, filters.limit ?? 200),
    source: "supabase" as const,
  };
}

export async function listRecentDocuments(limit = 20) {
  const { documents } = await searchDocuments({ limit });
  return documents;
}
