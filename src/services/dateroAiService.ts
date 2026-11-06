import { toShared, type SharedData } from "@/lib/sharedData";
import { normalizePlate } from "@/services/documentsService";
import { listVehicles } from "@/services/vehiclesService";
import type { DateroFormValues } from "@/types/forms";
import type { Vehicle } from "@/types/vehicles";

/** Lo que devuelve /api/datero-ai, ya limpio. */
type AiOperation = {
  precio: number;
  moneda: "ARS" | "USD";
  entregaDinero: number;
  sena: number;
  formaPago: string;
  usado: { marca: string; modelo: string; anio: number; km: number; dominio: string; valorToma: number };
  credito: { monto: number; cuotas: number; valorCuota: number };
  tipoVehiculo: string;
  observaciones: string;
  dudas: string[];
};

export type DateroAiResult =
  | { ok: true; shared: SharedData; summary: string[]; doubts: string[] }
  | { ok: false; error: string };

function money(value: number) {
  return value > 0 ? value.toLocaleString("es-AR") : "";
}

function join(...parts: string[]) {
  return parts.map((part) => part.trim()).filter(Boolean).join(" ");
}

/** Traduce la respuesta de la IA al formato comun que leen todos los documentos. */
function toOperationShared(operation: AiOperation): SharedData {
  const { usado, credito } = operation;
  const hasMoney = operation.precio > 0 || operation.entregaDinero > 0 || operation.sena > 0;
  const hasCredit = credito.monto > 0 || credito.cuotas > 0;

  const shared: SharedData = {
    precio: money(operation.precio),
    moneda: hasMoney ? operation.moneda : "",
    entregaEfectivo: money(operation.entregaDinero),
    sena: money(operation.sena),
    formaPago: operation.sena > 0 || operation.entregaDinero > 0 ? operation.formaPago : "",
    tipo: operation.tipoVehiculo,
    observaciones: operation.observaciones,
    usadoModelo: join(usado.marca, usado.modelo),
    usadoAnio: usado.anio ? String(usado.anio) : "",
    usadoKm: usado.km ? String(usado.km) : "",
    usadoToma: money(usado.valorToma),
    tomaCredito: hasCredit ? "si" : "",
    creditoTotal: money(credito.monto),
    creditoCuotas: credito.cuotas
      ? `${credito.cuotas} cuotas${credito.valorCuota ? ` de $${money(credito.valorCuota)}` : ""}`
      : "",
  };

  return Object.fromEntries(Object.entries(shared).filter(([, value]) => value)) as SharedData;
}

/** Renglones para mostrarle a quien carga el Datero que entendio la IA. */
function summarize(shared: SharedData) {
  const currency = shared.moneda === "USD" ? "US$" : "$";
  const lines: string[] = [];
  if (shared.precio) lines.push(`Precio: ${currency} ${shared.precio}`);
  if (shared.entregaEfectivo) lines.push(`Entrega en dinero: ${currency} ${shared.entregaEfectivo}`);
  if (shared.sena) lines.push(`Seña: ${currency} ${shared.sena}${shared.formaPago ? ` (${shared.formaPago.toLowerCase()})` : ""}`);
  if (shared.usadoModelo) {
    lines.push(
      `Usado: ${join(shared.usadoModelo, shared.usadoAnio ?? "")}${shared.usadoKm ? ` · ${Number(shared.usadoKm).toLocaleString("es-AR")} km` : ""}${shared.usadoToma ? ` · se toma en $ ${shared.usadoToma}` : ""}`,
    );
  }
  if (shared.tomaCredito === "si") {
    lines.push(`Crédito: ${[shared.creditoTotal ? `$ ${shared.creditoTotal}` : "", shared.creditoCuotas].filter(Boolean).join(" en ")}`);
  }
  if (shared.tipo) lines.push(`Tipo de auto: ${shared.tipo}`);
  if (shared.observaciones) lines.push(`Condiciones para el boleto: ${shared.observaciones}`);
  return lines;
}

async function findVehicle(values: DateroFormValues, vehicle?: Vehicle | null) {
  if (vehicle) return vehicle;
  const plate = normalizePlate(values.dominio);
  if (!plate) return null;
  const vehicles = await listVehicles().catch(() => []);
  return vehicles.find((item) => normalizePlate(item.licensePlate) === plate) ?? null;
}

/**
 * Lee con IA las condiciones de la venta escritas en "Detalles" (precio, entrega, seña, usado,
 * credito) y las devuelve listas para guardarse en la operacion: asi Compra y Venta, Recibo,
 * Presupuesto, Operacion finalizada y Autorizacion se abren completos.
 *
 * Devuelve null si no hay detalles escritos. Lo que el Datero ya trae cargado en sus propios
 * campos (credito, auto que entrega) siempre gana sobre lo que entienda la IA.
 */
export async function completeDateroWithAi(values: DateroFormValues, vehicle?: Vehicle | null): Promise<DateroAiResult | null> {
  if (!values.detalles.trim()) return null;

  const car = await findVehicle(values, vehicle);
  try {
    const response = await fetch("/api/datero-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fechaOperacion: values.fechaOperacion,
        detalles: values.detalles,
        vehiculo: car
          ? { marca: car.brand, modelo: car.model, anio: car.year ?? "", dominio: car.licensePlate }
          : { dominio: values.dominio },
        credito: { tomaCredito: values.tomaCredito, total: values.creditoTotal, cuotas: values.creditoCuotas },
        usado: {
          entrega: values.entregaPpa,
          dominio: values.ppaDominio,
          marca: values.ppaMarca,
          modelo: values.ppaModelo,
          anio: values.ppaAnio,
        },
      }),
    });
    const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; operation?: AiOperation } | null;
    if (!body?.ok || !body.operation) {
      return { ok: false, error: body?.error || `La IA no respondió (código ${response.status}).` };
    }

    const fromDatero = toShared("datero", values as unknown as Record<string, unknown>);
    const shared = Object.fromEntries(
      Object.entries(toOperationShared(body.operation)).filter(([key]) => {
        const own = fromDatero[key as keyof SharedData];
        // "Toma credito: no" es lo que trae el Datero sin tocar: no cuenta como dato cargado.
        return !own || (key === "tomaCredito" && own === "no");
      }),
    ) as SharedData;

    return { ok: true, shared, summary: summarize({ ...fromDatero, ...shared }), doubts: body.operation.dudas };
  } catch {
    return { ok: false, error: "No se pudo conectar con la IA." };
  }
}
