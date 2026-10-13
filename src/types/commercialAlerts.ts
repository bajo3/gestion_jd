export const COMMERCIAL_ALERT_TYPES = [
  "credit_installment_10",
  "post_sale_7_days",
  "post_sale_30_days",
  "post_sale_6_months",
  "post_sale_12_months",
] as const;

export type CommercialAlertType = (typeof COMMERCIAL_ALERT_TYPES)[number];

export const COMMERCIAL_ALERT_TYPE_LABELS: Record<CommercialAlertType, string> = {
  credit_installment_10: "Crédito, cuota 10",
  post_sale_7_days: "Postventa 7 días",
  post_sale_30_days: "Postventa 30 días",
  post_sale_6_months: "Postventa 6 meses",
  post_sale_12_months: "Postventa 12 meses",
};

export function commercialAlertTypeLabel(type: string) {
  return COMMERCIAL_ALERT_TYPE_LABELS[type as CommercialAlertType] ?? "Seguimiento";
}

/** Cualquiera de los contactos de la escalera de postventa (7 dias, 30 dias, 6 y 12 meses). */
export function isPostSaleAlertType(type: string) {
  return type.startsWith("post_sale_");
}

export const COMMERCIAL_ALERT_STATUSES = [
  "pending",
  "contacted",
  "postponed",
  "dismissed",
] as const;

export type CommercialAlertStatus = (typeof COMMERCIAL_ALERT_STATUSES)[number];

export type CommercialAlert = {
  id: string;
  vehicleId?: string | null;
  clientName: string;
  clientPhone: string;
  alertType: CommercialAlertType;
  alertDate: string;
  status: CommercialAlertStatus;
  messageTemplate?: string;
  notes?: string;
  lastContactedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleLicensePlate?: string;
};
