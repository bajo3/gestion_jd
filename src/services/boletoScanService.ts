import { toVehicleInput } from "@/lib/vehicleInput";
import { formatCurrency } from "@/lib/utils";
import { archiveDocument, normalizePlate, searchDocuments, updateArchivedDocument } from "@/services/documentsService";
import { uploadVehicleFile } from "@/services/filesService";
import { emptyVehicleInput, syncCompraVentaGenerated, type SaleSyncLink } from "@/services/saleSyncService";
import { attachFilesToVehicle, createVehicle, listVehicles, updateVehicle } from "@/services/vehiclesService";
import type { CompraVentaFormValues } from "@/types/forms";
import type { StoredDocument } from "@/types/documents";
import type { Vehicle, VehicleInput } from "@/types/vehicles";

export type BoletoPerson = {
  nombre: string;
  dni: string;
  cuit: string;
  domicilio: string;
  telefono: string;
  estadoCivil: string;
};

/** Lo que devuelve la IA al leer un boleto, ya limpio (api/boleto-scan.js). */
export type BoletoExtraction = {
  esBoleto: boolean;
  fecha: string;
  vendedor: BoletoPerson;
  comprador: BoletoPerson;
  vehiculo: {
    marca: string;
    modelo: string;
    tipo: string;
    dominio: string;
    anio: number | null;
    km: number | null;
    motor: string;
    chasis: string;
    color: string;
  };
  precio: number | null;
  moneda: "ARS" | "USD";
  formaPago: string;
  observaciones: string;
  legibilidad: "alta" | "media" | "baja";
  dudas: string[];
};

export type BoletoDirection = "venta" | "compra";

/** Campos editables en la pantalla de revision. `parte*` es la otra punta de la operacion. */
export type BoletoForm = {
  direction: BoletoDirection;
  fecha: string;
  parteNombre: string;
  parteDni: string;
  parteTelefono: string;
  parteDomicilio: string;
  marca: string;
  modelo: string;
  tipo: string;
  dominio: string;
  anio: string;
  km: string;
  motor: string;
  chasis: string;
  color: string;
  precio: string;
  moneda: "ARS" | "USD";
  formaPago: string;
  observaciones: string;
};

const SCAN_URL = "/api/boleto-scan";
const MAX_IMAGE_SIDE = 1800;
const MAX_PDF_BYTES = 3_200_000;

export const ACCEPTED_BOLETO_TYPES = "application/pdf,image/jpeg,image/png,image/webp";

const AGENCY_NAME = /jes[uú]s\s+d[ií]az|\bj\.?\s?d\.?\s+automotores|\bjd\b/i;

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(blob);
  });
}

/** Achica las fotos del celular (varios MB) para que entren en el pedido y se lean igual de bien. */
async function shrinkImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("No se pudo abrir la imagen."));
      element.src = url;
    });
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("El navegador no permite procesar la imagen.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob) throw new Error("No se pudo preparar la imagen.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function isBoletoFile(file: File) {
  return file.type === "application/pdf" || /^image\/(jpeg|png|webp)$/.test(file.type);
}

/** Manda el archivo a la IA y devuelve los datos leidos. Lanza con un mensaje claro si falla. */
export async function scanBoletoFile(file: File): Promise<BoletoExtraction> {
  let mediaType = file.type;
  let blob: Blob = file;

  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES) throw new Error("El PDF pesa mas de 3 MB. Comprimilo o sacale una foto a las hojas.");
  } else {
    blob = await shrinkImage(file);
    mediaType = "image/jpeg";
  }

  const response = await fetch(SCAN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, mediaType, data: await blobToBase64(blob) }),
  });

  const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; extraction?: BoletoExtraction } | null;
  if (!response.ok || !body?.ok || !body.extraction) {
    throw new Error(body?.error || `No se pudo leer el boleto (codigo ${response.status}).`);
  }
  return body.extraction;
}

/** Si el vendedor es la agencia, es una venta nuestra; si el comprador es la agencia, una compra. */
export function guessDirection(extraction: BoletoExtraction): BoletoDirection {
  if (AGENCY_NAME.test(extraction.comprador.nombre) && !AGENCY_NAME.test(extraction.vendedor.nombre)) return "compra";
  return "venta";
}

export function buildBoletoForm(extraction: BoletoExtraction): BoletoForm {
  const direction = guessDirection(extraction);
  const party = direction === "venta" ? extraction.comprador : extraction.vendedor;
  const vehicle = extraction.vehiculo;
  return {
    direction,
    fecha: extraction.fecha,
    parteNombre: party.nombre,
    parteDni: party.dni,
    parteTelefono: party.telefono,
    parteDomicilio: party.domicilio,
    marca: vehicle.marca,
    modelo: vehicle.modelo,
    tipo: vehicle.tipo,
    dominio: vehicle.dominio,
    anio: vehicle.anio ? String(vehicle.anio) : "",
    km: vehicle.km ? String(vehicle.km) : "",
    motor: vehicle.motor,
    chasis: vehicle.chasis,
    color: vehicle.color,
    precio: extraction.precio ? String(extraction.precio) : "",
    moneda: extraction.moneda,
    formaPago: extraction.formaPago,
    observaciones: extraction.observaciones,
  };
}

/** Lo que falta para que la carga automatica sea completa. */
export function boletoWarnings(form: BoletoForm, extraction: BoletoExtraction | null) {
  const warnings: string[] = [];
  const who = form.direction === "venta" ? "del comprador" : "del vendedor";
  if (!form.parteNombre.trim()) warnings.push(`Falta el nombre ${who}.`);
  if (form.direction === "venta" && form.parteDni.replace(/\D/g, "").length < 6) {
    warnings.push("Falta el DNI del comprador: sin el no se puede crear el cliente ni cerrar la venta.");
  }
  if (!form.dominio.trim()) warnings.push("Falta la patente: sin ella no se puede identificar el auto.");
  if (!(Number(form.precio) > 0)) warnings.push("Falta el precio.");
  if (form.moneda === "USD") warnings.push("El precio esta en dolares: el sistema registra pesos, revisalo antes de confirmar.");
  if (extraction && !extraction.esBoleto) warnings.push("La IA no reconocio este archivo como un boleto de compra-venta.");
  if (extraction?.legibilidad === "baja") warnings.push("El archivo se lee mal: revisa todos los datos con el original.");
  return warnings;
}

/** Mapa al formulario del Boleto de la app, para reutilizar la carga que ya hace ese documento. */
export function toCompraVentaValues(form: BoletoForm): CompraVentaFormValues {
  return {
    fecha: form.fecha,
    recibido: form.parteNombre,
    numeroDoc: form.parteDni,
    telefono: form.parteTelefono,
    domicilio: form.parteDomicilio,
    cantidadNum: form.precio,
    dominio: form.dominio,
    marca: form.marca,
    modelo: form.modelo,
    tipo: form.tipo,
    nMotor: form.motor,
    nChasis: form.chasis,
    observaciones: [form.formaPago, form.observaciones].filter(Boolean).join(" · "),
    sinGarantia: false,
  };
}

export type SavedBoletoFile = { document: StoredDocument; persisted: boolean };

/**
 * Guarda el archivo apenas se sube, antes de leerlo: aunque la lectura falle o se cierre la
 * pagina, el PDF o la foto ya quedaron en Consultas para revisarlos despues.
 */
export async function saveBoletoFile(file: File): Promise<SavedBoletoFile> {
  return archiveDocument({
    documentType: "compraVenta",
    values: { estado: "pendiente_revision", observaciones: "Boleto subido, pendiente de revisar" },
    fileName: file.name,
    blob: file,
  });
}

/** Completa el documento ya guardado con los datos revisados; si no hay, lo archiva recien. */
async function archiveReviewed(file: File, values: Record<string, unknown>, saved: SavedBoletoFile | null) {
  if (saved) return updateArchivedDocument(saved.document, values);
  return archiveDocument({ documentType: "compraVenta", values, fileName: file.name, blob: file });
}

const NOT_PERSISTED =
  "El archivo quedó solo en este navegador: no llegó a la base de datos. Volvé a cargarlo cuando haya conexión.";

/** Boletos ya cargados de la misma patente, para no cargar dos veces el mismo. */
export async function findExistingBoletos(form: BoletoForm) {
  const plate = normalizePlate(form.dominio);
  if (!plate) return [];
  try {
    const { documents } = await searchDocuments({ documentType: "compraVenta", query: form.dominio, limit: 20 });
    return documents.filter((document) => normalizePlate(document.licensePlate) === plate);
  } catch {
    return [];
  }
}

export type BoletoConfirmResult = {
  messages: string[];
  warnings: string[];
  links: SaleSyncLink[];
};

async function attachFileToVehicle(vehicle: Vehicle, file: File) {
  const uploaded = await uploadVehicleFile({
    vehicleId: vehicle.id,
    file,
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    category: "boleto",
    notes: "Boleto cargado desde Boletos",
  });
  await attachFilesToVehicle(vehicle.id, [uploaded]);
}

function findVehicle(vehicles: Vehicle[], plate: string) {
  const normalized = normalizePlate(plate);
  return normalized ? vehicles.find((vehicle) => normalizePlate(vehicle.licensePlate) === normalized) : undefined;
}

async function confirmSale(form: BoletoForm, file: File): Promise<BoletoConfirmResult> {
  const values = toCompraVentaValues(form);
  const result = await syncCompraVentaGenerated(values, { documentSaved: false });
  const messages = [...result.messages];
  const warnings = [...result.warnings];

  try {
    const vehicle = findVehicle(await listVehicles(), form.dominio);
    if (vehicle) {
      await attachFileToVehicle(vehicle, file);
      messages.push("El boleto quedó guardado en los archivos del auto.");
    }
  } catch {
    warnings.push("No se pudo adjuntar el archivo al auto, pero sí quedó en Consultas.");
  }

  return { messages, warnings, links: result.links ?? [] };
}

async function confirmPurchase(form: BoletoForm, file: File, saved: SavedBoletoFile | null): Promise<BoletoConfirmResult> {
  const messages: string[] = [];
  const warnings: string[] = [];
  const plate = form.dominio.trim().toUpperCase();
  if (!plate) throw new Error("Falta la patente: sin ella no se puede cargar el auto.");

  const price = Number(form.precio) > 0 ? Number(form.precio) : null;
  const patch: Partial<VehicleInput> = {
    brand: form.marca,
    model: form.modelo,
    year: Number(form.anio) > 0 ? Number(form.anio) : null,
    kilometers: Number(form.km) > 0 ? Number(form.km) : null,
    vin: form.chasis,
    engine: form.motor,
    color: form.color,
    purchasePrice: form.moneda === "ARS" ? price : null,
    entryDate: form.fecha,
  };

  const current = findVehicle(await listVehicles(), plate);
  let vehicle: Vehicle;
  if (current) {
    // El auto ya esta en el Historial: solo se completa lo que tenia vacio.
    const merged = { ...toVehicleInput(current) } as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(patch)) {
      const existing = merged[key];
      if ((existing === "" || existing === null || existing === undefined) && value !== "" && value !== null) merged[key] = value;
    }
    vehicle = await updateVehicle(current.id, merged as unknown as VehicleInput);
    messages.push(`El auto ya estaba en el Historial: se completaron los datos que faltaban.`);
  } else {
    const seller = [form.parteNombre, form.parteDni && `DNI ${form.parteDni}`].filter(Boolean).join(", ");
    vehicle = await createVehicle({
      ...emptyVehicleInput(plate),
      ...patch,
      status: "ingresado",
      observations: [seller && `Comprado a ${seller}.`, form.formaPago, "Cargado desde el boleto de compra."].filter(Boolean).join(" "),
    });
    messages.push(`Auto cargado en el Historial${price && form.moneda === "ARS" ? ` (compra por ${formatCurrency(price)})` : ""}.`);
  }

  const archived = await archiveReviewed(
    file,
    { ...toCompraVentaValues(form), recibido: "Jesús Díaz Automotores (compra)", numeroDoc: "" },
    saved,
  );
  if (archived.persisted) messages.push("El boleto quedó guardado en Consultas.");
  else warnings.push(NOT_PERSISTED);

  try {
    await attachFileToVehicle(vehicle, file);
    messages.push("Y en los archivos del auto.");
  } catch {
    warnings.push("No se pudo adjuntar el archivo al auto.");
  }

  return { messages, warnings, links: [{ to: `/autos/${vehicle.id}`, label: "Ver el auto" }] };
}

/** Carga lo revisado: venta => cliente, operacion y venta cerrada; compra => auto en el Historial. */
export async function confirmBoleto(
  form: BoletoForm,
  file: File,
  saved: SavedBoletoFile | null = null,
): Promise<BoletoConfirmResult> {
  if (form.direction === "compra") return confirmPurchase(form, file, saved);

  // La venta archiva el PDF/foto original para poder consultarlo despues.
  const archived = await archiveReviewed(file, toCompraVentaValues(form) as unknown as Record<string, unknown>, saved);
  const result = await confirmSale(form, file);
  if (archived.persisted) result.messages.unshift("El boleto quedó guardado en Consultas.");
  else result.warnings.unshift(NOT_PERSISTED);
  return result;
}
