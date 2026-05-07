import { readStorage, writeStorage } from "@/lib/storage";
import { generateId } from "@/lib/utils";
import { syncCommercialAlertsForVehicle } from "@/services/commercialAlertsService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { Vehicle, VehicleFile, VehicleInput } from "@/types/vehicles";

const STORAGE_KEY = "gestion-jd-vehicles";
const APP_SOURCE = "gestion_jd";
const VEHICLES_TABLE = "gestion_jd_vehicles";
const VEHICLE_DOCUMENTS_TABLE = "vehicle_documents";

function readLocalVehicles() {
  return readStorage<Vehicle[]>(STORAGE_KEY, []);
}

function saveLocalVehicles(vehicles: Vehicle[]) {
  writeStorage(STORAGE_KEY, vehicles);
}

async function fetchSupabaseVehicles(): Promise<Vehicle[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const [{ data: vehicles, error: vehicleError }, { data: files, error: filesError }] = await Promise.all([
      supabase
        .from(VEHICLES_TABLE)
        .select("*")
        .eq("app_source", APP_SOURCE)
        .order("created_at", { ascending: false }),
      supabase
        .from(VEHICLE_DOCUMENTS_TABLE)
        .select("*")
        .eq("app_source", APP_SOURCE)
        .order("created_at", { ascending: false }),
    ]);

    if (vehicleError || filesError || !vehicles) return null;

    return vehicles.map((vehicle) => ({
      id: vehicle.id,
      brand: vehicle.brand ?? "",
      model: vehicle.model ?? "",
      licensePlate: vehicle.license_plate ?? "",
      year: vehicle.year ?? null,
      vin: vehicle.vin ?? "",
      engine: vehicle.engine ?? "",
      color: vehicle.color ?? "",
      kilometers: vehicle.kilometers ?? null,
      entryDate: vehicle.entry_date ?? "",
      exitDate: vehicle.exit_date ?? "",
      status: vehicle.status ?? "ingresado",
      observations: vehicle.observations ?? "",
      purchasePrice: vehicle.purchase_price ?? null,
      salePrice: vehicle.sale_price ?? null,
      buyerName: vehicle.buyer_name ?? "",
      buyerPhone: vehicle.buyer_phone ?? "",
      hasCredit: Boolean(vehicle.has_credit),
      creditStartDate: vehicle.credit_start_date ?? "",
      creditTotalInstallments: vehicle.credit_total_installments ?? null,
      creditDueDay: vehicle.credit_due_day ?? null,
      createdAt: vehicle.created_at,
      updatedAt: vehicle.updated_at,
      files: (files ?? [])
        .filter((file) => file.vehicle_id === vehicle.id)
        .map(
          (file): VehicleFile => ({
            id: file.id,
            vehicleId: file.vehicle_id,
            fileName: file.file_name,
            fileType: file.file_type,
            fileUrl: file.file_url ?? undefined,
            category: file.category,
            notes: file.notes ?? "",
            createdAt: file.created_at,
          }),
        ),
    }));
  } catch {
    return null;
  }
}

export async function listVehicles() {
  const remoteVehicles = await fetchSupabaseVehicles();
  return remoteVehicles ?? readLocalVehicles();
}

export async function getVehicleById(id: string) {
  const vehicles = await listVehicles();
  return vehicles.find((vehicle) => vehicle.id === id) ?? null;
}

export async function createVehicle(input: VehicleInput) {
  const now = new Date().toISOString();
  const vehicle: Vehicle = {
    ...input,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    files: [],
  };

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from(VEHICLES_TABLE).insert({
        id: vehicle.id,
        app_source: APP_SOURCE,
        brand: vehicle.brand,
        model: vehicle.model,
        license_plate: vehicle.licensePlate,
        year: vehicle.year,
        vin: vehicle.vin,
        engine: vehicle.engine,
        color: vehicle.color,
        kilometers: vehicle.kilometers,
        entry_date: vehicle.entryDate || null,
        exit_date: vehicle.exitDate || null,
        status: vehicle.status,
        observations: vehicle.observations,
        purchase_price: vehicle.purchasePrice,
        sale_price: vehicle.salePrice,
        buyer_name: vehicle.buyerName || null,
        buyer_phone: vehicle.buyerPhone || null,
        has_credit: vehicle.hasCredit,
        credit_start_date: vehicle.creditStartDate || null,
        credit_total_installments: vehicle.creditTotalInstallments,
        credit_due_day: vehicle.creditDueDay,
        created_at: vehicle.createdAt,
        updated_at: vehicle.updatedAt,
      });
    } catch {
      // fallback local
    }
  }

  const localVehicles = readLocalVehicles();
  saveLocalVehicles([vehicle, ...localVehicles]);
  await syncCommercialAlertsForVehicle(vehicle);
  return vehicle;
}

export async function updateVehicle(id: string, input: VehicleInput) {
  const updatedVehicle: Vehicle = {
    ...input,
    id,
    createdAt: readLocalVehicles().find((vehicle) => vehicle.id === id)?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    files: readLocalVehicles().find((vehicle) => vehicle.id === id)?.files ?? [],
  };

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from(VEHICLES_TABLE)
        .update({
          brand: updatedVehicle.brand,
          model: updatedVehicle.model,
          license_plate: updatedVehicle.licensePlate,
          year: updatedVehicle.year,
          vin: updatedVehicle.vin,
          engine: updatedVehicle.engine,
          color: updatedVehicle.color,
          kilometers: updatedVehicle.kilometers,
          entry_date: updatedVehicle.entryDate || null,
          exit_date: updatedVehicle.exitDate || null,
          status: updatedVehicle.status,
          observations: updatedVehicle.observations,
          purchase_price: updatedVehicle.purchasePrice,
          sale_price: updatedVehicle.salePrice,
          buyer_name: updatedVehicle.buyerName || null,
          buyer_phone: updatedVehicle.buyerPhone || null,
          has_credit: updatedVehicle.hasCredit,
          credit_start_date: updatedVehicle.creditStartDate || null,
          credit_total_installments: updatedVehicle.creditTotalInstallments,
          credit_due_day: updatedVehicle.creditDueDay,
          updated_at: updatedVehicle.updatedAt,
        })
        .eq("id", id)
        .eq("app_source", APP_SOURCE);
    } catch {
      // fallback local
    }
  }

  const localVehicles = readLocalVehicles().map((vehicle) =>
    vehicle.id === id ? updatedVehicle : vehicle,
  );
  saveLocalVehicles(localVehicles);
  await syncCommercialAlertsForVehicle(updatedVehicle);
  return updatedVehicle;
}

export async function attachFilesToVehicle(id: string, files: VehicleFile[]) {
  const localVehicles = readLocalVehicles().map((vehicle) =>
    vehicle.id === id
      ? {
          ...vehicle,
          files: [...vehicle.files, ...files],
          updatedAt: new Date().toISOString(),
        }
      : vehicle,
  );
  saveLocalVehicles(localVehicles);

  if (isSupabaseConfigured && supabase) {
    await Promise.all(
      files.map((file) =>
        supabase.from(VEHICLE_DOCUMENTS_TABLE).insert({
          id: file.id,
          app_source: APP_SOURCE,
          vehicle_id: file.vehicleId,
          file_name: file.fileName,
          file_type: file.fileType,
          file_url: file.fileUrl ?? null,
          category: file.category,
          notes: file.notes ?? null,
          created_at: file.createdAt,
        }),
      ),
    ).catch(() => undefined);
  }
}

export async function deleteVehicleFile(vehicleId: string, fileId: string) {
  const localVehicles = readLocalVehicles().map((vehicle) =>
    vehicle.id === vehicleId
      ? {
          ...vehicle,
          files: vehicle.files.filter((file) => file.id !== fileId),
          updatedAt: new Date().toISOString(),
        }
      : vehicle,
  );
  saveLocalVehicles(localVehicles);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from(VEHICLE_DOCUMENTS_TABLE)
        .delete()
        .eq("id", fileId)
        .eq("vehicle_id", vehicleId)
        .eq("app_source", APP_SOURCE);
    } catch {
      // fallback local already applied
    }
  }
}
