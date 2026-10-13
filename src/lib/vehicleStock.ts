import type { Vehicle, VehicleFile, VehicleStatus } from "@/types/vehicles";

/** Estados en los que el auto sigue en la agencia esperando venderse. */
const IN_STOCK_STATUSES: VehicleStatus[] = ["ingresado", "en_preparacion", "publicado"];

export type StockAgeLevel = "ok" | "warning" | "high" | "critical";

export type StockAge = { days: number; level: StockAgeLevel };

/**
 * Dias que lleva el auto en stock sin venderse, contados desde la fecha de ingreso (o desde
 * que se cargo, si no tiene). Devuelve null para los autos reservados, vendidos o archivados.
 */
export function getStockAge(vehicle: Vehicle, now = new Date()): StockAge | null {
  if (!IN_STOCK_STATUSES.includes(vehicle.status)) return null;

  // "2026-09-16" a secas se interpreta en UTC: se arma como fecha local.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(vehicle.entryDate);
  const since = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(vehicle.entryDate || vehicle.createdAt);
  if (Number.isNaN(since.getTime())) return null;

  const days = Math.max(0, Math.floor((now.getTime() - since.getTime()) / 86400000));
  const level: StockAgeLevel = days >= 90 ? "critical" : days >= 60 ? "high" : days >= 45 ? "warning" : "ok";
  return { days, level };
}

/** Fotos del auto que se pueden mostrar, de la mas nueva a la mas vieja. La primera es la principal. */
export function getVehiclePhotos(vehicle: Vehicle): VehicleFile[] {
  return vehicle.files.filter(
    (file) => file.category === "foto" && Boolean(file.fileUrl) && file.fileType.startsWith("image/"),
  );
}
