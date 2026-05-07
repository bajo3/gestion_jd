export const VEHICLE_STATUSES = [
  "ingresado",
  "en_preparacion",
  "publicado",
  "reservado",
  "vendido",
  "egresado",
  "archivado",
] as const;

export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const VEHICLE_FILE_CATEGORIES = [
  "foto",
  "cedula",
  "titulo",
  "dni",
  "08",
  "informe_de_dominio",
  "verificacion_policial",
  "boleto",
  "recibo",
  "pdf_generado",
  "otro",
] as const;

export type VehicleFileCategory = (typeof VEHICLE_FILE_CATEGORIES)[number];

export type VehicleFile = {
  id: string;
  vehicleId: string;
  fileName: string;
  fileType: string;
  fileUrl?: string;
  category: VehicleFileCategory;
  notes?: string;
  size?: number;
  createdAt: string;
};

export type Vehicle = {
  id: string;
  brand: string;
  model: string;
  licensePlate: string;
  year: number | null;
  vin: string;
  engine: string;
  color: string;
  kilometers: number | null;
  entryDate: string;
  exitDate: string;
  status: VehicleStatus;
  observations: string;
  purchasePrice: number | null;
  salePrice: number | null;
  buyerName: string;
  buyerPhone: string;
  hasCredit: boolean;
  creditStartDate: string;
  creditTotalInstallments: number | null;
  creditDueDay: number | null;
  createdAt: string;
  updatedAt: string;
  files: VehicleFile[];
};

export type VehicleInput = Omit<Vehicle, "id" | "createdAt" | "updatedAt" | "files">;
