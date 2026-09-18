import type { Vehicle } from "@/types/vehicles";

export type PoliceVerificationStatus = "borrador" | "preparada" | "completada";

export type PoliceVerification = {
  id: string;
  vehicleId: string;
  status: PoliceVerificationStatus;
  domain: string;
  plateCopy: string;
  brand: string;
  model: string;
  vehicleType: string;
  motorBrand: string;
  motorNumber: string;
  chassisBrand: string;
  chassisNumber: string;
  category: string;
  ownerName: string;
  ownerPersonType: "FISICA" | "JURIDICA";
  ownerDocumentType: "DNI" | "CUIT" | "PASAPORTE";
  ownerDocument: string;
  ownerStreet: string;
  ownerNumber: string;
  ownerFloor: string;
  ownerApartment: string;
  ownerPostalCode: string;
  ownerLocality: string;
  ownerProvince: string;
  presenterIsOwner: boolean;
  presenterName: string;
  presenterDocumentType: "DNI" | "CUIT" | "PASAPORTE";
  presenterDocument: string;
  presenterStreet: string;
  presenterNumber: string;
  presenterFloor: string;
  presenterApartment: string;
  presenterPostalCode: string;
  presenterLocality: string;
  presenterProvince: string;
  contactEmail: string;
  contactEmailRepeat: string;
  phoneArea: string;
  phoneNumber: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  preparedAt: string;
};

export type PoliceVerificationInput = Omit<
  PoliceVerification,
  "id" | "createdAt" | "updatedAt"
>;

export type PoliceVerificationPortalPayload = {
  portalUrl: string;
  fields: Record<string, string>;
  presenterIsOwner: boolean;
  generatedAt: string;
};

export const POLICE_VERIFICATION_PORTAL_URL =
  "https://vpa.mseg.gba.gov.ar/inicio_de_tramite.html";

export function createPoliceVerificationDraft(vehicle: Vehicle, previous?: Partial<PoliceVerification>): PoliceVerification {
  const now = new Date().toISOString();

  return {
    id: previous?.id ?? "",
    vehicleId: vehicle.id,
    status: previous?.status ?? "borrador",
    domain: previous?.domain ?? vehicle.licensePlate ?? "",
    plateCopy: previous?.plateCopy ?? "1",
    brand: previous?.brand ?? vehicle.brand ?? "",
    model: previous?.model ?? vehicle.model ?? "",
    vehicleType: previous?.vehicleType ?? "AUTOMOVIL",
    motorBrand: previous?.motorBrand ?? "",
    motorNumber: previous?.motorNumber ?? vehicle.engine ?? "",
    chassisBrand: previous?.chassisBrand ?? vehicle.brand ?? "",
    chassisNumber: previous?.chassisNumber ?? vehicle.vin ?? "",
    category: previous?.category ?? "1",
    ownerName: previous?.ownerName ?? "",
    ownerPersonType: previous?.ownerPersonType ?? "FISICA",
    ownerDocumentType: previous?.ownerDocumentType ?? "DNI",
    ownerDocument: previous?.ownerDocument ?? "",
    ownerStreet: previous?.ownerStreet ?? "",
    ownerNumber: previous?.ownerNumber ?? "",
    ownerFloor: previous?.ownerFloor ?? "",
    ownerApartment: previous?.ownerApartment ?? "",
    ownerPostalCode: previous?.ownerPostalCode ?? "",
    ownerLocality: previous?.ownerLocality ?? "",
    ownerProvince: previous?.ownerProvince ?? "Buenos Aires",
    presenterIsOwner: previous?.presenterIsOwner ?? true,
    presenterName: previous?.presenterName ?? "",
    presenterDocumentType: previous?.presenterDocumentType ?? "DNI",
    presenterDocument: previous?.presenterDocument ?? "",
    presenterStreet: previous?.presenterStreet ?? "",
    presenterNumber: previous?.presenterNumber ?? "",
    presenterFloor: previous?.presenterFloor ?? "",
    presenterApartment: previous?.presenterApartment ?? "",
    presenterPostalCode: previous?.presenterPostalCode ?? "",
    presenterLocality: previous?.presenterLocality ?? "",
    presenterProvince: previous?.presenterProvince ?? "Buenos Aires",
    contactEmail: previous?.contactEmail ?? "",
    contactEmailRepeat: previous?.contactEmailRepeat ?? "",
    phoneArea: previous?.phoneArea ?? "",
    phoneNumber: previous?.phoneNumber ?? "",
    notes: previous?.notes ?? "",
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    preparedAt: previous?.preparedAt ?? "",
  };
}

export function buildPoliceVerificationPortalPayload(
  values: PoliceVerification,
): PoliceVerificationPortalPayload {
  const presenter = values.presenterIsOwner
    ? {
        name: values.ownerName,
        documentType: values.ownerDocumentType,
        document: values.ownerDocument,
        street: values.ownerStreet,
        number: values.ownerNumber,
        floor: values.ownerFloor,
        apartment: values.ownerApartment,
        postalCode: values.ownerPostalCode,
        locality: values.ownerLocality,
        province: values.ownerProvince,
      }
    : {
        name: values.presenterName,
        documentType: values.presenterDocumentType,
        document: values.presenterDocument,
        street: values.presenterStreet,
        number: values.presenterNumber,
        floor: values.presenterFloor,
        apartment: values.presenterApartment,
        postalCode: values.presenterPostalCode,
        locality: values.presenterLocality,
        province: values.presenterProvince,
      };

  return {
    portalUrl: POLICE_VERIFICATION_PORTAL_URL,
    presenterIsOwner: values.presenterIsOwner,
    generatedAt: new Date().toISOString(),
    fields: {
      dominio: values.domain,
      "ejemplar-placa": values.plateCopy,
      marca: values.brand,
      modelo: values.model,
      tipo: values.vehicleType,
      "motor-marca": values.motorBrand,
      "motor-numero": values.motorNumber,
      "chasis-marca": values.chassisBrand,
      "chasis-numero": values.chassisNumber,
      categoria: values.category,
      "titular-nombre": values.ownerName,
      "tipo-persona": values.ownerPersonType,
      "titular-tipo-documento": values.ownerDocumentType,
      "titular-documento": values.ownerDocument,
      "titular-calle": values.ownerStreet,
      "titular-numero": values.ownerNumber,
      "titular-piso": values.ownerFloor,
      "titular-departamento": values.ownerApartment,
      "titular-codigo-postal": values.ownerPostalCode,
      "titular-localidad": values.ownerLocality,
      "titular-provincia": values.ownerProvince,
      "responsable-nombre": presenter.name,
      "responsable-tipo-documento": presenter.documentType,
      "responsable-documento": presenter.document,
      "responsable-calle": presenter.street,
      "responsable-numero": presenter.number,
      "responsable-piso": presenter.floor,
      "responsable-departamento": presenter.apartment,
      "responsable-codigo-postal": presenter.postalCode,
      "responsable-localidad": presenter.locality,
      "responsable-provincia": presenter.province,
      "contacto-e-mail": values.contactEmail,
      "contacto-re-mail": values.contactEmailRepeat,
      "contacto-telefono-area": values.phoneArea,
      "contacto-telefono": values.phoneNumber,
      "re-dominio": values.domain,
    },
  };
}
