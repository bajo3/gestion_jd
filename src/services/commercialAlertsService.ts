import { readStorage, writeStorage } from "@/lib/storage";
import { generateId } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { CommercialAlert, CommercialAlertStatus, CommercialAlertType } from "@/types/commercialAlerts";
import type { Vehicle } from "@/types/vehicles";

const STORAGE_KEY = "gestion-jd-commercial-alerts";
const ALERTS_TABLE = "commercial_alerts";
const ACTIVE_AUTO_STATUSES: CommercialAlertStatus[] = ["pending", "postponed"];
const LOCKED_AUTO_STATUSES: CommercialAlertStatus[] = ["contacted", "dismissed"];

const messageTemplates: Record<CommercialAlertType, string> = {
  credit_installment_10:
    "Hola {client_name}, ¿cómo estás? Soy Felipe de Gestión JD. Te escribo para hacer un seguimiento de tu financiación y saber cómo venís con el auto. Si necesitás revisar alguna opción o consultar por otra unidad, estoy a disposición.",
  post_sale_12_months:
    "Hola {client_name}, ¿cómo estás? Soy Felipe de Gestión JD. Te escribo porque ya pasó un tiempo desde que compraste tu auto con nosotros. Si estás pensando en cambiarlo o querés saber cuánto podemos tomarlo hoy, te puedo ayudar con una tasación y opciones disponibles.",
};

type DbCommercialAlert = {
  id: string;
  vehicle_id?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  alert_type: CommercialAlertType;
  alert_date: string;
  status?: CommercialAlertStatus | null;
  message_template?: string | null;
  notes?: string | null;
  last_contacted_at?: string | null;
  created_at: string;
  updated_at: string;
};

function readLocalAlerts() {
  return readStorage<CommercialAlert[]>(STORAGE_KEY, []);
}

function saveLocalAlerts(alerts: CommercialAlert[]) {
  writeStorage(STORAGE_KEY, alerts);
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addMonths(dateValue: string, months: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setMonth(date.getMonth() + months);
  return toDateOnly(date);
}

function mapDbAlert(alert: DbCommercialAlert): CommercialAlert {
  return {
    id: alert.id,
    vehicleId: alert.vehicle_id,
    clientName: alert.client_name ?? "",
    clientPhone: alert.client_phone ?? "",
    alertType: alert.alert_type,
    alertDate: alert.alert_date,
    status: alert.status ?? "pending",
    messageTemplate: alert.message_template ?? undefined,
    notes: alert.notes ?? "",
    lastContactedAt: alert.last_contacted_at,
    createdAt: alert.created_at,
    updatedAt: alert.updated_at,
  };
}

function alertPayload(alert: CommercialAlert) {
  return {
    id: alert.id,
    vehicle_id: alert.vehicleId ?? null,
    client_name: alert.clientName,
    client_phone: alert.clientPhone,
    alert_type: alert.alertType,
    alert_date: alert.alertDate,
    status: alert.status,
    message_template: alert.messageTemplate ?? null,
    notes: alert.notes ?? null,
    last_contacted_at: alert.lastContactedAt ?? null,
    created_at: alert.createdAt,
    updated_at: alert.updatedAt,
  };
}

async function fetchRemoteAlerts(): Promise<CommercialAlert[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from(ALERTS_TABLE)
      .select("*")
      .order("alert_date", { ascending: true });

    if (error || !data) return null;
    return data.map(mapDbAlert);
  } catch {
    return null;
  }
}

export async function listCommercialAlerts() {
  const remoteAlerts = await fetchRemoteAlerts();
  return remoteAlerts ?? readLocalAlerts();
}

function findLocalVehicleAlert(vehicleId: string, alertType: CommercialAlertType) {
  return readLocalAlerts().find(
    (alert) => alert.vehicleId === vehicleId && alert.alertType === alertType,
  );
}

async function findRemoteVehicleAlert(vehicleId: string, alertType: CommercialAlertType) {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from(ALERTS_TABLE)
      .select("*")
      .eq("vehicle_id", vehicleId)
      .eq("alert_type", alertType)
      .in("status", [...ACTIVE_AUTO_STATUSES, ...LOCKED_AUTO_STATUSES])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return mapDbAlert(data);
  } catch {
    return null;
  }
}

async function saveAlert(alert: CommercialAlert) {
  const now = new Date().toISOString();
  const localAlerts = readLocalAlerts();
  const nextAlert = { ...alert, updatedAt: now };
  const nextAlerts = localAlerts.some((item) => item.id === alert.id)
    ? localAlerts.map((item) => (item.id === alert.id ? nextAlert : item))
    : [nextAlert, ...localAlerts];

  saveLocalAlerts(nextAlerts);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from(ALERTS_TABLE).upsert(alertPayload(nextAlert));
    } catch {
      // fallback local already applied
    }
  }

  return nextAlert;
}

async function upsertVehicleAlert(vehicle: Vehicle, alertType: CommercialAlertType, alertDate: string) {
  if (!alertDate) return;

  const existingAlert =
    (await findRemoteVehicleAlert(vehicle.id, alertType)) ?? findLocalVehicleAlert(vehicle.id, alertType);

  if (existingAlert && LOCKED_AUTO_STATUSES.includes(existingAlert.status)) return;

  const now = new Date().toISOString();
  const baseAlert: CommercialAlert = {
    id: existingAlert?.id ?? generateId(),
    vehicleId: vehicle.id,
    clientName: vehicle.buyerName,
    clientPhone: vehicle.buyerPhone,
    alertType,
    alertDate,
    status: existingAlert?.status ?? "pending",
    messageTemplate: messageTemplates[alertType],
    notes: existingAlert?.notes ?? "",
    lastContactedAt: existingAlert?.lastContactedAt ?? null,
    createdAt: existingAlert?.createdAt ?? now,
    updatedAt: now,
    vehicleBrand: vehicle.brand,
    vehicleModel: vehicle.model,
    vehicleLicensePlate: vehicle.licensePlate,
  };

  await saveAlert(baseAlert);
}

export async function syncCommercialAlertsForVehicle(vehicle: Vehicle) {
  if (vehicle.buyerName && vehicle.buyerPhone && vehicle.exitDate) {
    await upsertVehicleAlert(vehicle, "post_sale_12_months", addMonths(vehicle.exitDate, 12));
  }

  if (vehicle.hasCredit && vehicle.creditStartDate) {
    await upsertVehicleAlert(vehicle, "credit_installment_10", addMonths(vehicle.creditStartDate, 9));
  }
}

export function buildCommercialAlertMessage(alert: CommercialAlert) {
  const template = alert.messageTemplate || messageTemplates[alert.alertType];
  return template.replaceAll("{client_name}", alert.clientName || "cliente");
}

export async function updateCommercialAlertStatus(
  alertId: string,
  status: CommercialAlertStatus,
  updates: Partial<Pick<CommercialAlert, "alertDate" | "notes" | "lastContactedAt">> = {},
) {
  const alerts = await listCommercialAlerts();
  const current = alerts.find((alert) => alert.id === alertId);
  if (!current) return null;

  return saveAlert({
    ...current,
    ...updates,
    status,
  });
}

export async function markCommercialAlertContacted(alertId: string) {
  return updateCommercialAlertStatus(alertId, "contacted", {
    lastContactedAt: new Date().toISOString(),
  });
}

export async function postponeCommercialAlert(alertId: string, days = 30) {
  const alerts = await listCommercialAlerts();
  const current = alerts.find((alert) => alert.id === alertId);
  if (!current) return null;

  const date = new Date(`${current.alertDate}T00:00:00`);
  date.setDate(date.getDate() + days);

  return updateCommercialAlertStatus(alertId, "postponed", {
    alertDate: toDateOnly(date),
  });
}

export async function dismissCommercialAlert(alertId: string) {
  return updateCommercialAlertStatus(alertId, "dismissed");
}
