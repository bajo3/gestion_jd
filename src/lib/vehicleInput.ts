import type { Vehicle, VehicleInput } from "@/types/vehicles";

/** Saca los campos de solo lectura para poder mandar el auto de vuelta a updateVehicle. */
export function toVehicleInput(vehicle: Vehicle): VehicleInput {
  const input: Partial<Vehicle> = { ...vehicle };
  delete input.id;
  delete input.createdAt;
  delete input.updatedAt;
  delete input.files;
  return input as VehicleInput;
}
