export const COMMERCIAL_ALERT_TYPES = [
  "credit_installment_10",
  "post_sale_12_months",
] as const;

export type CommercialAlertType = (typeof COMMERCIAL_ALERT_TYPES)[number];

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
