import {
  isArchivedLeadStatus,
  leadStatusLabel,
  parseLeadStatus,
  PENDING_LEAD_STATUSES,
  REQUEST_STATUS_LABELS,
  type LeadStatus,
} from "@/lib/leadStatus";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";

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
  /** Clave canonica del estado; es la que se debe usar para comparar. */
  status: LeadStatus;
  /** Etiqueta con emoji, solo para mostrar. */
  estado: string;
  notas: string;
  fechaLead: string;
  fechaContacto: string;
  isRequest: boolean;
  daysSinceLead: number | null;
  needsReply: boolean;
};

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
  const fechaLead = row.date_created || "";
  const fechaContacto = String(raw.fecha_contacto || "");
  const isRequest = isCustomerRequest(row);
  const status = parseLeadStatus(row.status);
  // Los encargos usan su propia lista de estados, asi que se muestra el texto tal cual vino.
  const estado = isRequest ? row.status || REQUEST_STATUS_LABELS.buscando : leadStatusLabel(status);
  const leadDays = daysSince(fechaLead);
  const contactDate = toInputDate(fechaContacto);
  const noAnswerDays = status === "no_contesta" ? daysSince(fechaContacto || fechaLead) : null;

  return {
    id: row.lead_key,
    source: row.source || "",
    nombre: row.buyer_name || "",
    auto: row.item_title || "",
    telefono: row.phone || "",
    status,
    estado,
    notas: String(raw.notas || ""),
    fechaLead,
    fechaContacto,
    isRequest,
    daysSinceLead: leadDays,
    needsReply:
      !isRequest &&
      !isArchivedLeadStatus(status) &&
      (!contactDate ||
        PENDING_LEAD_STATUSES.includes(status) ||
        (noAnswerDays !== null && noAnswerDays >= 3)),
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
  const active = regularLeads.filter((lead) => !isArchivedLeadStatus(lead.status));
  const needsReply = active.filter((lead) => lead.needsReply);
  const requests = leads.filter((lead) => lead.isRequest);
  const countByStatus = (status: LeadStatus) => active.filter((lead) => lead.status === status).length;

  return {
    total: regularLeads.length,
    active: active.length,
    needsReply: needsReply.length,
    requests: requests.length,
    noContact: countByStatus("sin_contactar"),
    interested: countByStatus("interesado"),
    contacted: countByStatus("contactado"),
    recontact: active.filter((lead) => lead.status === "recontactar" || lead.needsReply).length,
    closed: regularLeads.filter((lead) => lead.status === "cerrado").length,
    urgent: needsReply
      .sort((a, b) => (b.daysSinceLead ?? 0) - (a.daysSinceLead ?? 0))
      .slice(0, 8),
  };
}
