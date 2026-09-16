import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice, priceListItemTitle } from "@/lib/priceList";
import type { SheetConflict } from "@/services/priceListService";
import type { PriceListItemInput } from "@/types/priceList";

type SheetConflictPanelProps = {
  conflicts: SheetConflict[];
  onKeepWeb: (conflict: SheetConflict) => Promise<void>;
  onKeepSheet: (conflict: SheetConflict) => Promise<void>;
};

const COMPARED_FIELDS: Array<{ key: keyof PriceListItemInput; label: string }> = [
  { key: "unit", label: "Unidad" },
  { key: "version", label: "Version" },
  { key: "yearLabel", label: "Anio" },
  { key: "kmLabel", label: "Km" },
  { key: "color", label: "Color" },
  { key: "fuel", label: "Combustible" },
  { key: "traction", label: "Traccion" },
  { key: "gearbox", label: "Caja" },
  { key: "displacement", label: "Cilindrada" },
  { key: "controlMark", label: "Control" },
];

type Difference = { label: string; web: string; sheet: string };

/** Solo se listan los campos que realmente difieren, no el vehiculo entero. */
function differences(conflict: SheetConflict): Difference[] {
  const { item, sheetInput } = conflict;
  const rows: Difference[] = [];

  for (const field of COMPARED_FIELDS) {
    const web = String(item[field.key] ?? "").trim();
    const sheet = String(sheetInput[field.key] ?? "").trim();
    if (web !== sheet) rows.push({ label: field.label, web: web || "(vacio)", sheet: sheet || "(vacio)" });
  }

  if (item.cashPrice !== sheetInput.cashPrice || item.currency !== sheetInput.currency) {
    rows.push({
      label: "Precio contado",
      web: formatPrice(item.cashPrice, item.currency),
      sheet: formatPrice(sheetInput.cashPrice, sheetInput.currency),
    });
  }

  if (item.listPrice !== sheetInput.listPrice || item.currency !== sheetInput.currency) {
    rows.push({
      label: "Precio lista",
      web: formatPrice(item.listPrice, item.currency),
      sheet: formatPrice(sheetInput.listPrice, sheetInput.currency),
    });
  }

  return rows;
}

export function SheetConflictPanel({ conflicts, onKeepWeb, onKeepSheet }: SheetConflictPanelProps) {
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const resolve = async (conflict: SheetConflict, handler: (c: SheetConflict) => Promise<void>) => {
    setResolvingId(conflict.item.id);
    try {
      await handler(conflict);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <header className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <h3 className="text-sm font-bold text-amber-900">
            {conflicts.length === 1
              ? "Un vehiculo cambio en los dos lados"
              : `${conflicts.length} vehiculos cambiaron en los dos lados`}
          </h3>
          <p className="text-xs text-amber-800">
            Se editaron desde la web y tambien a mano en la planilla. Eligi cual queda.
          </p>
        </div>
      </header>

      <div className="space-y-3">
        {conflicts.map((conflict) => {
          const rows = differences(conflict);
          const busy = resolvingId === conflict.item.id;

          return (
            <article
              key={conflict.item.id}
              className="space-y-3 rounded-xl border border-amber-200 bg-white p-3"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <h4 className="text-sm font-bold text-slate-900">
                  {priceListItemTitle(conflict.item)}
                </h4>
                <span className="text-xs text-slate-500">
                  {conflict.item.brand} · fila {conflict.item.sheetRow}
                </span>
              </div>

              <ul className="space-y-2">
                {rows.map((row) => (
                  <li key={row.label} className="grid grid-cols-2 gap-2 text-xs">
                    <span className="col-span-2 font-semibold text-slate-600">{row.label}</span>
                    <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-700">
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Web
                      </span>
                      {row.web}
                    </span>
                    <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-slate-700">
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-amber-600">
                        Planilla
                      </span>
                      {row.sheet}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-2">
                <Button
                  className="flex-1"
                  variant="outline"
                  disabled={busy}
                  onClick={() => resolve(conflict, onKeepWeb)}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Dejar el de la web
                </Button>
                <Button className="flex-1" disabled={busy} onClick={() => resolve(conflict, onKeepSheet)}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Usar el de la planilla
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
