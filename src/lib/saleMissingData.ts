import type { Vehicle } from "@/types/vehicles";

export type MissingSaleField = {
  label: string;
  /** Que se pierde si no se carga (ej: la alerta de postventa). */
  impact?: string;
};

/**
 * Datos que faltan en un auto vendido (o reservado) para que la venta quede
 * completa y entre a los seguimientos de postventa y credito.
 */
export function getMissingSaleData(vehicle: Vehicle): MissingSaleField[] {
  if (vehicle.status !== "vendido" && vehicle.status !== "reservado") return [];

  const missing: MissingSaleField[] = [];
  const postSale = "sin esto no se crea la postventa";

  if (!vehicle.buyerName.trim()) missing.push({ label: "Comprador", impact: postSale });
  if (!vehicle.buyerPhone.trim()) missing.push({ label: "Telefono del comprador", impact: postSale });

  if (vehicle.status === "vendido") {
    if (!vehicle.exitDate) missing.push({ label: "Fecha de venta", impact: postSale });
    if (!vehicle.salePrice) missing.push({ label: "Precio de venta" });
    if (vehicle.hasCredit) {
      if (!vehicle.creditStartDate) missing.push({ label: "Inicio del credito", impact: "sin esto no se crea el aviso de la cuota 10" });
      if (!vehicle.creditTotalInstallments) missing.push({ label: "Cantidad de cuotas" });
    }
  }

  return missing;
}

export function listVehiclesWithMissingSaleData(vehicles: Vehicle[]) {
  return vehicles
    .map((vehicle) => ({ vehicle, missing: getMissingSaleData(vehicle) }))
    .filter((item) => item.missing.length > 0);
}
