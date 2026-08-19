import type { DocumentType } from "@/services/documentDraftService";

export type StoredDocument = {
  id: string;
  documentType: DocumentType;
  documentLabel: string;
  title: string;
  personName: string;
  documentNumber: string;
  licensePlate: string;
  phone: string;
  vehicleLabel: string;
  amount: number | null;
  documentDate: string | null;
  fileName: string;
  fileUrl: string | null;
  storagePath: string | null;
  formData: Record<string, unknown>;
  createdAt: string;
};

export type DocumentSearchFilters = {
  query?: string;
  documentType?: DocumentType | "todos";
  limit?: number;
};
