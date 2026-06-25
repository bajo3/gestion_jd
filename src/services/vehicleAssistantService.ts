import { createVehicle, listVehicles, updateVehicle } from "@/services/vehiclesService";
import type { Vehicle, VehicleInput, VehicleStatus } from "@/types/vehicles";

export type AssistantDraft = {
  values: Partial<VehicleInput>;
  targetVehicleId?: string;
  targetLabel?: string;
  mode: "create" | "update";
  notes: string[];
  candidates: Vehicle[];
  source?: "glm-5.2" | "local";
};

export type AssistantApplyResult = {
  vehicle: Vehicle;
  mode: "create" | "update";
};

const knownBrands: Record<string, string> = {
  alfa: "Alfa Romeo",
  audi: "Audi",
  baic: "BAIC",
  bmw: "BMW",
  chevrolet: "Chevrolet",
  chery: "Chery",
  citroen: "Citroen",
  citroën: "Citroen",
  dodge: "Dodge",
  fiat: "Fiat",
  ford: "Ford",
  honda: "Honda",
  hyundai: "Hyundai",
  jeep: "Jeep",
  kia: "Kia",
  mercedes: "Mercedes-Benz",
  mercedesbenz: "Mercedes-Benz",
  mini: "MINI",
  mitsubishi: "Mitsubishi",
  nissan: "Nissan",
  peugeot: "Peugeot",
  ram: "RAM",
  renault: "Renault",
  toyota: "Toyota",
  volkswagen: "Volkswagen",
  vw: "Volkswagen",
};

const modelStopWords = new Set([
  "patente",
  "dominio",
  "color",
  "km",
  "kms",
  "kilometros",
  "kilometros",
  "precio",
  "valor",
  "vendido",
  "vendida",
  "comprador",
  "cliente",
  "telefono",
  "tel",
  "cel",
  "whatsapp",
  "wsp",
  "credito",
  "financiado",
  "cuotas",
]);

export const emptyVehicleInput = (): VehicleInput => ({
  brand: "",
  model: "",
  licensePlate: "",
  year: null,
  vin: "",
  engine: "",
  color: "",
  kilometers: null,
  entryDate: "",
  exitDate: "",
  status: "ingresado",
  observations: "",
  purchasePrice: null,
  salePrice: null,
  buyerName: "",
  buyerPhone: "",
  hasCredit: false,
  creditStartDate: "",
  creditTotalInstallments: null,
  creditDueDay: null,
});

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function parseNumber(value?: string | null) {
  if (!value) return null;
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseDate(text: string, keywords: string[]) {
  const normalized = normalizeText(text);
  if (keywords.some((keyword) => normalized.includes(`${keyword} hoy`) || normalized.includes(`hoy ${keyword}`))) {
    return todayDate();
  }

  const keywordPattern = keywords.join("|");
  const dateMatch = normalized.match(
    new RegExp(`(?:${keywordPattern})[^\\d]*(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{2,4}))?`),
  );

  if (!dateMatch) return "";

  const day = dateMatch[1].padStart(2, "0");
  const month = dateMatch[2].padStart(2, "0");
  const rawYear = dateMatch[3] ?? String(new Date().getFullYear());
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;

  return `${year}-${month}-${day}`;
}

function parseStatus(text: string): VehicleStatus | undefined {
  const normalized = normalizeText(text);
  if (/\b(vendido|vendida|se vendio|venta cerrada)\b/.test(normalized)) return "vendido";
  if (/\b(reservado|reservada|senado|senada|señado|señada)\b/.test(text.toLowerCase())) return "reservado";
  if (/\b(publicado|publicada)\b/.test(normalized)) return "publicado";
  if (/\b(egresado|egresada|entregado|entregada)\b/.test(normalized)) return "egresado";
  return undefined;
}

function parseBrandAndModel(text: string) {
  const normalized = normalizeText(text);
  const tokens = normalized.split(" ");
  const brandIndex = tokens.findIndex((token) => Boolean(knownBrands[token]));

  if (brandIndex === -1) {
    return {};
  }

  const brand = knownBrands[tokens[brandIndex]];
  const modelTokens: string[] = [];

  for (const token of tokens.slice(brandIndex + 1)) {
    if (/^(19|20)\d{2}$/.test(token)) break;
    if (/^\$?\d[\d.,]*$/.test(token)) break;
    if (modelStopWords.has(token)) break;
    modelTokens.push(token);
  }

  return {
    brand,
    model: modelTokens.length ? titleCase(modelTokens.join(" ")) : undefined,
  };
}

function parseLicensePlate(text: string) {
  const normalized = text.toUpperCase();
  const explicit = normalized.match(/\b(?:PATENTE|DOMINIO)\s*[:#-]?\s*([A-Z]{2}\s?\d{3}\s?[A-Z]{2}|[A-Z]{3}\s?\d{3})\b/);
  if (explicit) return explicit[1].replace(/\s+/g, "");

  const detected = normalized.match(/\b([A-Z]{2}\s?\d{3}\s?[A-Z]{2}|[A-Z]{3}\s?\d{3})\b/);
  return detected?.[1].replace(/\s+/g, "") ?? "";
}

function parseBuyerName(text: string) {
  const match = text.match(
    /\b(?:comprador|cliente|vendido a|vendida a|a nombre de)\s*:?\s+(.+?)(?=\s+(?:tel|telefono|cel|celular|whatsapp|wsp|credito|financiado|cuotas|patente|dominio|fecha|entrega|egreso)\b|$)/i,
  );

  if (!match) return "";

  return titleCase(match[1].replace(/[.,;]+$/g, "").trim());
}

function parsePhone(text: string) {
  const explicit = text.match(/\b(?:tel|telefono|cel|celular|whatsapp|wsp)\s*:?\s*([+\d][\d\s().-]{6,})/i);
  if (!explicit) return "";

  return explicit[1].replace(/[^\d+]/g, "");
}

function parseColor(text: string) {
  const match = text.match(/\bcolor\s*:?\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ ]+?)(?=\s+(?:patente|dominio|km|kms|kilometros|precio|valor|comprador|cliente|tel|telefono|credito)\b|$)/i);
  return match ? titleCase(match[1].trim()) : "";
}

function parsePatch(text: string): { values: Partial<VehicleInput>; notes: string[] } {
  const values: Partial<VehicleInput> = {};
  const notes: string[] = [];
  const normalized = normalizeText(text);

  const status = parseStatus(text);
  if (status) {
    values.status = status;
    if ((status === "vendido" || status === "egresado") && !parseDate(text, ["egreso", "entrega", "venta", "vendido"])) {
      values.exitDate = todayDate();
      notes.push("Use la fecha de hoy como egreso porque el comando dice vendido/egresado.");
    }
  }

  const { brand, model } = parseBrandAndModel(text);
  if (brand) values.brand = brand;
  if (model) values.model = model;

  const licensePlate = parseLicensePlate(text);
  if (licensePlate) values.licensePlate = licensePlate;

  const yearMatch = normalized.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) values.year = Number(yearMatch[1]);

  const kmMatch = normalized.match(/\b(\d[\d.,]*)\s*(?:km|kms|kilometros)\b/);
  if (kmMatch) values.kilometers = parseNumber(kmMatch[1]);

  const priceMatch =
    text.match(/\$\s*([\d.,]+)/) ??
    text.match(/\b(?:precio|valor|venta)\s*:?\s*\$?\s*([\d.,]{5,})/i);
  if (priceMatch) values.salePrice = parseNumber(priceMatch[1]);

  const buyerName = parseBuyerName(text);
  if (buyerName) values.buyerName = buyerName;

  const buyerPhone = parsePhone(text);
  if (buyerPhone) values.buyerPhone = buyerPhone;

  const color = parseColor(text);
  if (color) values.color = color;

  const exitDate = parseDate(text, ["egreso", "entrega", "venta", "vendido"]);
  if (exitDate) values.exitDate = exitDate;

  if (/\b(credito|financiado|financiada|cuotas)\b/.test(normalized)) {
    values.hasCredit = true;
  }

  const installmentsMatch = normalized.match(/\b(\d{1,3})\s*cuotas\b/);
  if (installmentsMatch) {
    values.hasCredit = true;
    values.creditTotalInstallments = Number(installmentsMatch[1]);
  }

  const dueDayMatch = normalized.match(/\b(?:vence|vencimiento|dia)\s*(?:el|de)?\s*(\d{1,2})\b/);
  if (dueDayMatch) {
    values.hasCredit = true;
    values.creditDueDay = Number(dueDayMatch[1]);
  }

  const creditStartDate = parseDate(text, ["inicio credito", "credito", "financiacion", "financiado"]);
  if (creditStartDate) {
    values.hasCredit = true;
    values.creditStartDate = creditStartDate;
  }

  return { values, notes };
}

function vehicleToInput(vehicle: Vehicle): VehicleInput {
  return {
    brand: vehicle.brand,
    model: vehicle.model,
    licensePlate: vehicle.licensePlate,
    year: vehicle.year,
    vin: vehicle.vin,
    engine: vehicle.engine,
    color: vehicle.color,
    kilometers: vehicle.kilometers,
    entryDate: vehicle.entryDate,
    exitDate: vehicle.exitDate,
    status: vehicle.status,
    observations: vehicle.observations,
    purchasePrice: vehicle.purchasePrice,
    salePrice: vehicle.salePrice,
    buyerName: vehicle.buyerName,
    buyerPhone: vehicle.buyerPhone,
    hasCredit: vehicle.hasCredit,
    creditStartDate: vehicle.creditStartDate,
    creditTotalInstallments: vehicle.creditTotalInstallments,
    creditDueDay: vehicle.creditDueDay,
  };
}

function vehicleLabel(vehicle: Vehicle) {
  return `${vehicle.brand} ${vehicle.model}${vehicle.year ? ` ${vehicle.year}` : ""}${vehicle.licensePlate ? ` (${vehicle.licensePlate})` : ""}`;
}

function findCandidates(vehicles: Vehicle[], values: Partial<VehicleInput>) {
  if (values.licensePlate) {
    return vehicles.filter(
      (vehicle) => vehicle.licensePlate.toUpperCase() === values.licensePlate?.toUpperCase(),
    );
  }

  if (!values.brand || !values.model) return [];

  const brand = normalizeText(values.brand);
  const model = normalizeText(values.model);

  return vehicles.filter((vehicle) => {
    const sameBrand = normalizeText(vehicle.brand) === brand;
    const sameModel = normalizeText(vehicle.model).includes(model) || model.includes(normalizeText(vehicle.model));
    const sameYear = values.year ? vehicle.year === values.year : true;
    return sameBrand && sameModel && sameYear && vehicle.status !== "archivado";
  });
}

type GlmAssistantResponse = {
  ok: boolean;
  model?: string;
  values?: Partial<VehicleInput>;
  targetVehicleId?: string;
  notes?: string[];
  assistantText?: string;
  error?: string;
};

function summarizeVehiclesForAi(vehicles: Vehicle[]) {
  return vehicles
    .filter((vehicle) => vehicle.status !== "archivado")
    .slice(0, 80)
    .map((vehicle) => ({
      id: vehicle.id,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      licensePlate: vehicle.licensePlate,
      status: vehicle.status,
      buyerName: vehicle.buyerName,
    }));
}

async function parseWithGlm(
  text: string,
  vehicles: Vehicle[],
  currentDraft?: AssistantDraft,
): Promise<GlmAssistantResponse | null> {
  try {
    const response = await fetch("/api/ai-assistant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: text,
        currentDate: todayDate(),
        currentValues: currentDraft?.values ?? {},
        currentTargetVehicleId: currentDraft?.targetVehicleId ?? "",
        vehicles: summarizeVehiclesForAi(vehicles),
      }),
    });

    const data = (await response.json().catch(() => null)) as GlmAssistantResponse | null;
    if (!response.ok || !data?.ok) return null;
    return data;
  } catch {
    return null;
  }
}

export async function buildAssistantDraft(text: string, currentDraft?: AssistantDraft): Promise<AssistantDraft> {
  const vehicles = await listVehicles();
  const localParsed = parsePatch(text);
  const glmParsed = await parseWithGlm(text, vehicles, currentDraft);
  const baseValues = currentDraft?.values ?? {};
  const values = { ...baseValues, ...localParsed.values, ...(glmParsed?.values ?? {}) };
  const requestedTargetId = glmParsed?.targetVehicleId || currentDraft?.targetVehicleId;
  const explicitTarget = requestedTargetId
    ? vehicles.find((vehicle) => vehicle.id === requestedTargetId)
    : undefined;
  const candidates = explicitTarget ? [explicitTarget] : findCandidates(vehicles, values);
  const target = candidates.length === 1 ? candidates[0] : undefined;
  const aiNotes = glmParsed?.assistantText ? [glmParsed.assistantText] : [];
  const notes = [
    ...(currentDraft?.notes ?? []),
    ...localParsed.notes,
    ...(glmParsed ? ["Interpretado con GLM 5.2.", ...aiNotes, ...(glmParsed.notes ?? [])] : ["GLM no disponible; use interpretacion local."]),
  ];

  return {
    values,
    targetVehicleId: target?.id ?? explicitTarget?.id ?? currentDraft?.targetVehicleId,
    targetLabel: target ? vehicleLabel(target) : currentDraft?.targetLabel,
    mode: target || explicitTarget ? "update" : "create",
    notes,
    candidates,
    source: glmParsed ? "glm-5.2" : "local",
  };
}

export function getMissingAssistantFields(draft: AssistantDraft) {
  const values = draft.values;
  const missing: string[] = [];

  if (!draft.targetVehicleId) {
    if (!values.brand) missing.push("marca");
    if (!values.model) missing.push("modelo");
    if (!values.year) missing.push("anio");
  }

  if (values.status === "vendido" || values.status === "egresado") {
    if (!values.salePrice) missing.push("precio de venta");
    if (!values.buyerName) missing.push("comprador");
    if (!values.buyerPhone) missing.push("telefono del comprador");
    if (!values.exitDate) missing.push("fecha de egreso");
  }

  if (values.hasCredit) {
    if (!values.creditStartDate) missing.push("fecha de inicio del credito");
    if (!values.creditTotalInstallments) missing.push("cantidad de cuotas");
    if (!values.creditDueDay) missing.push("dia de vencimiento");
  }

  if (draft.candidates.length > 1 && !draft.targetVehicleId) {
    missing.push("patente para elegir el auto exacto");
  }

  return missing;
}

export function buildAssistantSummary(draft: AssistantDraft) {
  const values = draft.values;
  const rows = [
    values.status ? `Estado: ${values.status.replaceAll("_", " ")}` : "",
    values.brand || values.model ? `Auto: ${[values.brand, values.model, values.year].filter(Boolean).join(" ")}` : "",
    values.licensePlate ? `Patente: ${values.licensePlate}` : "",
    values.kilometers ? `Kilometros: ${values.kilometers.toLocaleString("es-AR")}` : "",
    values.salePrice ? `Precio venta: ${values.salePrice.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })}` : "",
    values.buyerName ? `Comprador: ${values.buyerName}` : "",
    values.buyerPhone ? `Telefono: ${values.buyerPhone}` : "",
    values.exitDate ? `Egreso: ${values.exitDate}` : "",
    values.hasCredit
      ? `Credito: ${values.creditTotalInstallments ?? "?"} cuotas, vence dia ${values.creditDueDay ?? "?"}, inicia ${values.creditStartDate || "?"}`
      : "",
  ].filter(Boolean);

  return rows;
}

export async function applyAssistantDraft(draft: AssistantDraft): Promise<AssistantApplyResult> {
  const values = { ...emptyVehicleInput(), ...draft.values };

  if (draft.targetVehicleId) {
    const currentVehicles = await listVehicles();
    const current = currentVehicles.find((vehicle) => vehicle.id === draft.targetVehicleId);
    const mergedValues = current ? { ...vehicleToInput(current), ...draft.values } : values;
    const updated = await updateVehicle(draft.targetVehicleId, mergedValues);
    return { vehicle: updated, mode: "update" };
  }

  const created = await createVehicle(values);
  return { vehicle: created, mode: "create" };
}
