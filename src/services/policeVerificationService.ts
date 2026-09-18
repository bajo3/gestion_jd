import { readStorage, writeStorage } from "@/lib/storage";
import { generateId } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { PoliceVerification, PoliceVerificationInput } from "@/types/policeVerification";

const STORAGE_KEY = "gestion-jd-police-verifications";
const TABLE = "gestion_jd_police_verifications";
const APP_SOURCE = "gestion_jd";

type DbPoliceVerification = Record<string, unknown> & {
  id: string;
  vehicle_id: string;
  app_source: string;
  created_at: string;
  updated_at: string;
};

const fieldMap: Array<[keyof PoliceVerification, string]> = [
  ["vehicleId", "vehicle_id"], ["status", "status"], ["domain", "domain"], ["plateCopy", "plate_copy"],
  ["brand", "brand"], ["model", "model"], ["vehicleType", "vehicle_type"], ["motorBrand", "motor_brand"],
  ["motorNumber", "motor_number"], ["chassisBrand", "chassis_brand"], ["chassisNumber", "chassis_number"],
  ["category", "category"], ["ownerName", "owner_name"], ["ownerPersonType", "owner_person_type"],
  ["ownerDocumentType", "owner_document_type"], ["ownerDocument", "owner_document"], ["ownerStreet", "owner_street"],
  ["ownerNumber", "owner_number"], ["ownerFloor", "owner_floor"], ["ownerApartment", "owner_apartment"],
  ["ownerPostalCode", "owner_postal_code"], ["ownerLocality", "owner_locality"], ["ownerProvince", "owner_province"],
  ["presenterIsOwner", "presenter_is_owner"], ["presenterName", "presenter_name"],
  ["presenterDocumentType", "presenter_document_type"], ["presenterDocument", "presenter_document"],
  ["presenterStreet", "presenter_street"], ["presenterNumber", "presenter_number"], ["presenterFloor", "presenter_floor"],
  ["presenterApartment", "presenter_apartment"], ["presenterPostalCode", "presenter_postal_code"],
  ["presenterLocality", "presenter_locality"], ["presenterProvince", "presenter_province"],
  ["contactEmail", "contact_email"], ["contactEmailRepeat", "contact_email_repeat"], ["phoneArea", "phone_area"],
  ["phoneNumber", "phone_number"], ["notes", "notes"], ["preparedAt", "prepared_at"],
];

function readLocal() {
  const value = readStorage<PoliceVerification[]>(STORAGE_KEY, []);
  return Array.isArray(value) ? value : [];
}

function saveLocal(values: PoliceVerification[]) {
  writeStorage(STORAGE_KEY, values);
}

function mapDb(row: DbPoliceVerification): PoliceVerification {
  const result = {} as PoliceVerification;
  result.id = row.id;
  result.createdAt = String(row.created_at);
  result.updatedAt = String(row.updated_at);

  for (const [property, column] of fieldMap) {
    const value = row[column];
    (result as Record<string, unknown>)[property] = value ?? (property === "presenterIsOwner" ? true : "");
  }

  return result;
}

function payload(values: PoliceVerification) {
  const result: Record<string, unknown> = {
    id: values.id,
    app_source: APP_SOURCE,
    created_at: values.createdAt,
    updated_at: values.updatedAt,
  };

  for (const [property, column] of fieldMap) result[column] = values[property];
  return result;
}

export async function getPoliceVerificationByVehicle(vehicleId: string) {
  const local = readLocal().find((item) => item.vehicleId === vehicleId) ?? null;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("app_source", APP_SOURCE)
        .eq("vehicle_id", vehicleId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) return mapDb(data as DbPoliceVerification);
    } catch {
      // La copia local mantiene el flujo disponible si Supabase no responde.
    }
  }

  return local;
}

export async function savePoliceVerification(input: PoliceVerificationInput & { id?: string; createdAt?: string }) {
  const now = new Date().toISOString();
  const existing = input.id ? readLocal().find((item) => item.id === input.id) : null;
  const value: PoliceVerification = {
    ...input,
    id: input.id ?? existing?.id ?? generateId(),
    createdAt: input.createdAt ?? existing?.createdAt ?? now,
    updatedAt: now,
  };

  const local = readLocal().filter((item) => item.id !== value.id && item.vehicleId !== value.vehicleId);
  saveLocal([value, ...local]);

  let persisted = false;
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.from(TABLE).upsert(payload(value), { onConflict: "vehicle_id" });
      persisted = !error;
    } catch {
      persisted = false;
    }
  }

  return { value, persisted };
}
