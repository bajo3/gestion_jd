/** Shared fields used by the customer proposal and the finalized-operation form. */
export type SalesDocumentValues = {
  fecha: string;
  moneda: "ARS" | "USD";
  nombre: string;
  telefono: string;
  dni: string;
  detalles: string;
  vehModelo: string;
  vehAnio: string;
  vehKm: string;
  precioVenta: string;
  entregaEfectivo: string;
  usadoModelo: string;
  usadoAnio: string;
  usadoKm: string;
  usadoToma: string;
  tomaCredito: "si" | "no";
  creditoTotal: string;
  cuotasCant: string;
  gastosAdm: string;
  transferencia: string;
  creditoFechaInicio: string;
  creditoNumeroCuotas: string;
  creditoDiaVencimiento: string;
  creditoMoneda: "ARS" | "USD";
};

export type PresupuestoValues = SalesDocumentValues & {
  vigencia: string;
  condiciones: string;
  notas: string;
};

export type OperacionFinalizadaValues = SalesDocumentValues;

export const emptySalesDocumentValues: SalesDocumentValues = {
  fecha: new Date().toISOString().slice(0, 10),
  moneda: "ARS",
  nombre: "",
  telefono: "",
  dni: "",
  detalles: "",
  vehModelo: "",
  vehAnio: "",
  vehKm: "",
  precioVenta: "",
  entregaEfectivo: "",
  usadoModelo: "",
  usadoAnio: "",
  usadoKm: "",
  usadoToma: "",
  tomaCredito: "no",
  creditoTotal: "",
  cuotasCant: "",
  gastosAdm: "",
  transferencia: "",
  creditoFechaInicio: "",
  creditoNumeroCuotas: "",
  creditoDiaVencimiento: "",
  creditoMoneda: "ARS",
};

export const emptyPresupuestoValues: PresupuestoValues = {
  ...emptySalesDocumentValues,
  vigencia: "7 días corridos",
  condiciones: "Sujeto a disponibilidad del vehículo y aprobación crediticia.",
  notas: "",
};
