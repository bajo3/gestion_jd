import { nextDocumentLinks } from "@/lib/sharedData";
import { finalizeSaleAtomic, markLocalOperationFinalized, normalizeDni, saveClientDocument } from "@/services/clientsService";
import { highlightSoldCarAutomatically } from "@/services/priceListSaleLink";
import { commitSharedData } from "@/services/sharedDataService";
import type { SaleSyncLink } from "@/services/saleSyncService";
import { createVehicle, getVehicleById, updateVehicle } from "@/services/vehiclesService";
import {
  emptyVehicleInput,
  invalidateAssistantVehiclesCache,
  type AssistantDraft,
} from "@/services/vehicleAssistantService";
import { toVehicleInput } from "@/lib/vehicleInput";
import { emptySalesDocumentValues } from "@/types/salesDocuments";
import type { Vehicle, VehicleInput } from "@/types/vehicles";

/**
 * La venta en una frase: a partir de lo que entendio el asistente ("vendi la Amarok a Juan
 * Perez, DNI..., 52 millones, 24 cuotas") arma el plan y, con una sola confirmacion, hace
 * todos los pasos que antes eran cuatro pantallas: auto, cliente y operacion, cierre de la
 * venta, fila amarilla en la lista de precios y documentos listos para generar.
 */

/** Estos datos los escribe el cierre de la venta en la base: no se tocan a mano en el auto. */
const SALE_ONLY_FIELDS: Array<keyof VehicleInput> = [
  "status",
  "exitDate",
  "salePrice",
  "hasCredit",
  "creditStartDate",
  "creditTotalInstallments",
  "creditDueDay",
];

/** "vendi la amarok...", "se vendio el cronos": una venta, aunque el mensaje nombre otras cosas. */
export function looksLikeSale(text: string) {
  const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /\b(vendi|vendido|vendida|vendimos|se vendio|venta cerrada)\b/.test(normalized);
}

export function isSaleDraft(draft: AssistantDraft | null | undefined) {
  return draft?.values.status === "vendido";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** "2026-10-07" -> "07/10/2026" */
function shortDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function money(value: number) {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function saleTerms(draft: AssistantDraft) {
  const values = draft.values;
  const saleDate = values.exitDate || today();
  const hasCredit = Boolean(values.hasCredit);
  // Mismo criterio que el Boleto: el credito arranca con la venta y vence ese dia cada mes.
  const creditStartDate = values.creditStartDate || saleDate;
  const creditDueDay = values.creditDueDay || Number(creditStartDate.slice(8, 10));
  return { saleDate, hasCredit, creditStartDate, creditDueDay, installments: values.creditTotalInstallments ?? null };
}

/** Lo que falta para poder cerrar la venta sin volver a preguntar. */
export function getSaleMissing(draft: AssistantDraft) {
  const values = draft.values;
  const missing: string[] = [];

  if (!draft.targetVehicleId) {
    if (draft.candidates.length > 1) missing.push("elegir cuál de los autos parecidos es");
    else if (!values.brand && !values.model) missing.push("marca y modelo del auto");
  }
  if (!values.salePrice) missing.push("precio de venta");
  if (!values.buyerName) missing.push("nombre del comprador");
  if (!normalizeDni(draft.buyerDni ?? "")) missing.push("DNI del comprador");
  if (values.hasCredit && !values.creditTotalInstallments) missing.push("cantidad de cuotas");
  return missing;
}

/** Avisos que no frenan la venta pero conviene saber antes de confirmar. */
export function getSaleWarnings(draft: AssistantDraft) {
  const warnings: string[] = [];
  if (!draft.values.buyerPhone) warnings.push("Sin teléfono no se crean los seguimientos de postventa.");
  if (!draft.targetVehicleId && draft.candidates.length <= 1) {
    warnings.push("El auto no está en el Historial: se va a cargar con los datos que diste.");
  }
  return warnings;
}

/** Los pasos que se van a ejecutar, en palabras, para confirmar antes de hacer nada. */
export function describeSalePlan(draft: AssistantDraft) {
  const values = draft.values;
  const terms = saleTerms(draft);
  const car = draft.targetLabel || [values.brand, values.model, values.year].filter(Boolean).join(" ") || "auto sin identificar";
  const buyer = [values.buyerName, draft.buyerDni ? `DNI ${draft.buyerDni}` : ""].filter(Boolean).join(", ") || "comprador sin datos";

  return [
    draft.targetVehicleId ? `Auto: ${car}` : `Auto nuevo en el Historial: ${car}`,
    `Cliente y operación: ${buyer}`,
    `Cerrar la venta${values.salePrice ? ` en ${money(values.salePrice)}` : ""} con fecha ${shortDate(terms.saleDate)}${
      terms.hasCredit ? `, crédito en ${terms.installments ?? "?"} cuotas que vencen el día ${terms.creditDueDay}` : ", de contado"
    }`,
    "Pintar de amarillo la fila del auto en la lista de precios",
    "Programar la postventa y dejar listos el Boleto y el Recibo",
  ];
}

export type SaleStep = { label: string; ok: boolean; detail: string };

export type SaleRunResult = {
  ok: boolean;
  steps: SaleStep[];
  links: SaleSyncLink[];
  vehicle: Vehicle | null;
};

async function resolveVehicle(draft: AssistantDraft): Promise<{ vehicle: Vehicle; created: boolean }> {
  const patch: Partial<VehicleInput> = { ...draft.values };
  for (const field of SALE_ONLY_FIELDS) delete patch[field];

  if (draft.targetVehicleId) {
    const current = await getVehicleById(draft.targetVehicleId);
    if (!current) throw new Error("El auto elegido ya no está en el Historial.");
    if (current.status === "vendido") throw new Error("Ese auto ya figura como vendido.");

    // Se suma lo nuevo que se dijo del auto (km, color, comprador) sin cambiarle el estado.
    const merged: VehicleInput = { ...toVehicleInput(current) };
    const target = merged as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined && value !== null && value !== "") target[key] = value;
    }
    const changed = JSON.stringify(merged) !== JSON.stringify(toVehicleInput(current));
    return { vehicle: changed ? await updateVehicle(current.id, merged) : current, created: false };
  }

  const vehicle = await createVehicle({
    ...emptyVehicleInput(),
    ...patch,
    status: "reservado",
    observations: patch.observations || "Cargado por el asistente al cerrar la venta: completar los datos del auto.",
  });
  return { vehicle, created: true };
}

/**
 * Ejecuta la venta. Si un paso clave falla, corta ahi y cuenta hasta donde llego; lo que es
 * accesorio (la fila amarilla) no frena lo demas.
 */
export async function runSalePlan(draft: AssistantDraft): Promise<SaleRunResult> {
  const steps: SaleStep[] = [];
  const values = draft.values;
  const terms = saleTerms(draft);
  let vehicle: Vehicle | null = null;

  const fail = (label: string, error: unknown): SaleRunResult => {
    steps.push({ label, ok: false, detail: error instanceof Error ? error.message : "No se pudo completar." });
    return { ok: false, steps, links: [], vehicle };
  };

  try {
    const resolved = await resolveVehicle(draft);
    vehicle = resolved.vehicle;
    invalidateAssistantVehiclesCache();
    steps.push({
      label: "Auto",
      ok: true,
      detail: `${[vehicle.brand, vehicle.model, vehicle.licensePlate].filter(Boolean).join(" ")}${resolved.created ? " (cargado en el Historial)" : ""}`,
    });
  } catch (error) {
    return fail("Auto", error);
  }

  const documentValues = {
    ...emptySalesDocumentValues,
    fecha: terms.saleDate,
    nombre: values.buyerName ?? "",
    dni: draft.buyerDni ?? "",
    telefono: values.buyerPhone ?? "",
    vehModelo: `${vehicle.brand} ${vehicle.model}`.trim(),
    vehAnio: vehicle.year ? String(vehicle.year) : "",
    vehKm: vehicle.kilometers ? String(vehicle.kilometers) : "",
    precioVenta: values.salePrice ? String(values.salePrice) : "",
    tomaCredito: terms.hasCredit ? ("si" as const) : ("no" as const),
    creditoNumeroCuotas: terms.installments ? String(terms.installments) : "",
    cuotasCant: terms.installments ? `${terms.installments} cuotas` : "",
    creditoFechaInicio: terms.hasCredit ? terms.creditStartDate : "",
    creditoDiaVencimiento: terms.hasCredit ? String(terms.creditDueDay) : "",
  };

  let clientId = "";
  let operationId = "";
  try {
    const commit = await commitSharedData({
      docType: "operacion_finalizada",
      values: documentValues,
      context: { vehicle },
      vehicleId: vehicle.id,
    });
    if (!commit) throw new Error("Faltan el nombre y el DNI del comprador.");
    if (commit.persistenceMode !== "remote") throw new Error(commit.warning || "No hay conexión con la base.");
    clientId = commit.clientId;
    operationId = commit.operationId;
    steps.push({
      label: "Cliente y operación",
      ok: true,
      detail: `${commit.client.nombre}${commit.created ? " (cliente u operación nuevos)" : " (ya estaba en Clientes)"}`,
    });
  } catch (error) {
    return fail("Cliente y operación", error);
  }

  try {
    const result = await finalizeSaleAtomic({
      operationId,
      vehicleId: vehicle.id,
      salePrice: values.salePrice ?? 0,
      buyerName: values.buyerName ?? "",
      buyerPhone: values.buyerPhone ?? "",
      hasCredit: terms.hasCredit,
      saleDate: terms.saleDate,
      creditStartDate: terms.hasCredit ? terms.creditStartDate : undefined,
      creditTotalInstallments: terms.hasCredit ? terms.installments : null,
      creditInstallmentsText: terms.hasCredit ? `${terms.installments} cuotas` : undefined,
      creditDueDay: terms.hasCredit ? terms.creditDueDay : null,
    });
    if (result.mode !== "remote") throw new Error("No hay conexión con la base: la venta no se cerró.");
    markLocalOperationFinalized(operationId, vehicle.id);
    await saveClientDocument({
      clientId,
      operationId,
      documentType: "operacion_finalizada",
      status: "generado",
      data: documentValues as unknown as Record<string, unknown>,
    });
    steps.push({
      label: "Venta cerrada",
      ok: true,
      detail: `${money(values.salePrice ?? 0)}${terms.hasCredit ? `, ${terms.installments} cuotas (vencen el día ${terms.creditDueDay})` : ", de contado"}. ${
        values.buyerPhone ? "Postventa programada." : "Sin teléfono: falta para programar la postventa."
      }`,
    });
  } catch (error) {
    return fail("Venta cerrada", error);
  }

  const painted = await highlightSoldCarAutomatically({
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.year,
    kilometers: vehicle.kilometers,
    color: vehicle.color,
  }).catch(() => null);
  steps.push({
    label: "Lista de precios",
    ok: Boolean(painted?.ok),
    detail: painted?.message ?? "No se pudo revisar la lista de precios.",
  });

  return {
    ok: true,
    steps,
    links: nextDocumentLinks("operacion_finalizada", { clientId, operationId, vehicleId: vehicle.id }).filter((link) =>
      /Compra y Venta|Recibo|Autorización/.test(link.label),
    ),
    vehicle,
  };
}
