import type { Vehicle } from "@/types/vehicles";

export type MissingFieldKind = "text" | "date" | "money" | "number";

export type MissingSaleField = {
  /** Campo del auto que hay que completar. */
  field: keyof Pick<
    Vehicle,
    "buyerName" | "buyerPhone" | "exitDate" | "salePrice" | "creditStartDate" | "creditTotalInstallments"
  >;
  label: string;
  kind: MissingFieldKind;
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

  if (!vehicle.buyerName.trim()) missing.push({ field: "buyerName", label: "Comprador", kind: "text", impact: postSale });
  if (!vehicle.buyerPhone.trim())
    missing.push({ field: "buyerPhone", label: "Telefono del comprador", kind: "text", impact: postSale });

  if (vehicle.status === "vendido") {
    if (!vehicle.exitDate) missing.push({ field: "exitDate", label: "Fecha de venta", kind: "date", impact: postSale });
    if (!vehicle.salePrice) missing.push({ field: "salePrice", label: "Precio de venta", kind: "money" });
    if (vehicle.hasCredit) {
      if (!vehicle.creditStartDate)
        missing.push({
          field: "creditStartDate",
          label: "Inicio del credito",
          kind: "date",
          impact: "sin esto no se crea el aviso de la cuota 10",
        });
      if (!vehicle.creditTotalInstallments)
        missing.push({ field: "creditTotalInstallments", label: "Cantidad de cuotas", kind: "number" });
    }
  }

  return missing;
}

export function listVehiclesWithMissingSaleData(vehicles: Vehicle[]) {
  return vehicles
    .map((vehicle) => ({ vehicle, missing: getMissingSaleData(vehicle) }))
    .filter((item) => item.missing.length > 0);
}
