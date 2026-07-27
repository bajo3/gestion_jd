import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Download,
  Edit3,
  Filter,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import {
  isArchivedLeadStatus,
  LEAD_STATUS_LABELS,
  leadStatusLabel,
  leadStatusTone,
  parseLeadStatus,
  REQUEST_STATUS_LABELS,
} from "@/lib/leadStatus";
import { cn } from "@/lib/utils";

const CONTACTED_STATUS = LEAD_STATUS_LABELS.contactado;
const RECONTACT_STATUS = LEAD_STATUS_LABELS.recontactar;
const NO_ANSWER_STATUS = LEAD_STATUS_LABELS.no_contesta;

const MOVE_TO_REQUEST_STATUS = "Encargos";

const STATUS_OPTIONS = [
  LEAD_STATUS_LABELS.sin_contactar,
  LEAD_STATUS_LABELS.interesado,
  CONTACTED_STATUS,
  RECONTACT_STATUS,
  NO_ANSWER_STATUS,
  MOVE_TO_REQUEST_STATUS,
  LEAD_STATUS_LABELS.no_interesado,
  LEAD_STATUS_LABELS.cerrado,
];

const REQUEST_STATUS_OPTIONS = [
  REQUEST_STATUS_LABELS.buscando,
  REQUEST_STATUS_LABELS.encontrado,
  REQUEST_STATUS_LABELS.en_pausa,
  REQUEST_STATUS_LABELS.cancelado,
];

type LeadTab = "activos" | "archivados" | "encargos";
type LeadSource = "lead" | "encargo";

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

type Lead = {
  id: string;
  source: string;
  raw: Record<string, unknown>;
  nombre: string;
  auto: string;
  telefono: string;
  estado: string;
  notas: string;
  fechaLead: string;
  fechaContacto: string;
};

type LeadForm = {
  nombre: string;
  auto: string;
  telefono: string;
  estado: string;
  notas: string;
  fechaLead: string;
  fechaContacto: string;
};

function isCustomerRequest(lead: Pick<Lead, "source" | "raw">) {
  return lead.source === "encargo" || lead.raw.tipo === "encargo";
}

function isArchivedLead(lead: Lead) {
  return !isCustomerRequest(lead) && isArchivedLeadStatus(parseLeadStatus(lead.estado));
}

const emptyForm = (source: LeadSource = "lead"): LeadForm => ({
  nombre: "",
  auto: "",
  telefono: "",
  estado: source === "encargo" ? REQUEST_STATUS_LABELS.buscando : LEAD_STATUS_LABELS.sin_contactar,
  notas: "",
  fechaLead: new Date().toISOString().slice(0, 10),
  fechaContacto: "",
});

function normalizeLead(row: LeadRow): Lead {
  const raw = row.raw_json && typeof row.raw_json === "object" ? row.raw_json : {};
  // Los encargos tienen su propia lista de estados: se dejan tal cual vinieron.
  const isRequest = row.source === "encargo" || raw.tipo === "encargo";
  const rawStatus = row.status || LEAD_STATUS_LABELS.sin_contactar;

  return {
    id: row.lead_key,
    source: row.source || "",
    raw,
    nombre: row.buyer_name || "",
    auto: row.item_title || "",
    telefono: row.phone || "",
    estado: isRequest ? rawStatus : leadStatusLabel(parseLeadStatus(rawStatus)),
    notas: String(raw.notas || ""),
    fechaLead: row.date_created || "",
    fechaContacto: String(raw.fecha_contacto || ""),
  };
}

function toInputDate(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function displayDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR").format(date);
}

function daysSince(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function noAnswerDays(lead: Lead) {
  if (isCustomerRequest(lead) || parseLeadStatus(lead.estado) !== "no_contesta") return null;
  return daysSince(lead.fechaContacto || lead.fechaLead);
}

function shouldRecontactNoAnswer(lead: Lead) {
  const days = noAnswerDays(lead);
  return days !== null && days >= 3;
}

/** Un lead sigue "pendiente" mientras nadie lo toco. Los encargos no entran en este conteo. */
function esPendienteSinContactar(lead: Lead) {
  return !isCustomerRequest(lead) && parseLeadStatus(lead.estado) === "sin_contactar";
}

/** Mas de 3 dias sin que nadie lo contacte por primera vez. */
function esLeadVencido(lead: Lead) {
  if (!esPendienteSinContactar(lead)) return false;
  const dias = daysSince(lead.fechaLead);
  return dias !== null && dias > 3;
}

/**
 * Urgencia visual del lead: o esta vencido sin contactar, o quedo sin respuesta
 * tras un intento de contacto. Una vez que hubo alguna gestion (contactado,
 * interesado, etc.) deja de estar "urgente" por antiguedad.
 */
function esLeadUrgente(lead: Lead) {
  return esLeadVencido(lead) || shouldRecontactNoAnswer(lead);
}

function visibleStatus(lead: Lead) {
  // lead.estado ya viene canonizado desde normalizeLead, salvo en encargos.
  return shouldRecontactNoAnswer(lead) ? RECONTACT_STATUS : lead.estado;
}

function claseAntiguedad(dias: number) {
  if (dias <= 0) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (dias <= 3) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-500 bg-red-500 text-white";
}

/**
 * Color del contador de dias junto a la fecha del lead. Solo alarma (escala
 * verde/amarillo/rojo) mientras el lead sigue sin contactar o es un encargo;
 * una vez gestionado (contactado, interesado, recontactar, etc.) el contador
 * pasa a gris porque los dias desde la carga ya no significan nada.
 */
function claseBadgeDias(lead: Lead, dias: number | null) {
  if (dias === null) return "border-slate-200 text-slate-400";
  if (isCustomerRequest(lead) || esPendienteSinContactar(lead)) return claseAntiguedad(dias);
  return "border-slate-200 text-slate-400";
}

function whatsappLink(phone: string) {
  const number = phone.replace(/\D/g, "");
  return number ? `https://wa.me/${number}` : "";
}

function leadToForm(lead: Lead): LeadForm {
  return {
    nombre: lead.nombre,
    auto: lead.auto,
    telefono: lead.telefono,
    estado: lead.estado,
    notas: lead.notas,
    fechaLead: toInputDate(lead.fechaLead),
    fechaContacto: toInputDate(lead.fechaContacto),
  };
}

/** Los estados de encargo no pasan por el parser de leads, asi que se resuelven aparte. */
const requestStatusTones: Record<string, string> = {
  [REQUEST_STATUS_LABELS.buscando]: "border-violet-200 bg-violet-50 text-violet-700",
  [REQUEST_STATUS_LABELS.encontrado]: "border-emerald-200 bg-emerald-50 text-emerald-700",
  [REQUEST_STATUS_LABELS.en_pausa]: "border-amber-200 bg-amber-50 text-amber-700",
  [REQUEST_STATUS_LABELS.cancelado]: "border-slate-200 bg-slate-100 text-slate-500",
  [MOVE_TO_REQUEST_STATUS]: "border-violet-200 bg-violet-50 text-violet-700",
};

function statusClasses(status: string) {
  return requestStatusTones[status] ?? leadStatusTone(parseLeadStatus(status));
}

function visibleStatusClasses(lead: Lead) {
  if (esLeadUrgente(lead)) return "border-red-600 bg-red-500 text-white ring-2 ring-red-300 font-bold";
  return statusClasses(visibleStatus(lead));
}

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [tab, setTab] = useState<LeadTab>("activos");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [contactFilter, setContactFilter] = useState<"todos" | "sin-contacto" | "contactados" | "vencidos">("todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateOrder, setDateOrder] = useState<"desc" | "asc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formSource, setFormSource] = useState<LeadSource>("lead");
  const [form, setForm] = useState<LeadForm>(emptyForm);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const loadData = async () => {
    if (!supabase) {
      setLoading(false);
      setError("Faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.");
      return;
    }

    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("meli_leads")
      .select("*")
      .order("date_created", { ascending: false });

    if (loadError) {
      setError(loadError.message);
      setLeads([]);
    } else {
      setLeads(((data || []) as LeadRow[]).map(normalizeLead));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const regularLeads = leads.filter((lead) => !isCustomerRequest(lead));
    const activos = regularLeads.filter((lead) => !isArchivedLead(lead));
    const count = (status: string) => activos.filter((lead) => visibleStatus(lead) === status).length;

    return {
      activos: activos.length,
      sin: count(LEAD_STATUS_LABELS.sin_contactar),
      interesados: count(LEAD_STATUS_LABELS.interesado),
      contactados: count(CONTACTED_STATUS),
      recontactar: count(RECONTACT_STATUS),
      cerrados: regularLeads.filter((lead) => parseLeadStatus(lead.estado) === "cerrado").length,
      archivados: regularLeads.filter((lead) => isArchivedLead(lead)).length,
      encargos: leads.filter((lead) => isCustomerRequest(lead)).length,
    };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return leads
      .filter((lead) => {
        const isRequest = isCustomerRequest(lead);
        if (tab === "encargos" && !isRequest) return false;
        if (tab !== "encargos" && isRequest) return false;

        const isArchived = isArchivedLead(lead);
        if (tab === "activos" && isArchived) return false;
        if (tab === "archivados" && !isArchived) return false;

        const matchesQuery =
          !normalizedQuery ||
          [lead.nombre, lead.auto, lead.telefono, lead.notas].some((value) =>
            value.toLowerCase().includes(normalizedQuery),
          );
        const leadInputDate = toInputDate(lead.fechaLead);
        const hasContactDate = Boolean(toInputDate(lead.fechaContacto));
        const leadDays = daysSince(lead.fechaLead);
        const matchesContact =
          contactFilter === "todos" ||
          (contactFilter === "sin-contacto" && !hasContactDate) ||
          (contactFilter === "contactados" && hasContactDate) ||
          (contactFilter === "vencidos" && !hasContactDate && leadDays !== null && leadDays > 3);
        const matchesDateFrom = !dateFrom || (leadInputDate && leadInputDate >= dateFrom);
        const matchesDateTo = !dateTo || (leadInputDate && leadInputDate <= dateTo);
        const leadStatus = visibleStatus(lead);

        return (
          matchesQuery &&
          (!statusFilter || leadStatus === statusFilter) &&
          matchesContact &&
          matchesDateFrom &&
          matchesDateTo
        );
      })
      .sort((a, b) => {
        const aUrgent = esLeadUrgente(a);
        const bUrgent = esLeadUrgente(b);
        if (aUrgent !== bUrgent) return aUrgent ? -1 : 1;

        const da = a.fechaLead ? new Date(a.fechaLead).getTime() : Number.NaN;
        const db = b.fechaLead ? new Date(b.fechaLead).getTime() : Number.NaN;
        const aValid = !Number.isNaN(da);
        const bValid = !Number.isNaN(db);
        if (aValid && bValid) return dateOrder === "asc" ? da - db : db - da;
        if (bValid) return dateOrder === "asc" ? -1 : 1;
        if (aValid) return dateOrder === "asc" ? 1 : -1;
        return 0;
      });
  }, [contactFilter, dateFrom, dateOrder, dateTo, leads, query, statusFilter, tab]);

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("");
    setContactFilter("todos");
    setDateFrom("");
    setDateTo("");
    setDateOrder("desc");
  };

  const activeFilterCount = [
    query.trim(),
    statusFilter,
    contactFilter !== "todos" ? contactFilter : "",
    dateFrom,
    dateTo,
  ].filter(Boolean).length;

  const isRequestTab = tab === "encargos";
  const currentStatusOptions = isRequestTab ? REQUEST_STATUS_OPTIONS : STATUS_OPTIONS;

  const selectTab = (nextTab: LeadTab) => {
    setTab(nextTab);
    setStatusFilter("");
    setContactFilter("todos");
  };

  const updateLead = async (lead: Lead, patch: Partial<LeadForm>) => {
    if (!supabase) return;

    const moveToRequest = patch.estado === MOVE_TO_REQUEST_STATUS;
    const next = { ...leadToForm(lead), ...patch };
    if (moveToRequest) {
      next.estado = REQUEST_STATUS_OPTIONS[0];
    }
    if (patch.estado && !next.fechaContacto) {
      next.fechaContacto = new Date().toISOString().slice(0, 10);
    }
    const raw = {
      ...lead.raw,
      ...(isCustomerRequest(lead) || moveToRequest ? { tipo: "encargo" } : {}),
      notas: next.notas,
      fecha_contacto: next.fechaContacto,
    };
    const source = moveToRequest ? "encargo" : lead.source;

    const payload = {
      buyer_name: next.nombre,
      item_title: next.auto,
      phone: next.telefono,
      status: next.estado,
      date_created: next.fechaLead ? new Date(next.fechaLead).toISOString() : lead.fechaLead,
      source,
      raw_json: raw,
    };

    setLeads((current) =>
      current.map((item) =>
        item.id === lead.id
          ? normalizeLead({
              lead_key: item.id,
              source,
              ...payload,
            })
          : item,
      ),
    );

    const { error: updateError } = await supabase.from("meli_leads").update(payload).eq("lead_key", lead.id);
    if (updateError) {
      showToast("Error al guardar");
      await loadData();
    } else {
      showToast(moveToRequest ? "Movido a encargos" : "Guardado");
    }
  };

  const saveForm = async () => {
    if (!supabase || saving) return;
    if (!form.nombre.trim()) {
      showToast("Falta el nombre");
      return;
    }
    if (!form.auto.trim()) {
      showToast(formSource === "encargo" ? "Falta el auto buscado" : "Falta el auto/publicacion");
      return;
    }

    setSaving(true);
    const moveToRequest = form.estado === MOVE_TO_REQUEST_STATUS;
    const savingSource: LeadSource = editing
      ? isCustomerRequest(editing) || moveToRequest
        ? "encargo"
        : "lead"
      : moveToRequest
        ? "encargo"
        : formSource;
    const savingStatus = moveToRequest ? REQUEST_STATUS_OPTIONS[0] : form.estado;
    const raw = {
      ...(editing?.raw || {}),
      ...(savingSource === "encargo" ? { tipo: "encargo" } : {}),
      notas: form.notas.trim(),
      fecha_contacto: form.fechaContacto || "",
    };

    if (editing) {
      const payload = {
        buyer_name: form.nombre.trim(),
        item_title: form.auto.trim(),
        phone: form.telefono.trim(),
        status: savingStatus,
        date_created: form.fechaLead ? new Date(form.fechaLead).toISOString() : editing.fechaLead,
        source: savingSource === "encargo" ? "encargo" : editing.source || "manual",
        raw_json: raw,
      };
      const { error: updateError } = await supabase.from("meli_leads").update(payload).eq("lead_key", editing.id);
      if (updateError) {
        showToast("Error al guardar cambios");
      } else {
        setEditing(null);
        await loadData();
        showToast("Cambios guardados");
      }
    } else {
      const row = {
        lead_key: `${savingSource}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        source: savingSource === "encargo" ? "encargo" : "manual",
        buyer_name: form.nombre.trim(),
        item_title: form.auto.trim(),
        phone: form.telefono.trim(),
        status: savingStatus,
        date_created: form.fechaLead ? new Date(form.fechaLead).toISOString() : new Date().toISOString(),
        raw_json: raw,
      };
      const { error: insertError } = await supabase.from("meli_leads").insert(row);
      if (insertError) {
        showToast("Error al guardar");
      } else {
        setIsAdding(false);
        await loadData();
        showToast(formSource === "encargo" ? "Encargo agregado" : "Lead agregado");
      }
    }
    setSaving(false);
  };

  const openEdit = (lead: Lead) => {
    setEditing(lead);
    setFormSource(isCustomerRequest(lead) ? "encargo" : "lead");
    setForm(leadToForm(lead));
  };

  const openAdd = (source: LeadSource = "lead") => {
    setEditing(null);
    setFormSource(source);
    setForm(emptyForm(source));
    setIsAdding(true);
  };

  const closeModal = () => {
    setEditing(null);
    setIsAdding(false);
  };

  const modalOpen = Boolean(editing || isAdding);
  const modalIsRequest = formSource === "encargo";
  const modalStatusOptions = modalIsRequest ? REQUEST_STATUS_OPTIONS : STATUS_OPTIONS;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mercado Libre"
        title="Leads"
        description="Seguimiento comercial de consultas, estados, encargos y contacto por WhatsApp."
        actions={
          <>
            <a
              href="/leads/meli-leads-final.xlsx"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              <Download className="mr-2 h-4 w-4" />
              Excel original
            </a>
            <Button variant="outline" onClick={loadData} disabled={loading || !isSupabaseConfigured}>
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              Actualizar
            </Button>
            <Button variant="outline" onClick={() => openAdd("encargo")} disabled={!isSupabaseConfigured}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo encargo
            </Button>
            <Button onClick={() => openAdd("lead")} disabled={!isSupabaseConfigured}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo lead
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <Metric label="Activos" value={stats.activos} />
        <Metric label="Sin contactar" value={stats.sin} tone="slate" />
        <Metric label="Interesados" value={stats.interesados} tone="green" />
        <Metric label="Contactados" value={stats.contactados} tone="sky" />
        <Metric label="Recontactar" value={stats.recontactar} tone="amber" />
        <Metric label="Cerrados" value={stats.cerrados} tone="blue" />
        <Metric label="Encargos" value={stats.encargos} tone="violet" />
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
              <button
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-semibold transition",
                  tab === "activos" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500",
                )}
                onClick={() => selectTab("activos")}
              >
                Activos {stats.activos}
              </button>
              <button
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-semibold transition",
                  tab === "archivados" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500",
                )}
                onClick={() => selectTab("archivados")}
              >
                Archivados {stats.archivados}
              </button>
              <button
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-semibold transition",
                  tab === "encargos" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500",
                )}
                onClick={() => selectTab("encargos")}
              >
                Encargos {stats.encargos}
              </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder={isRequestTab ? "Buscar cliente, auto buscado, telefono..." : "Buscar nombre, auto, telefono..."}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <Button variant="outline" onClick={() => setShowFilters((value) => !value)}>
                <Filter className="mr-2 h-4 w-4" />
                Filtros{activeFilterCount ? ` (${activeFilterCount})` : ""}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {isRequestTab ? (
              <>
                <FilterChip active={!statusFilter} onClick={() => setStatusFilter("")}>
                  Todos
                </FilterChip>
                {REQUEST_STATUS_OPTIONS.map((status) => (
                  <FilterChip
                    key={status}
                    active={statusFilter === status}
                    onClick={() => setStatusFilter(statusFilter === status ? "" : status)}
                  >
                    {status.replace(/^[^\s]+ /, "")}
                  </FilterChip>
                ))}
              </>
            ) : (
              <>
                <FilterChip active={contactFilter === "todos"} onClick={() => setContactFilter("todos")}>
                  Todos
                </FilterChip>
                <FilterChip active={contactFilter === "vencidos"} onClick={() => setContactFilter("vencidos")}>
                  Vencidos
                </FilterChip>
                <FilterChip active={contactFilter === "sin-contacto"} onClick={() => setContactFilter("sin-contacto")}>
                  Sin contacto
                </FilterChip>
                <FilterChip active={statusFilter === CONTACTED_STATUS} onClick={() => setStatusFilter(statusFilter === CONTACTED_STATUS ? "" : CONTACTED_STATUS)}>
                  Contactado
                </FilterChip>
                <FilterChip active={statusFilter === RECONTACT_STATUS} onClick={() => setStatusFilter(statusFilter === RECONTACT_STATUS ? "" : RECONTACT_STATUS)}>
                  Recontactar
                </FilterChip>
              </>
            )}
            {activeFilterCount ? (
              <button className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100" onClick={clearFilters}>
                Limpiar filtros
              </button>
            ) : null}
          </div>

          {showFilters ? (
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2 xl:grid-cols-6">
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">Todos los estados</option>
                {currentStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
              {!isRequestTab ? (
                <Select value={contactFilter} onChange={(event) => setContactFilter(event.target.value as typeof contactFilter)}>
                  <option value="todos">Todos los contactos</option>
                  <option value="vencidos">Vencidos sin contacto</option>
                  <option value="sin-contacto">Sin fecha de contacto</option>
                  <option value="contactados">Con fecha de contacto</option>
                </Select>
              ) : null}
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} title="Desde" />
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} title="Hasta" />
              <Select value={dateOrder} onChange={(event) => setDateOrder(event.target.value as "desc" | "asc")}>
                <option value="desc">Mas recientes primero</option>
                <option value="asc">Mas antiguos primero</option>
              </Select>
              <Button variant="ghost" onClick={clearFilters}>
                Limpiar
              </Button>
            </div>
          ) : null}

          {!isSupabaseConfigured ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Faltan las variables de Supabase. Ya deje preparado el formato Vite en el proyecto.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Error al cargar leads: {error}
            </div>
          ) : null}

          <div className="grid gap-3 lg:hidden">
            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                Cargando leads...
              </div>
            ) : filteredLeads.length ? (
              filteredLeads.map((lead) => (
                <LeadCompactCard
                  key={lead.id}
                  lead={lead}
                  onEdit={() => openEdit(lead)}
                  onUpdate={(patch) => updateLead(lead, patch)}
                  statusOptions={isCustomerRequest(lead) ? REQUEST_STATUS_OPTIONS : STATUS_OPTIONS}
                />
              ))
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                {isRequestTab ? "Sin encargos" : "Sin resultados"}
              </div>
            )}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 lg:block">
            <table className="min-w-[1120px] w-full table-fixed border-collapse bg-white text-left text-xs xl:text-sm">
              <colgroup>
                <col className="w-[3%]" />
                <col className="w-[9%]" />
                <col className="w-[17%]" />
                <col className="w-[11%]" />
                <col className="w-[15%]" />
                <col className="w-[8%]" />
                <col className="w-[12%]" />
                <col className="w-[21%]" />
                <col className="w-[4%]" />
              </colgroup>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-3">#</th>
                  <th className="px-2 py-3">Nombre</th>
                  <th className="px-2 py-3">{isRequestTab ? "Buscado" : "Auto"}</th>
                  <th className="px-2 py-3">Telefono</th>
                  <th className="px-2 py-3">Estado</th>
                  <th className="px-2 py-3">{isRequestTab ? "Encargo" : "Lead"}</th>
                  <th className="px-2 py-3">Contacto</th>
                  <th className="px-2 py-3">Notas</th>
                  <th className="px-2 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                      Cargando leads...
                    </td>
                  </tr>
                ) : filteredLeads.length ? (
                  filteredLeads.map((lead, index) => (
                    <LeadTableRow
                      key={lead.id}
                      index={index + 1}
                      lead={lead}
                      onEdit={() => openEdit(lead)}
                      onUpdate={(patch) => updateLead(lead, patch)}
                      statusOptions={isCustomerRequest(lead) ? REQUEST_STATUS_OPTIONS : STATUS_OPTIONS}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                      {isRequestTab ? "Sin encargos" : "Sin resultados"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onMouseDown={closeModal}>
          <div
            className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-950">
                {editing ? "Editar" : "Nuevo"} {modalIsRequest ? "encargo" : "lead"}
              </h2>
              <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={closeModal}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-4 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={modalIsRequest ? "Cliente" : "Nombre"}>
                  <Input value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} />
                </Field>
                <Field label="Telefono">
                  <Input
                    value={form.telefono}
                    onChange={(event) => setForm({ ...form, telefono: event.target.value })}
                  />
                </Field>
              </div>
              <Field label={modalIsRequest ? "Auto buscado" : "Auto / publicacion"}>
                <Input value={form.auto} onChange={(event) => setForm({ ...form, auto: event.target.value })} />
              </Field>
              <Field label="Estado">
                <Select value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value })}>
                  {modalStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Fecha contacto">
                  <Input
                    type="date"
                    value={form.fechaContacto}
                    onChange={(event) => setForm({ ...form, fechaContacto: event.target.value })}
                  />
                </Field>
                <Field label={modalIsRequest ? "Fecha encargo" : "Fecha lead"}>
                  <Input
                    type="date"
                    value={form.fechaLead}
                    onChange={(event) => setForm({ ...form, fechaLead: event.target.value })}
                  />
                </Field>
              </div>
              <Field label="Notas">
                <Textarea value={form.notas} onChange={(event) => setForm({ ...form, notas: event.target.value })} />
              </Field>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <Button variant="outline" onClick={closeModal}>
                Cancelar
              </Button>
              <Button onClick={saveForm} disabled={saving}>
                <Check className="mr-2 h-4 w-4" />
                Guardar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "pink",
}: {
  label: string;
  value: number;
  tone?: "pink" | "slate" | "green" | "sky" | "violet" | "amber" | "blue";
}) {
  const tones = {
    pink: "text-[#ff0a8a]",
    slate: "text-slate-900",
    green: "text-emerald-600",
    sky: "text-sky-600",
    violet: "text-violet-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
  };

  return (
    <Card>
      <CardContent className="py-5">
        <div className={cn("text-3xl font-black", tones[tone])}>{value}</div>
        <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      </CardContent>
    </Card>
  );
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function LeadTableRow({
  index,
  lead,
  onEdit,
  onUpdate,
  statusOptions,
}: {
  index: number;
  lead: Lead;
  onEdit: () => void;
  onUpdate: (patch: Partial<LeadForm>) => void;
  statusOptions: string[];
}) {
  const days = daysSince(lead.fechaLead);
  const urgente = esLeadUrgente(lead);
  const currentStatus = visibleStatus(lead);
  const wa = whatsappLink(lead.telefono);
  const [notesDraft, setNotesDraft] = useState(lead.notas);

  useEffect(() => {
    setNotesDraft(lead.notas);
  }, [lead.notas]);

  return (
    <tr className={cn("align-top transition", urgente ? "bg-red-100 hover:bg-red-200/70" : "hover:bg-slate-50")}>
      <td className="px-2 py-3 font-mono text-xs text-slate-400">{index}</td>
      <td className="px-2 py-3">
        <div className="break-words font-semibold leading-tight text-slate-950">{lead.nombre || "-"}</div>
      </td>
      <td className="px-2 py-3 text-slate-600">
        <div className="line-clamp-2 break-words leading-tight" title={lead.auto}>
          {lead.auto || "-"}
        </div>
      </td>
      <td className="px-2 py-3">
        <div className="flex min-w-0 items-center gap-1.5">
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600"
              title="WhatsApp"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          ) : null}
          <span className="min-w-0 truncate font-mono text-[11px] text-slate-600" title={lead.telefono}>
            {lead.telefono || "-"}
          </span>
        </div>
      </td>
      <td className="px-2 py-3">
        <Select
          className={cn("h-10 w-full border px-2 text-xs font-semibold", visibleStatusClasses(lead))}
          value={currentStatus}
          onChange={(event) => onUpdate({ estado: event.target.value })}
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
      </td>
      <td className="px-2 py-3">
        <div className="text-[11px] font-semibold leading-tight text-slate-700">{displayDate(lead.fechaLead)}</div>
        <div
          className={cn(
            "mt-1 inline-flex rounded-md border px-2 py-0.5 text-xs font-bold",
            claseBadgeDias(lead, days),
          )}
        >
          {days === null ? "-" : days <= 0 ? "hoy" : `${days}d`}
        </div>
      </td>
      <td className="px-2 py-3">
        <Input
          type="date"
          className="h-10 w-full px-2 text-xs"
          value={toInputDate(lead.fechaContacto)}
          onChange={(event) => onUpdate({ fechaContacto: event.target.value })}
        />
      </td>
      <td className="px-2 py-3">
        <Textarea
          className="min-h-[72px] w-full resize-y px-3 py-2 text-sm leading-5"
          value={notesDraft}
          placeholder="Nota..."
          onChange={(event) => setNotesDraft(event.target.value)}
          onBlur={() => {
            if (notesDraft !== lead.notas) onUpdate({ notas: notesDraft });
          }}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              setNotesDraft(lead.notas);
              event.currentTarget.blur();
            }
          }}
        />
      </td>
      <td className="px-2 py-3">
        <Button variant="outline" className="h-10 w-10 px-0" onClick={onEdit} title="Editar">
          <Edit3 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}

function LeadCompactCard({
  lead,
  onEdit,
  onUpdate,
  statusOptions,
}: {
  lead: Lead;
  onEdit: () => void;
  onUpdate: (patch: Partial<LeadForm>) => void;
  statusOptions: string[];
}) {
  const days = daysSince(lead.fechaLead);
  const urgente = esLeadUrgente(lead);
  const currentStatus = visibleStatus(lead);
  const wa = whatsappLink(lead.telefono);
  const [notesDraft, setNotesDraft] = useState(lead.notas);

  useEffect(() => {
    setNotesDraft(lead.notas);
  }, [lead.notas]);

  return (
    <div
      className={cn(
        "grid gap-3 rounded-xl border bg-white p-4 shadow-sm",
        urgente ? "border-red-500 bg-red-100" : "border-slate-200",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-bold text-slate-950">{lead.nombre || "-"}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{lead.auto || "-"}</p>
        </div>
        <Button variant="outline" className="h-9 w-9 shrink-0 px-0" onClick={onEdit} title="Editar">
          <Edit3 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-slate-50 p-2">
          <div className="font-bold uppercase tracking-wide text-slate-400">Lead</div>
          <div className="mt-1 font-semibold text-slate-700">{displayDate(lead.fechaLead)}</div>
          <div
            className={cn(
              "mt-1 inline-flex rounded-md border px-2 py-0.5 font-bold",
              claseBadgeDias(lead, days),
            )}
          >
            {days === null ? "-" : days <= 0 ? "hoy" : `${days}d`}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <div className="font-bold uppercase tracking-wide text-slate-400">Telefono</div>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600"
                title="WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            ) : null}
            <span className="truncate font-mono text-[11px] text-slate-600">{lead.telefono || "-"}</span>
          </div>
        </div>
      </div>

      <Field label="Estado">
        <Select
          className={cn("h-10 border px-2 text-xs font-semibold", visibleStatusClasses(lead))}
          value={currentStatus}
          onChange={(event) => onUpdate({ estado: event.target.value })}
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Fecha contacto">
        <Input
          type="date"
          className="h-10 px-2 text-xs"
          value={toInputDate(lead.fechaContacto)}
          onChange={(event) => onUpdate({ fechaContacto: event.target.value })}
        />
      </Field>

      <Field label="Notas">
        <Textarea
          className="min-h-24 resize-y px-3 py-2 text-sm leading-5"
          value={notesDraft}
          placeholder="Nota..."
          onChange={(event) => setNotesDraft(event.target.value)}
          onBlur={() => {
            if (notesDraft !== lead.notas) onUpdate({ notas: notesDraft });
          }}
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
