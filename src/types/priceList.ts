export const PRICE_CURRENCIES = ["ARS", "USD"] as const;

export type PriceCurrency = (typeof PRICE_CURRENCIES)[number];

export type PriceListItem = {
  id: string;
  brand: string;
  unit: string;
  yearLabel: string;
  kmLabel: string;
  version: string;
  color: string;
  fuel: string;
  traction: string;
  gearbox: string;
  displacement: string;
  cashPrice: number | null;
  listPrice: number | null;
  currency: PriceCurrency;
  controlMark: string;
  photoUrl: string;
  isPublic: boolean;
  /** Fila que ocupa este vehiculo en la planilla de Google. null si nunca se escribio ahi. */
  sheetRow: number | null;
  /** Como quedo la fila A..L la ultima vez que se sincronizo. Ver sheetValuesSignature. */
  sheetSnapshot: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

/** Lo editable de un vehiculo: sin ids ni la contabilidad de la sincronizacion. */
export type PriceListItemInput = Omit<
  PriceListItem,
  "id" | "createdAt" | "updatedAt" | "sheetSnapshot"
>;

export function emptyPriceListItem(brand = ""): PriceListItemInput {
  return {
    brand,
    unit: "",
    yearLabel: "",
    kmLabel: "",
    version: "",
    color: "",
    fuel: "",
    traction: "",
    gearbox: "",
    displacement: "",
    cashPrice: null,
    listPrice: null,
    currency: "ARS",
    controlMark: "",
    photoUrl: "",
    isPublic: true,
    sheetRow: null,
    sortOrder: 0,
  };
}
