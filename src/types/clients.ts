export type Client = {
  id: string;
  dni: string;
  dniNormalized: string;
  nombre: string;
  telefono: string;
  celular: string;
  email: string;
  domicilio: string;
  localidad: string;
  provincia: string;
  cuil: string;
  estadoCivil: string;
  condicionFiscal: string;
  fechaNacimiento: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ClientOperation = {
  id: string;
  clientId: string;
  vehicleId?: string | null;
  status: "borrador" | "finalizada" | "cancelada";
  fecha: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type DocumentType = "datero" | "recibo" | "autorizacion" | "operacion_finalizada" | "compra_venta" | "presupuesto_cliente" | "formulario_cliente";

export type ClientDocument = {
  id: string;
  clientId: string;
  operationId: string;
  documentType: DocumentType;
  status: "borrador" | "generado";
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type FinalizedSale = {
  operationId: string;
  clientId: string;
  clientName: string;
  clientDni: string;
  vehicleId: string;
  vehicleLabel: string;
  licensePlate: string;
  saleDate: string;
  salePrice: number;
  hasCredit: boolean;
  source: "operation" | "vehicle_history";
};
