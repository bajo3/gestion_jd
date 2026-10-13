import type { VehicleFileCategory, VehicleStatus } from "@/types/vehicles";

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  ingresado: "Ingresado",
  en_preparacion: "En preparación",
  publicado: "Publicado",
  reservado: "Reservado",
  vendido: "Vendido",
  egresado: "Egresado",
  archivado: "Archivado",
};

export const VEHICLE_FILE_CATEGORY_LABELS: Record<VehicleFileCategory, string> = {
  foto: "Foto",
  cedula: "Cédula",
  titulo: "Título",
  dni: "DNI",
  "08": "08",
  informe_de_dominio: "Informe de dominio",
  verificacion_policial: "Verificación policial",
  boleto: "Boleto",
  recibo: "Recibo",
  pdf_generado: "PDF generado",
  otro: "Otro",
};

export function vehicleTitle(vehicle: { brand: string; model: string }) {
  return [vehicle.brand, vehicle.model].map((part) => part.trim()).filter(Boolean).join(" ") || "Auto sin datos";
}
