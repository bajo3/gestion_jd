import { useEffect, useState } from "react";
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
import { formatDateTime } from "@/lib/utils";
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

function relativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} dias`;

  const months = Math.floor(days / 30);
  if (months < 12) return `hace ${months} mes${months > 1 ? "es" : ""}`;

  const years = Math.floor(months / 12);
  return `hace ${years} anio${years > 1 ? "s" : ""}`;
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
          <h3 className="text-lg font-semibold text-slate-950">Historial</h3>
          <p className="text-sm text-slate-500">
            Todo lo que paso con esta unidad, de lo mas reciente a lo mas viejo.
          </p>
        </div>

        <div className="space-y-2">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Anotar algo: llamada, visita, oferta, arreglo pendiente..."
            rows={2}
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
          <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">
            Todavia no hay movimientos registrados. Se van a ir sumando solos cada vez que edites el auto.
          </div>
        ) : (
          <ol className="relative space-y-1 border-l border-slate-200 pl-6">
            {events.map((event) => {
              const Icon = eventIcons[event.type] ?? CalendarClock;
              return (
                <li key={event.id} className="relative pb-5">
                  <span
                    className={`absolute -left-[2.15rem] flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-white ${eventTone[event.type] ?? "bg-slate-100 text-slate-700"}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>

                  <p className="font-medium text-slate-900">{event.summary}</p>

                  <p className="text-xs text-slate-500">
                    {formatDateTime(event.occurredAt)} · {relativeTime(event.occurredAt)}
                    {event.actor ? ` · ${event.actor}` : ""}
                  </p>

                  {event.detail ? <p className="mt-1 text-sm text-slate-600">{event.detail}</p> : null}

                  {event.changes.length > 1 ? (
                    <ul className="mt-2 space-y-1 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                      {event.changes.map((change) => (
                        <li key={change.field}>
                          <span className="font-medium text-slate-700">{change.label}:</span> {change.from} → {change.to}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
