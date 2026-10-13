import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  CircleDollarSign,
  FileMinus,
  FileStack,
  Flag,
  Handshake,
  Loader2,
  PencilLine,
  StickyNote,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { listVehicleEvents, logVehicleEvent } from "@/services/vehicleEventsService";
import type { VehicleEvent, VehicleEventType } from "@/types/vehicleEvents";
import type { Vehicle } from "@/types/vehicles";

const eventIcons: Record<VehicleEventType, typeof Flag> = {
  created: Flag,
  status_changed: BadgeCheck,
  sold: Handshake,
  price_changed: CircleDollarSign,
  buyer_updated: UserRound,
  credit_updated: CircleDollarSign,
  file_added: FileStack,
  file_removed: FileMinus,
  note: StickyNote,
  updated: PencilLine,
};

const eventTone: Record<VehicleEventType, string> = {
  created: "bg-slate-100 text-slate-700",
  status_changed: "bg-blue-50 text-blue-700",
  sold: "bg-emerald-50 text-emerald-700",
  price_changed: "bg-amber-50 text-amber-700",
  buyer_updated: "bg-violet-50 text-violet-700",
  credit_updated: "bg-amber-50 text-amber-700",
  file_added: "bg-slate-100 text-slate-700",
  file_removed: "bg-rose-50 text-rose-700",
  note: "bg-sky-50 text-sky-700",
  updated: "bg-slate-100 text-slate-700",
};

const eventLabels: Record<VehicleEventType, string> = {
  created: "Alta",
  status_changed: "Estado",
  sold: "Venta",
  price_changed: "Precio",
  buyer_updated: "Comprador",
  credit_updated: "Financiación",
  file_added: "Adjunto",
  file_removed: "Adjunto borrado",
  note: "Nota",
  updated: "Edición",
};

/** "Hoy", "Ayer" o la fecha completa: es el titulo de cada grupo de movimientos. */
function dayLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  const startOfDay = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";

  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function groupByDay(events: VehicleEvent[]) {
  const groups: Array<{ label: string; events: VehicleEvent[] }> = [];

  for (const event of events) {
    const label = dayLabel(event.occurredAt);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.events.push(event);
    else groups.push({ label, events: [event] });
  }

  return groups;
}

function TimelineEvent({ event }: { event: VehicleEvent }) {
  const Icon = eventIcons[event.type] ?? CalendarClock;
  const time = timeLabel(event.occurredAt);

  return (
    <li className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          eventTone[event.type] ?? "bg-slate-100 text-slate-700",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="font-semibold text-slate-500">{eventLabels[event.type] ?? "Movimiento"}</span>
          <span className="shrink-0 text-slate-400">
            {time}
            {event.actor ? ` · ${event.actor}` : ""}
          </span>
        </div>

        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm font-medium text-slate-900">{event.summary}</p>

        {event.detail ? <p className="mt-1 break-words text-sm text-slate-600">{event.detail}</p> : null}

        {event.changes.length > 1 ? (
          <dl className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2.5 text-xs">
            {event.changes.map((change) => (
              <div key={change.field} className="flex flex-wrap items-baseline gap-x-1.5">
                <dt className="font-medium text-slate-600">{change.label}:</dt>
                <dd className="min-w-0 break-words text-slate-500">
                  {change.from !== "vacio" ? (
                    <>
                      <span className="line-through decoration-slate-300">{change.from}</span> →{" "}
                    </>
                  ) : null}
                  <span className="font-medium text-slate-900">{change.to}</span>
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </li>
  );
}

export function VehicleTimeline({ vehicle }: { vehicle: Vehicle }) {
  const [events, setEvents] = useState<VehicleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await listVehicleEvents(vehicle.id);
      if (cancelled) return;
      setEvents(result);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [vehicle.id, vehicle.updatedAt, reloadToken]);

  const groups = useMemo(() => groupByDay(events), [events]);

  async function handleAddNote() {
    const text = note.trim();
    if (!text || saving) return;

    setSaving(true);
    await logVehicleEvent({
      vehicleId: vehicle.id,
      type: "note",
      summary: text,
      changes: [],
      occurredAt: new Date().toISOString(),
    });
    setNote("");
    setSaving(false);
    setReloadToken((token) => token + 1);
  }

  return (
    <Card>
      <CardContent className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">
            Historial
            {events.length ? <span className="ml-2 text-sm font-medium text-slate-400">{events.length}</span> : null}
          </h3>
          <p className="text-sm text-slate-500">Todo lo que pasó con esta unidad, de lo más reciente a lo más viejo.</p>
        </div>

        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Anotar algo: llamada, visita, oferta, arreglo pendiente..."
            rows={2}
            className="min-h-20"
          />
          <div className="flex justify-end">
            <Button type="button" onClick={handleAddNote} disabled={!note.trim() || saving}>
              {saving ? "Guardando..." : "Agregar nota"}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando historial...
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Todavía no hay movimientos registrados. Se van a ir sumando solos cada vez que edites el auto.
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.label}>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{group.label}</h4>
                <ol className="space-y-2">
                  {group.events.map((event) => (
                    <TimelineEvent key={event.id} event={event} />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
