import { readStorage, writeStorage } from "@/lib/storage";
import { formatCurrency, formatDate, generateId } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { VehicleEvent, VehicleEventInput, VehicleEventType, VehicleFieldChange } from "@/types/vehicleEvents";
import type { Vehicle, VehicleInput } from "@/types/vehicles";

const STORAGE_KEY = "gestion-jd-vehicle-events";
const APP_SOURCE = "gestion_jd";
const EVENTS_TABLE = "gestion_jd_vehicle_events";

const statusLabels: Record<string, string> = {
  ingresado: "Ingresado",
  en_preparacion: "En preparacion",
  publicado: "Publicado",
  reservado: "Reservado",
  vendido: "Vendido",
  egresado: "Egresado",
  archivado: "Archivado",
};

type FieldKind = "text" | "money" | "date" | "number" | "status" | "boolean";

type FieldSpec = {
  label: string;
  kind: FieldKind;
  /** Bucket que agrupa el cambio en un evento con sentido comercial. */
  group: "status" | "price" | "buyer" | "credit" | "general";
};

const trackedFields: Partial<Record<keyof VehicleInput, FieldSpec>> = {
  status: { label: "Estado", kind: "status", group: "status" },
  exitDate: { label: "Fecha de egreso", kind: "date", group: "status" },
  entryDate: { label: "Fecha de ingreso", kind: "date", group: "general" },
  salePrice: { label: "Precio de venta", kind: "money", group: "price" },
  purchasePrice: { label: "Precio de compra", kind: "money", group: "price" },
  buyerName: { label: "Comprador", kind: "text", group: "buyer" },
  buyerPhone: { label: "Telefono del comprador", kind: "text", group: "buyer" },
  hasCredit: { label: "Financiacion", kind: "boolean", group: "credit" },
  creditStartDate: { label: "Inicio del credito", kind: "date", group: "credit" },
  creditTotalInstallments: { label: "Cuotas", kind: "number", group: "credit" },
  creditDueDay: { label: "Dia de vencimiento", kind: "number", group: "credit" },
  brand: { label: "Marca", kind: "text", group: "general" },
  model: { label: "Modelo", kind: "text", group: "general" },
  year: { label: "Anio", kind: "number", group: "general" },
  licensePlate: { label: "Patente", kind: "text", group: "general" },
  kilometers: { label: "Kilometros", kind: "number", group: "general" },
  color: { label: "Color", kind: "text", group: "general" },
  vin: { label: "Chasis", kind: "text", group: "general" },
  engine: { label: "Motor", kind: "text", group: "general" },
  observations: { label: "Observaciones", kind: "text", group: "general" },
};

function formatValue(value: unknown, kind: FieldKind) {
  if (value === null || value === undefined || value === "") return "vacio";

  switch (kind) {
    case "money":
      return typeof value === "number" ? formatCurrency(value) : String(value);
    case "date":
      return formatDate(String(value));
    case "number":
      return typeof value === "number" ? value.toLocaleString("es-AR") : String(value);
    case "status":
      return statusLabels[String(value)] ?? String(value);
    case "boolean":
      return value ? "si" : "no";
    default:
      return String(value);
  }
}

function isSameValue(a: unknown, b: unknown) {
  const normalize = (value: unknown) => (value === null || value === undefined ? "" : value);
  return normalize(a) === normalize(b);
}

/** Compara dos estados del vehiculo y devuelve solo los campos que realmente cambiaron. */
export function buildVehicleDiff(
  previous: Partial<VehicleInput> | null,
  next: Partial<VehicleInput>,
): VehicleFieldChange[] {
  if (!previous) return [];

  const changes: VehicleFieldChange[] = [];

  for (const [field, spec] of Object.entries(trackedFields) as [keyof VehicleInput, FieldSpec][]) {
    const before = previous[field];
    const after = next[field];
    if (isSameValue(before, after)) continue;

    changes.push({
      field,
      label: spec.label,
      from: formatValue(before, spec.kind),
      to: formatValue(after, spec.kind),
    });
  }

  return changes;
}

function groupOf(field: string) {
  return trackedFields[field as keyof VehicleInput]?.group ?? "general";
}

function summarizeGroup(
  group: string,
  changes: VehicleFieldChange[],
  next: Partial<VehicleInput>,
): { type: VehicleEventType; summary: string } {
  const statusChange = changes.find((change) => change.field === "status");

  if (group === "status" && statusChange) {
    if (next.status === "vendido") {
      const buyer = next.buyerName ? ` a ${next.buyerName}` : "";
      const price = typeof next.salePrice === "number" ? ` por ${formatCurrency(next.salePrice)}` : "";
      return { type: "sold", summary: `Vendido${buyer}${price}` };
    }

    return { type: "status_changed", summary: `Estado: ${statusChange.from} → ${statusChange.to}` };
  }

  if (group === "price") {
    const sale = changes.find((change) => change.field === "salePrice");
    const target = sale ?? changes[0];
    return { type: "price_changed", summary: `${target.label}: ${target.from} → ${target.to}` };
  }

  if (group === "buyer") {
    return {
      type: "buyer_updated",
      summary: next.buyerName ? `Datos del comprador: ${next.buyerName}` : "Se actualizaron los datos del comprador",
    };
  }

  if (group === "credit") {
    if (next.hasCredit) {
      const installments = next.creditTotalInstallments ? `${next.creditTotalInstallments} cuotas` : "financiacion activa";
      return { type: "credit_updated", summary: `Financiacion: ${installments}` };
    }
    return { type: "credit_updated", summary: "Se actualizo la financiacion" };
  }

  if (changes.length === 1) {
    return { type: "updated", summary: `${changes[0].label}: ${changes[0].from} → ${changes[0].to}` };
  }

  return {
    type: "updated",
    summary: `Se actualizaron ${changes.length} campos: ${changes.map((change) => change.label.toLowerCase()).join(", ")}`,
  };
}

function mapDbEvent(row: Record<string, unknown>): VehicleEvent {
  return {
    id: String(row.id),
    vehicleId: String(row.vehicle_id),
    type: (row.event_type as VehicleEventType) ?? "updated",
    summary: String(row.summary ?? ""),
    detail: (row.detail as string) ?? undefined,
    changes: Array.isArray(row.changes) ? (row.changes as VehicleFieldChange[]) : [],
    actor: (row.actor as string) ?? undefined,
    occurredAt: String(row.occurred_at ?? row.created_at),
    createdAt: String(row.created_at),
  };
}

function readLocalEvents() {
  return readStorage<VehicleEvent[]>(STORAGE_KEY, []);
}

function saveLocalEvents(events: VehicleEvent[]) {
  // El historial local es solo un respaldo de lectura: se acota para no inflar localStorage.
  writeStorage(STORAGE_KEY, events.slice(0, 500));
}

export async function logVehicleEvent(input: VehicleEventInput): Promise<VehicleEvent> {
  const event: VehicleEvent = {
    ...input,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };

  saveLocalEvents([event, ...readLocalEvents()]);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from(EVENTS_TABLE).insert({
        id: event.id,
        app_source: APP_SOURCE,
        vehicle_id: event.vehicleId,
        event_type: event.type,
        summary: event.summary,
        detail: event.detail ?? null,
        changes: event.changes,
        actor: event.actor ?? null,
        occurred_at: event.occurredAt,
        created_at: event.createdAt,
      });
    } catch {
      // El respaldo local ya quedo aplicado.
    }
  }

  return event;
}

/**
 * Registra los cambios de una edicion como uno o mas eventos con sentido comercial
 * (venta, precio, comprador, credito, resto). Devuelve los eventos creados.
 */
export async function recordVehicleChanges(
  vehicleId: string,
  previous: Partial<VehicleInput> | null,
  next: Partial<VehicleInput>,
  options: { actor?: string; occurredAt?: string } = {},
): Promise<VehicleEvent[]> {
  const changes = buildVehicleDiff(previous, next);
  if (!changes.length) return [];

  const occurredAt = options.occurredAt ?? new Date().toISOString();
  const buckets = new Map<string, VehicleFieldChange[]>();

  for (const change of changes) {
    const group = groupOf(change.field);
    buckets.set(group, [...(buckets.get(group) ?? []), change]);
  }

  const events: VehicleEvent[] = [];

  for (const [group, groupChanges] of buckets) {
    const { type, summary } = summarizeGroup(group, groupChanges, next);
    events.push(
      await logVehicleEvent({
        vehicleId,
        type,
        summary,
        changes: groupChanges,
        actor: options.actor,
        occurredAt,
      }),
    );
  }

  return events;
}

export async function listVehicleEvents(vehicleId: string): Promise<VehicleEvent[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from(EVENTS_TABLE)
        .select("*")
        .eq("app_source", APP_SOURCE)
        .eq("vehicle_id", vehicleId)
        .order("occurred_at", { ascending: false });

      if (!error && data) return data.map(mapDbEvent);
    } catch {
      // Cae al respaldo local.
    }
  }

  return readLocalEvents()
    .filter((event) => event.vehicleId === vehicleId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

/** Ultimos movimientos de todos los autos, para el panel de ventas. */
export async function listRecentVehicleEvents(limit = 20): Promise<VehicleEvent[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from(EVENTS_TABLE)
        .select("*")
        .eq("app_source", APP_SOURCE)
        .order("occurred_at", { ascending: false })
        .limit(limit);

      if (!error && data) return data.map(mapDbEvent);
    } catch {
      // Cae al respaldo local.
    }
  }

  return readLocalEvents()
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, limit);
}

/** Deja solo los campos editables del vehiculo, que son los que se comparan en el diff. */
export function vehicleFromEventSource(vehicle: Vehicle): Partial<VehicleInput> {
  const input: Partial<VehicleInput> = {};

  for (const field of Object.keys(trackedFields) as (keyof VehicleInput)[]) {
    input[field] = vehicle[field] as never;
  }

  return input;
}
