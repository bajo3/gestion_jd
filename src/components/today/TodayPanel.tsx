import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, CheckCircle2, Copy, EyeOff, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { markCommercialAlertContacted } from "@/services/commercialAlertsService";
import { markLeadContacted } from "@/services/leadsService";
import { loadTodayTasks, TODAY_KIND_LABELS, type TodayTask, type TodayTaskKind } from "@/services/todayService";

const KIND_STYLES: Record<TodayTaskKind, string> = {
  lead: "border-rose-200 bg-rose-50 text-rose-700",
  request: "border-emerald-200 bg-emerald-50 text-emerald-700",
  followup: "border-amber-200 bg-amber-50 text-amber-700",
  quote: "border-sky-200 bg-sky-50 text-sky-700",
  missing_sale: "border-red-200 bg-red-50 text-red-700",
  pending: "border-slate-200 bg-slate-100 text-slate-600",
};

const KIND_SHORT: Record<TodayTaskKind, string> = {
  lead: "Lead",
  request: "Encargo",
  followup: "Seguimiento",
  quote: "Presupuesto",
  missing_sale: "Venta incompleta",
  pending: "Pendiente",
};

const KIND_ORDER: TodayTaskKind[] = ["lead", "request", "followup", "quote", "missing_sale", "pending"];
const COLLAPSED_COUNT = 6;
const DISMISSED_KEY = "gestion_jd_today_dismissed";

function readDismissed(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveDismissed(ids: string[]) {
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
  } catch {
    // Sin almacenamiento la tarea vuelve a aparecer al recargar; no es grave.
  }
}

/** Lista del dia: lo urgente primero, con el WhatsApp ya escrito y un boton para resolverlo. */
export function TodayPanel() {
  const [tasks, setTasks] = useState<TodayTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<TodayTaskKind | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadTodayTasks()
      .then((next) => {
        if (active) {
          const dismissed = new Set(readDismissed());
          setTasks(next.filter((task) => !dismissed.has(task.id)));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(() => {
    const result = new Map<TodayTaskKind, number>();
    for (const task of tasks) result.set(task.kind, (result.get(task.kind) ?? 0) + 1);
    return result;
  }, [tasks]);

  const filtered = kind ? tasks.filter((task) => task.kind === kind) : tasks;
  const visible = expanded ? filtered : filtered.slice(0, COLLAPSED_COUNT);

  const copyMessage = async (task: TodayTask) => {
    if (!task.message) return;
    try {
      await navigator.clipboard.writeText(task.message);
      setCopiedId(task.id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // Sin permiso de portapapeles no hay nada que hacer: el mensaje igual va en el link de WhatsApp.
    }
  };

  /** Saca la tarea de la lista dejando el lead o el seguimiento como contactado. */
  const markDone = async (task: TodayTask) => {
    if (!task.sourceId) return;
    setBusyId(task.id);
    try {
      const ok =
        task.kind === "lead"
          ? await markLeadContacted(task.sourceId)
          : Boolean(await markCommercialAlertContacted(task.sourceId));
      if (ok) setTasks((current) => current.filter((item) => item.id !== task.id));
    } finally {
      setBusyId(null);
    }
  };

  /** Para ventas de prueba: la tarea deja de mostrarse en este navegador, sin tocar ningun dato. */
  const dismiss = (task: TodayTask) => {
    saveDismissed([...readDismissed(), task.id]);
    setTasks((current) => current.filter((item) => item.id !== task.id));
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ff0a8a]">Hoy</p>
            <h2 className="text-xl font-bold text-slate-950">
              {loading ? "Armando la lista del día…" : tasks.length ? `Qué hacer hoy (${tasks.length})` : "Estás al día"}
            </h2>
          </div>
          {tasks.length ? (
            <div className="flex flex-wrap gap-2">
              {KIND_ORDER.filter((item) => counts.get(item)).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setKind((current) => (current === item ? null : item));
                    setExpanded(false);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    kind === item ? "border-slate-900 bg-slate-900 text-white" : KIND_STYLES[item],
                  )}
                >
                  {TODAY_KIND_LABELS[item]} · {counts.get(item)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Revisando leads, seguimientos, presupuestos y ventas…
          </p>
        ) : null}

        {!loading && !tasks.length ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
            No hay leads sin contestar, seguimientos vencidos ni ventas con datos faltantes.
          </p>
        ) : null}

        {visible.length ? (
          <ul className="divide-y divide-slate-100">
            {visible.map((task) => {
              const canWhatsApp = Boolean(task.phone && task.message);
              const canMarkDone = Boolean(task.sourceId) && (task.kind === "lead" || task.kind === "followup");
              return (
                <li key={task.id} className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-bold", KIND_STYLES[task.kind])}>
                        {KIND_SHORT[task.kind]}
                      </span>
                      <span className="truncate text-sm font-semibold text-slate-900">{task.title}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {task.detail}
                      {task.message && !task.phone ? " · sin teléfono cargado" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {canWhatsApp ? (
                      <a href={buildWhatsAppUrl(task.phone ?? "", task.message ?? "")} target="_blank" rel="noreferrer">
                        <Button className="px-3 py-2 text-xs">
                          <MessageCircle className="mr-1.5 h-4 w-4" />
                          WhatsApp
                        </Button>
                      </a>
                    ) : null}
                    {task.message ? (
                      <Button variant="outline" className="px-3 py-2 text-xs" onClick={() => void copyMessage(task)}>
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        {copiedId === task.id ? "Copiado" : "Copiar mensaje"}
                      </Button>
                    ) : null}
                    {canMarkDone ? (
                      <Button
                        variant="secondary"
                        className="px-3 py-2 text-xs"
                        disabled={busyId === task.id}
                        onClick={() => void markDone(task)}
                      >
                        {busyId === task.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Ya le escribí
                      </Button>
                    ) : null}
                    {task.kind === "missing_sale" ? (
                      <Button variant="ghost" className="px-3 py-2 text-xs" onClick={() => dismiss(task)}>
                        <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                        Era una prueba
                      </Button>
                    ) : null}
                    <Link to={task.link.to} className="inline-flex items-center gap-1 px-1 text-xs font-semibold text-slate-600 hover:text-slate-900">
                      {task.link.label}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {filtered.length > COLLAPSED_COUNT ? (
          <Button variant="ghost" className="w-full" onClick={() => setExpanded((current) => !current)}>
            {expanded ? "Ver menos" : `Ver las ${filtered.length}`}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
