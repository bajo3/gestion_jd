import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, ClipboardList, Pin, Plus, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createPendingItem,
  listPendingItems,
  setPendingItemCompleted,
} from "@/services/pendingItemsService";
import type { PendingItem } from "@/types/pendingItems";

const NOTE_STYLES = [
  {
    surface: "bg-[#fff4a3]",
    pin: "text-[#e7a900]",
    tilt: "rotate-[-1.5deg]",
  },
  {
    surface: "bg-[#ffd6e9]",
    pin: "text-[#ec5f9d]",
    tilt: "rotate-[1.2deg]",
  },
  {
    surface: "bg-[#ccefdc]",
    pin: "text-[#44a56b]",
    tilt: "rotate-[-0.8deg]",
  },
  {
    surface: "bg-[#d8e7ff]",
    pin: "text-[#5f89c9]",
    tilt: "rotate-[1.8deg]",
  },
] as const;

type PendingTab = "pendientes" | "realizados";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
  }).format(date);
}

export function PendientesPage() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [tab, setTab] = useState<PendingTab>("pendientes");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");

  useEffect(() => {
    let active = true;

    listPendingItems().then((loadedItems) => {
      if (!active) return;
      setItems(loadedItems);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const pendingItems = useMemo(() => items.filter((item) => !item.completedAt), [items]);
  const completedItems = useMemo(() => items.filter((item) => item.completedAt), [items]);
  const visibleItems = tab === "pendientes" ? pendingItems : completedItems;

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  };

  const addPending = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    setSaving(true);
    const result = await createPendingItem({
      title: cleanTitle,
      details: details.trim(),
      styleIndex: items.length % NOTE_STYLES.length,
    });

    setItems((current) => [result.item, ...current.filter((item) => item.id !== result.item.id)]);
    setTitle("");
    setDetails("");
    setShowForm(false);
    setTab("pendientes");
    setSaving(false);

    if (!result.persisted) {
      showToast("Se guardó localmente; Supabase no respondió.");
    }
  };

  const toggleCompleted = async (id: string) => {
    const item = items.find((current) => current.id === id);
    if (!item) return;

    const completedAt = item.completedAt ? null : new Date().toISOString();
    setItems((current) =>
      current.map((currentItem) =>
        currentItem.id === id ? { ...currentItem, completedAt } : currentItem,
      ),
    );

    const result = await setPendingItemCompleted(id, completedAt);
    if (result.item) {
      setItems((current) =>
        current.map((currentItem) => (currentItem.id === id ? result.item! : currentItem)),
      );
    }

    if (!result.persisted) {
      showToast("El cambio quedó local; Supabase no respondió.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pendientes"
        description="Anotá lo que falta y marcá cada tarea cuando esté realizada."
        actions={
          <Button onClick={() => setShowForm((current) => !current)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo pendiente
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Pendientes" value={pendingItems.length} tone="text-[#ff0a8a]" />
        <SummaryCard label="Realizados" value={completedItems.length} tone="text-emerald-600" />
        <SummaryCard label="Total anotados" value={items.length} tone="text-slate-900" />
      </div>

      <Card className="border-[#eadfc9] bg-[#fffdf8]">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col gap-4 border-b border-[#eadfc9] pb-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff0f8] text-[#ff0a8a]">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-950">Tablero de tareas</h2>
            <p className="text-sm text-slate-500">Tus notas quedan guardadas en la base de datos.</p>
              </div>
            </div>

            <div className="flex rounded-xl border border-slate-200 bg-white p-1">
              <TabButton active={tab === "pendientes"} onClick={() => setTab("pendientes")}>
                Pendientes <span className="ml-1 opacity-70">{pendingItems.length}</span>
              </TabButton>
              <TabButton active={tab === "realizados"} onClick={() => setTab("realizados")}>
                Realizados <span className="ml-1 opacity-70">{completedItems.length}</span>
              </TabButton>
            </div>
          </div>

          {showForm ? (
            <form
              onSubmit={addPending}
              className="mt-5 grid gap-4 rounded-2xl border border-[#f2c9df] bg-[#fff7fb] p-4 md:grid-cols-[1fr_1.4fr_auto] md:items-end"
            >
              <label className="grid gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Pendiente</span>
                <Input
                  autoFocus
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ej. Revisar documentación del auto"
                  required
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Detalle (opcional)</span>
                <Textarea
                  className="min-h-10 resize-y"
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  placeholder="Agregá una nota para acordarte mejor..."
                  rows={1}
                />
              </label>
              <Button type="submit" className="h-10" disabled={saving}>
                <Check className="mr-2 h-4 w-4" />
                Guardar
              </Button>
            </form>
          ) : null}

          <div className="mt-6 rounded-[1.75rem] border border-[#eadfc9] bg-[#f6eedf] p-4 md:p-7">
            {loading ? (
              <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-[#d9cdb8] bg-white/40 p-8 text-center text-sm text-slate-500">
                Cargando pendientes...
              </div>
            ) : visibleItems.length ? (
              <div className="grid gap-x-7 gap-y-9 sm:grid-cols-2 xl:grid-cols-3">
                {visibleItems.map((item) => (
                  <PendingNote
                    key={item.id}
                    item={item}
                    onToggle={() => toggleCompleted(item.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-[#d9cdb8] bg-white/40 p-8 text-center">
                <div className="max-w-sm">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                    {tab === "pendientes" ? (
                      <ClipboardList className="h-6 w-6" />
                    ) : (
                      <CheckCircle2 className="h-6 w-6" />
                    )}
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-800">
                    {tab === "pendientes" ? "No hay pendientes" : "Todavía no hay tareas realizadas"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {tab === "pendientes"
                      ? "Cuando aparezca algo para hacer, agregalo como un papelito en este tablero."
                      : "Las tareas que marques como realizadas van a quedar guardadas acá."}
                  </p>
                  {tab === "pendientes" ? (
                    <Button className="mt-5" onClick={() => setShowForm(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Anotar pendiente
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-5">
        <div>
          <div className={`text-3xl font-black ${tone}`}>{value}</div>
          <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
        </div>
        <ClipboardList className="h-5 w-5 text-slate-300" />
      </CardContent>
    </Card>
  );
}

function TabButton({
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
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
        active ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function PendingNote({
  item,
  onToggle,
}: {
  item: PendingItem;
  onToggle: () => void;
}) {
  const styleIndex = Number.isInteger(item.styleIndex) ? Math.abs(item.styleIndex) : 0;
  const style = NOTE_STYLES[styleIndex % NOTE_STYLES.length];
  const isCompleted = Boolean(item.completedAt);

  return (
    <article
      className={`group relative min-h-52 overflow-visible rounded-sm p-5 shadow-[0_14px_24px_rgba(97,75,40,0.14)] transition hover:-translate-y-1 hover:shadow-[0_18px_28px_rgba(97,75,40,0.2)] ${style.surface} ${style.tilt} ${
        isCompleted ? "opacity-75" : ""
      }`}
    >
      <Pin className={`absolute -top-3 left-1/2 h-7 w-7 -translate-x-1/2 drop-shadow-sm ${style.pin}`} />
      <div className="flex min-h-40 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600/75">
              {isCompleted ? "Realizado" : "Pendiente"}
            </p>
            <h3 className={`mt-2 text-lg font-black leading-tight text-slate-900 ${isCompleted ? "line-through" : ""}`}>
              {item.title}
            </h3>
          </div>
          {isCompleted ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" /> : null}
        </div>

        {item.details ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.details}</p> : null}

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <span className="text-xs font-semibold text-slate-600/70">
            {isCompleted && item.completedAt ? `Listo el ${formatDate(item.completedAt)}` : `Anotado el ${formatDate(item.createdAt)}`}
          </span>
          <button
            type="button"
            onClick={onToggle}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-bold transition ${
              isCompleted
                ? "border-slate-900/15 bg-white/50 text-slate-700 hover:bg-white"
                : "border-emerald-700/20 bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
            aria-label={isCompleted ? `Volver a pendientes: ${item.title}` : `Marcar como realizado: ${item.title}`}
          >
            {isCompleted ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            {isCompleted ? "Volver" : "Listo"}
          </button>
        </div>
      </div>
      <span className="pointer-events-none absolute inset-x-7 bottom-2 h-px bg-black/5" aria-hidden="true" />
    </article>
  );
}
