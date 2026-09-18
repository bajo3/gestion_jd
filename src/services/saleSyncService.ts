import { parseNumberish } from "@/lib/utils";
import {
  finalizeSaleAtomic,
  getWorkflowContext,
  markLocalOperationFinalized,
  normalizeDni,
  saveClientDocument,
  saveDateroWorkflow,
} from "@/services/clientsService";
import { normalizePlate } from "@/services/documentsService";
import { createVehicle, listVehicles, updateVehicle } from "@/services/vehiclesService";
import type { ClientDocument } from "@/types/clients";
import type { CompraVentaFormValues, DateroFormValues } from "@/types/forms";
import type { Vehicle, VehicleInput } from "@/types/vehicles";

export type SaleSyncLink = { to: string; label: string };

export type SaleSyncResult = {
  messages: string[];
  links: SaleSyncLink[];
  clientId?: string;
  operationId?: string;
  document?: ClientDocument;
};

const OPEN_STATUSES: Vehicle["status"][] = ["ingresado", "en_preparacion", "publicado"];

const emptyDatero: DateroFormValues = {
  nombre: "",
  dni: "",
  fechaNacimiento: "",
  lugar: "",
  direccionReal: "",
  direccionDni: "",
  localidad: "",
  codigoPostal: "",
  provincia: "",
  telefono: "",
  celular: "",
  email: "",
  instagram: "",
  cuil: "",
  condicionFiscal: "",
  estadoCivil: "",
  detalles: "",
  conyugeNombre: "",
  conyugeDni: "",
  fechaOperacion: "",
  dominio: "",
  tomaCredito: "no",
  creditoTotal: "",
  creditoCuotas: "",
  entregaPpa: "no",
  ppaDominio: "",
  ppaMarca: "",
  ppaModelo: "",
  ppaAnio: "",
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isoDate(value: unknown) {
  const raw = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

function today() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function firstInteger(value: unknown) {
  const match = text(value).match(/\d+/);
  return match ? Number(match[0]) : null;
}

function toInput(vehicle: Vehicle): VehicleInput {
  const input: Partial<Vehicle> = { ...vehicle };
  delete input.id;
  delete input.createdAt;
  delete input.updatedAt;
  delete input.files;
  return input as VehicleInput;
}

function emptyVehicleInput(licensePlate: string): VehicleInput {
  return {
    brand: "",
    model: "",
    licensePlate,
    year: null,
    vin: "",
    engine: "",
    color: "",
    kilometers: null,
    entryDate: "",
    exitDate: "",
    status: "ingresado",
    observations: "",
    purchasePrice: null,
    salePrice: null,
    buyerName: "",
    buyerPhone: "",
    hasCredit: false,
    creditStartDate: "",
    creditTotalInstallments: null,
    creditDueDay: null,
  };
}

/** Completa solo los campos vacios: lo que se cargo a mano en el auto no se pisa. */
function fillEmpty(base: VehicleInput, patch: Partial<VehicleInput>) {
  const next: VehicleInput = { ...base };
  const target = next as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    const current = target[key];
    const isEmpty = current === null || current === undefined || current === "";
    const hasValue = value !== null && value !== undefined && value !== "";
    if (isEmpty && hasValue) target[key] = value;
  }
  return next;
}

function findVehicle(vehicles: Vehicle[], vehicleId: string | undefined, plate: string) {
  if (vehicleId) {
    const byId = vehicles.find((vehicle) => vehicle.id === vehicleId);
    if (byId) return byId;
  }
  const normalized = normalizePlate(plate);
  return normalized ? vehicles.find((vehicle) => normalizePlate(vehicle.licensePlate) === normalized) : undefined;
}

/**
 * Deja el auto vendido en el historial como "reservado" con los datos del
 * comprador. El paso a "vendido" lo hace siempre la finalizacion de la
 * operacion (valida precio, fecha y credito en la base).
 */
async function prepareSoldVehicle(
  vehicles: Vehicle[],
  data: { vehicleId?: string; licensePlate: string; buyerName: string; buyerPhone: string; details: Partial<VehicleInput> },
) {
  const existing = findVehicle(vehicles, data.vehicleId, data.licensePlate);

  if (existing) {
    const input = fillEmpty(toInput(existing), data.details);
    if (OPEN_STATUSES.includes(input.status)) {
      input.status = "reservado";
      if (data.buyerName) input.buyerName = data.buyerName;
      if (data.buyerPhone) input.buyerPhone = data.buyerPhone;
    }

    const changed = JSON.stringify(input) !== JSON.stringify(toInput(existing));
    if (!changed) return { vehicle: existing, message: null };
    const vehicle = await updateVehicle(existing.id, input);
    return { vehicle, message: `Auto ${vehicle.licensePlate} actualizado en Historial de Autos.` };
  }

  if (!normalizePlate(data.licensePlate)) return null;

  const vehicle = await createVehicle({
    ...fillEmpty(emptyVehicleInput(data.licensePlate.toUpperCase()), data.details),
    status: "reservado",
    buyerName: data.buyerName,
    buyerPhone: data.buyerPhone,
  });
  return { vehicle, message: `Auto ${vehicle.licensePlate} agregado al Historial de Autos.` };
}

/** El auto que el cliente deja como parte de pago entra al historial como ingresado. */
async function registerTradeIn(vehicles: Vehicle[], values: DateroFormValues) {
  const plate = text(values.ppaDominio);
  if (values.entregaPpa !== "si" || !normalizePlate(plate)) return null;
  if (findVehicle(vehicles, undefined, plate)) return `El auto entregado ${plate.toUpperCase()} ya estaba en el historial.`;

  const vehicle = await createVehicle({
    ...emptyVehicleInput(plate.toUpperCase()),
    brand: text(values.ppaMarca),
    model: text(values.ppaModelo),
    year: firstInteger(values.ppaAnio),
    entryDate: isoDate(values.fechaOperacion) || today(),
    status: "ingresado",
    observations: [
      "Recibido como parte de pago",
      text(values.nombre) && `de ${text(values.nombre)}`,
      text(values.dominio) && `en la venta de ${text(values.dominio).toUpperCase()}`,
    ]
      .filter(Boolean)
      .join(" "),
  });
  return `Auto entregado ${vehicle.licensePlate} agregado al Historial de Autos.`;
}

function operationLink(clientId: string, operationId: string): SaleSyncLink {
  return { to: `/operacion-finalizada?clientId=${clientId}&operationId=${operationId}`, label: "Ir a Operacion finalizada" };
}

/**
 * Al generar el Datero: guarda cliente y operacion, deja el auto vendido
 * reservado para el comprador y suma el auto entregado al historial.
 */
export async function syncDateroGenerated(
  values: DateroFormValues,
  context: { operationId?: string; vehicleId?: string; documentId?: string },
): Promise<SaleSyncResult> {
  const messages: string[] = [];
  const links: SaleSyncLink[] = [];

  if (!normalizeDni(values.dni)) {
    return { messages: ["Falta el DNI: el cliente no se guardo automaticamente."], links };
  }

  const vehicles = await listVehicles();
  const sold = await prepareSoldVehicle(vehicles, {
    vehicleId: context.vehicleId,
    licensePlate: text(values.dominio),
    buyerName: text(values.nombre),
    buyerPhone: text(values.celular) || text(values.telefono),
    details: {},
  });

  const saved = await saveDateroWorkflow(values, { operationId: context.operationId, vehicleId: sold?.vehicle.id });
  const document = await saveClientDocument({
    id: context.documentId,
    clientId: saved.client.id,
    operationId: saved.operation.id,
    documentType: "datero",
    status: "generado",
    data: values as unknown as Record<string, unknown>,
  });

  messages.push(`Cliente ${saved.client.nombre} guardado en Clientes.`);
  if (saved.warning || document.warning) messages.push(`Quedo como borrador local: ${saved.warning || document.warning}`);
  if (sold?.message) messages.push(sold.message);

  const tradeIn = await registerTradeIn(sold ? [...vehicles, sold.vehicle] : vehicles, values);
  if (tradeIn) messages.push(tradeIn);

  if (saved.operation.status !== "finalizada") {
    messages.push("La venta se cierra al generar el Compra y Venta o desde Operacion finalizada.");
    links.push(operationLink(saved.client.id, saved.operation.id));
  }

  return { messages, links, clientId: saved.client.id, operationId: saved.operation.id, document: document.document };
}

/**
 * Al generar el Compra y Venta: completa el cliente y la operacion y, si hay
 * precio y la venta es de contado, la finaliza (el auto queda vendido).
 */
export async function syncCompraVentaGenerated(
  values: CompraVentaFormValues,
  context: { operationId?: string; vehicleId?: string; documentSaved: boolean },
): Promise<SaleSyncResult> {
  const messages: string[] = [];
  const links: SaleSyncLink[] = [];
  const dni = text(values.numeroDoc);

  if (!normalizeDni(dni)) {
    return { messages: ["Falta el DNI: el cliente y la venta no se cargaron automaticamente."], links };
  }

  const saleDate = isoDate(values.fecha) || today();
  const current = await getWorkflowContext({ dni, operationId: context.operationId });
  // Sin operacion elegida se retoma solo una en borrador: si el cliente ya
  // compro antes, esta es una venta nueva.
  const openOperation =
    current.operation &&
    (context.operationId ? current.operation.status !== "cancelada" : current.operation.status === "borrador")
      ? current.operation
      : null;

  // El cliente puede venir de un Datero: se conservan sus datos y se completan con el boleto.
  const clientData = { ...emptyDatero, ...(current.client?.data as Partial<DateroFormValues> | undefined) };
  const base: DateroFormValues = openOperation
    ? { ...clientData, ...(openOperation.data as Partial<DateroFormValues>) }
    : {
        ...clientData,
        // Venta nueva: no se arrastran los datos de la operacion anterior.
        fechaOperacion: "",
        dominio: "",
        tomaCredito: "no",
        creditoTotal: "",
        creditoCuotas: "",
        entregaPpa: "no",
        ppaDominio: "",
        ppaMarca: "",
        ppaModelo: "",
        ppaAnio: "",
      };
  const dateroValues: DateroFormValues = {
    ...base,
    nombre: text(values.recibido) || base.nombre,
    dni,
    celular: text(values.telefono) || base.celular,
    direccionReal: text(values.domicilio) || base.direccionReal,
    fechaOperacion: base.fechaOperacion || saleDate,
    dominio: text(values.dominio) || base.dominio,
  };

  const vehicles = await listVehicles();
  const sold = await prepareSoldVehicle(vehicles, {
    vehicleId: context.vehicleId || openOperation?.vehicleId || undefined,
    licensePlate: text(values.dominio),
    buyerName: dateroValues.nombre,
    buyerPhone: dateroValues.celular || dateroValues.telefono,
    details: {
      brand: text(values.marca),
      model: text(values.modelo),
      engine: text(values.nMotor),
      vin: text(values.nChasis),
    },
  });

  const saved = await saveDateroWorkflow(dateroValues, {
    operationId: openOperation?.id,
    vehicleId: sold?.vehicle.id,
  });

  if (!context.documentSaved) {
    await saveClientDocument({
      clientId: saved.client.id,
      operationId: saved.operation.id,
      documentType: "compra_venta",
      status: "generado",
      data: values as unknown as Record<string, unknown>,
    });
  }

  messages.push(`Cliente ${saved.client.nombre} guardado en Clientes.`);
  if (saved.warning) messages.push(`Quedo como borrador local: ${saved.warning}`);
  if (sold?.message) messages.push(sold.message);

  const vehicleId = saved.operation.vehicleId || sold?.vehicle.id;
  const salePrice = parseNumberish(values.cantidadNum);
  const finishLater = operationLink(saved.client.id, saved.operation.id);

  if (saved.operation.status === "finalizada") {
    messages.push("La operacion ya estaba finalizada.");
  } else if (!vehicleId) {
    messages.push("Falta la patente: cerra la venta desde Operacion finalizada.");
    links.push(finishLater);
  } else if (!(salePrice > 0)) {
    messages.push("Falta el precio: cerra la venta desde Operacion finalizada.");
    links.push(finishLater);
  } else if (dateroValues.tomaCredito === "si") {
    messages.push("Venta con credito: completa cuotas y vencimiento en Operacion finalizada para cerrarla.");
    links.push(finishLater);
  } else {
    try {
      const result = await finalizeSaleAtomic({
        operationId: saved.operation.id,
        vehicleId,
        salePrice,
        buyerName: dateroValues.nombre,
        buyerPhone: dateroValues.celular || dateroValues.telefono,
        hasCredit: false,
        saleDate,
      });
      if (result.mode === "remote") {
        markLocalOperationFinalized(saved.operation.id, vehicleId);
        messages.push("Venta finalizada: el auto quedo como vendido en el historial.");
      } else {
        messages.push("Sin conexion con la base: la venta no se pudo finalizar todavia.");
        links.push(finishLater);
      }
    } catch (error) {
      messages.push(error instanceof Error ? error.message : "No se pudo finalizar la venta.");
      links.push(finishLater);
    }
  }

  return { messages, links, clientId: saved.client.id, operationId: saved.operation.id };
}
