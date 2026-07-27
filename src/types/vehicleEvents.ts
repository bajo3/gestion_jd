export const VEHICLE_EVENT_TYPES = [
  "created",
  "status_changed",
  "sold",
  "price_changed",
  "buyer_updated",
  "credit_updated",
  "file_added",
  "file_removed",
  "note",
  "updated",
] as const;

export type VehicleEventType = (typeof VEHICLE_EVENT_TYPES)[number];

export type VehicleFieldChange = {
  field: string;
  label: string;
  from: string;
  to: string;
};

export type VehicleEvent = {
  id: string;
  vehicleId: string;
  type: VehicleEventType;
  /** Linea principal que se muestra en el timeline, ya redactada en castellano. */
  summary: string;
  detail?: string;
  changes: VehicleFieldChange[];
  actor?: string;
  occurredAt: string;
  createdAt: string;
};

export type VehicleEventInput = Omit<VehicleEvent, "id" | "createdAt">;
