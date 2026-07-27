/**
 * Los estados de leads se guardan en la base como texto con emoji ("⏳ Sin contactar"),
 * porque la tabla meli_leads la escriben tambien procesos externos. Para no depender de
 * esa forma exacta, adentro de la app se trabaja con claves estables y se traduce en los
 * bordes: se parsea al leer y se vuelve a la etiqueta con emoji al escribir.
 */

export const LEAD_STATUSES = [
  "sin_contactar",
  "interesado",
  "contactado",
  "recontactar",
  "no_contesta",
  "no_interesado",
  "cerrado",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const REQUEST_STATUSES = ["buscando", "encontrado", "en_pausa", "cancelado"] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  sin_contactar: "⏳ Sin contactar",
  interesado: "✅ Interesado",
  contactado: "💬 Contactado",
  recontactar: "📞 Recontactar",
  no_contesta: "❌ No contesta",
  no_interesado: "🚫 No interesado",
  cerrado: "🤝 Cerrado",
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  buscando: "🔎 Buscando",
  encontrado: "✅ Encontrado",
  en_pausa: "⏸️ En pausa",
  cancelado: "🚫 Cancelado",
};

/** Estados que sacan al lead de la bandeja activa. */
export const ARCHIVED_LEAD_STATUSES: LeadStatus[] = ["cerrado", "no_interesado"];

/** Estados que implican que todavia hay que responderle a alguien. */
export const PENDING_LEAD_STATUSES: LeadStatus[] = ["sin_contactar", "recontactar"];

const LEAD_STATUS_TONES: Record<LeadStatus, string> = {
  sin_contactar: "border-slate-200 bg-slate-100 text-slate-600",
  interesado: "border-emerald-200 bg-emerald-50 text-emerald-700",
  contactado: "border-sky-200 bg-sky-50 text-sky-700",
  recontactar: "border-amber-200 bg-amber-50 text-amber-700",
  no_contesta: "border-red-200 bg-red-50 text-red-700",
  no_interesado: "border-slate-200 bg-slate-100 text-slate-500",
  cerrado: "border-blue-200 bg-blue-50 text-blue-700",
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    // Descarta acentos, emojis y simbolos de una: solo interesa el texto del estado.
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * El orden importa: "sin contactar" se evalua antes que "contactar/contactado"
 * para que un estado no caiga en la rama equivocada por coincidencia parcial.
 */
const matchers: [LeadStatus, RegExp][] = [
  ["sin_contactar", /\bsin contactar\b/],
  ["no_contesta", /\bno contesta\b/],
  ["no_interesado", /\bno interesad/],
  ["recontactar", /\brecontactar\b/],
  ["interesado", /\binteresad/],
  ["contactado", /\bcontactad/],
  ["cerrado", /\bcerrad/],
];

export function parseLeadStatus(raw?: string | null): LeadStatus {
  if (!raw) return "sin_contactar";

  const text = normalize(raw);
  for (const [status, pattern] of matchers) {
    if (pattern.test(text)) return status;
  }

  return "sin_contactar";
}

export function parseRequestStatus(raw?: string | null): RequestStatus {
  const text = normalize(raw ?? "");
  if (/\bencontrad/.test(text)) return "encontrado";
  if (/\bpausa\b/.test(text)) return "en_pausa";
  if (/\bcancelad/.test(text)) return "cancelado";
  return "buscando";
}

export function leadStatusLabel(status: LeadStatus) {
  return LEAD_STATUS_LABELS[status];
}

export function leadStatusTone(status: LeadStatus) {
  return LEAD_STATUS_TONES[status];
}

export function isArchivedLeadStatus(status: LeadStatus) {
  return ARCHIVED_LEAD_STATUSES.includes(status);
}
