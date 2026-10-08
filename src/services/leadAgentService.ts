import { formatPrice, priceListItemTitle } from "@/lib/priceList";
import { createLead, findLeadByPhone, listAssistantLeads, type AssistantLead, type NewLeadInput } from "@/services/leadsService";
import { matchPriceListByText } from "@/services/priceListSaleLink";
import { listPriceListItems } from "@/services/priceListService";

/**
 * Carga rapida de leads desde el asistente: "lead Juan Perez 2494123456 pregunta por la Amarok".
 * Evita abrir la pantalla de Leads y completar el formulario a mano.
 */
const LEAD_PREFIX = /^\s*(?:nuevo\s+|cargar?\s+|cargame\s+|anota(?:r|me)?\s+|agrega(?:r|me)?\s+)?(?:un\s+)?lead\b[\s:,-]*/i;

export function looksLikeLead(text: string) {
  return LEAD_PREFIX.test(text);
}

function cleanName(value: string) {
  return value
    .replace(/\b(?:tel|telefono|teléfono|cel|celular|whatsapp|wsp|llamado|nombre)\b\.?:?/gi, " ")
    .replace(/[|,;:()-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-záéíóúñ])([a-záéíóúñ]*)/gi, (_, first: string, rest: string) => first.toUpperCase() + rest.toLowerCase());
}

/** Separa nombre, telefono y auto de una frase libre. Lo que no se entiende queda vacio. */
export function parseLeadText(text: string): NewLeadInput {
  let rest = text.replace(LEAD_PREFIX, "");

  const phoneMatch = rest.match(/\+?\d[\d\s().-]{6,}\d/);
  const telefono = phoneMatch ? phoneMatch[0].replace(/[^\d+]/g, "") : "";
  if (phoneMatch) rest = rest.replace(phoneMatch[0], " | ");

  const carMatch = rest.match(
    /\b(?:pregunta|pregunto|preguntó|consulta|consulto|consultó|interesad[oa]|quiere|busca|por)\b\s*(?:por|en)?\s*(?:el|la|los|las|un|una)?\s+(.+)$/i,
  );
  const auto = carMatch
    ? carMatch[1]
        .replace(/[,;]?\s*(?:tel|telefono|teléfono|cel|celular|whatsapp|wsp)?\.?:?\s*\|.*$/i, "")
        .replace(/[|.,;]+$/g, "")
        .trim()
    : "";

  const namePart = (carMatch ? rest.slice(0, carMatch.index) : rest).split("|")[0];
  return { nombre: cleanName(namePart), telefono, auto, notas: "" };
}

export type LeadDraft = {
  input: NewLeadInput;
  /** Un lead que ya existe con el mismo telefono. */
  duplicate: AssistantLead | null;
  /** Autos disponibles de la lista de precios que coinciden con lo que pidio. */
  stock: string[];
  missing: string[];
};

export async function buildLeadDraft(text: string): Promise<LeadDraft> {
  const input = parseLeadText(text);
  const [leads, priceItems] = await Promise.all([
    listAssistantLeads().catch(() => []),
    listPriceListItems().catch(() => []),
  ]);

  const missing: string[] = [];
  if (!input.nombre) missing.push("nombre");
  if (!input.telefono) missing.push("teléfono");

  return {
    input,
    duplicate: input.telefono ? findLeadByPhone(leads, input.telefono) : null,
    stock: (input.auto ? matchPriceListByText(priceItems, input.auto) : []).slice(0, 3).map((item) => {
      const price = item.cashPrice ?? item.listPrice;
      return `${priceListItemTitle(item)}${item.yearLabel.trim() ? ` ${item.yearLabel.trim()}` : ""}${price ? ` · ${formatPrice(price, item.currency)}` : ""}`;
    }),
    missing,
  };
}

export function describeLeadDraft(draft: LeadDraft) {
  const { input } = draft;
  const lines = [
    `Lead: ${input.nombre || "sin nombre"}${input.telefono ? ` · ${input.telefono}` : ""}`,
    input.auto ? `Consulta por: ${input.auto}` : "",
    draft.stock.length ? `En la lista de precios: ${draft.stock.join(" / ")}` : "",
    draft.duplicate ? `Ojo: ya hay un lead con ese teléfono (${draft.duplicate.nombre}, ${draft.duplicate.estado}).` : "",
    draft.missing.length ? `Me falta: ${draft.missing.join(" y ")}.` : "Confirmá abajo y lo cargo como Sin contactar.",
  ];
  return lines.filter(Boolean).join("\n");
}

export async function saveLeadDraft(draft: LeadDraft) {
  return createLead(draft.input);
}
