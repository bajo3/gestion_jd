import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";

const ARCHIVED_WORDS = ["Cerrado", "No interesado"];

type LeadRow = {
  lead_key: string;
  source?: string;
  buyer_name?: string;
  item_title?: string;
  phone?: string;
  status?: string;
  date_created?: string;
  raw_json?: Record<string, unknown> | null;
};

export type AssistantLead = {
  id: string;
  source: string;
  nombre: string;
  auto: string;
  telefono: string;
  estado: string;
  notas: string;
  fechaLead: string;
  fechaContacto: string;
  isRequest: boolean;
  daysSinceLead: number | null;
  needsReply: boolean;
};

function normalizeStatus(status: string) {
  return status;
}

function hasStatusWord(status: string, word: string) {
  return status.toLowerCase().includes(word.toLowerCase());
}

function isArchivedStatus(status: string) {
  return ARCHIVED_WORDS.some((word) => hasStatusWord(status, word));
}

function toInputDate(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function daysSince(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function isCustomerRequest(row: Pick<LeadRow, "source" | "raw_json">) {
  return row.source === "encargo" || row.raw_json?.tipo === "encargo";
}

function normalizeLead(row: LeadRow): AssistantLead {
  const raw = row.raw_json && typeof row.raw_json === "object" ? row.raw_json : {};
  const estado = normalizeStatus(row.status || "⏳ Sin contactar");
  const fechaLead = row.date_created || "";
  const fechaContacto = String(raw.fecha_contacto || "");
  const isRequest = isCustomerRequest(row);
  const leadDays = daysSince(fechaLead);
  const contactDate = toInputDate(fechaContacto);
  const archived = isArchivedStatus(estado);
  const noAnswerDays = estado.includes("No contesta") ? daysSince(fechaContacto || fechaLead) : null;

  return {
    id: row.lead_key,
    source: row.source || "",
    nombre: row.buyer_name || "",
    auto: row.item_title || "",
    telefono: row.phone || "",
    estado,
    notas: String(raw.notas || ""),
    fechaLead,
    fechaContacto,
    isRequest,
    daysSinceLead: leadDays,
    needsReply:
      !isRequest &&
      !archived &&
      (!contactDate || hasStatusWord(estado, "Sin contactar") || hasStatusWord(estado, "Recontactar") || (noAnswerDays !== null && noAnswerDays >= 3)),
  };
}

export async function listAssistantLeads(): Promise<AssistantLead[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from("meli_leads")
    .select("*")
    .order("date_created", { ascending: false });

  if (error || !data) return [];
  return (data as LeadRow[]).map(normalizeLead);
}

export function summarizeLeads(leads: AssistantLead[]) {
  const regularLeads = leads.filter((lead) => !lead.isRequest);
  const active = regularLeads.filter((lead) => !isArchivedStatus(lead.estado));
  const needsReply = active.filter((lead) => lead.needsReply);
  const requests = leads.filter((lead) => lead.isRequest);

  return {
    total: regularLeads.length,
    active: active.length,
    needsReply: needsReply.length,
    requests: requests.length,
    noContact: active.filter((lead) => hasStatusWord(lead.estado, "Sin contactar")).length,
    interested: active.filter((lead) => hasStatusWord(lead.estado, "Interesado")).length,
    contacted: active.filter((lead) => hasStatusWord(lead.estado, "Contactado")).length,
    recontact: active.filter((lead) => hasStatusWord(lead.estado, "Recontactar") || lead.needsReply).length,
    closed: regularLeads.filter((lead) => hasStatusWord(lead.estado, "Cerrado")).length,
    urgent: needsReply
      .sort((a, b) => (b.daysSinceLead ?? 0) - (a.daysSinceLead ?? 0))
      .slice(0, 8),
  };
}
