import { useState } from "react";
import { ChevronDown, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  formatPrice,
  formatPriceInput,
  parsePriceInput,
  PRICE_STATUS_LABELS,
  priceListItemStatus,
  priceListItemTitle,
  priceListItemToInput,
  priceStatusToSheetText,
} from "@/lib/priceList";
import {
  PRICE_CURRENCIES,
  PRICE_STATUSES,
  type PriceCurrency,
  type PriceListItem,
  type PriceListItemInput,
  type PriceStatus,
} from "@/types/priceList";

type PriceListItemCardProps = {
  item: PriceListItem;
  expanded: boolean;
  onToggle: () => void;
  onSave: (input: PriceListItemInput) => Promise<void>;
  onDelete: () => Promise<void>;
};

const TEXT_FIELDS: Array<{ key: keyof PriceListItemInput; label: string; placeholder?: string }> = [
  { key: "brand", label: "Marca" },
  { key: "unit", label: "Unidad" },
  { key: "version", label: "Version" },
  { key: "yearLabel", label: "Anio", placeholder: "2024 / fac abierta" },
  { key: "kmLabel", label: "Km", placeholder: "0km salon / 70000" },
  { key: "color", label: "Color" },
  { key: "fuel", label: "Combustible" },
  { key: "traction", label: "Traccion" },
  { key: "gearbox", label: "Caja" },
  { key: "displacement", label: "Cilindrada" },
];

const STATUS_STYLES: Record<PriceStatus, string> = {
  disponible: "border-emerald-200 bg-emerald-50 text-emerald-700",
  vendido: "border-slate-300 bg-slate-100 text-slate-600",
};

function StatusPill({ status, className }: { status: PriceStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
        STATUS_STYLES[status],
        className,
      )}
    >
      {PRICE_STATUS_LABELS[status]}
    </span>
  );
}

export function PriceListItemCard({
  item,
  expanded,
  onToggle,
  onSave,
  onDelete,
}: PriceListItemCardProps) {
  const [draft, setDraft] = useState<PriceListItemInput>(() => priceListItemToInput(item));
  const [cashText, setCashText] = useState(() => formatPriceInput(item.cashPrice));
  const [listText, setListText] = useState(() => formatPriceInput(item.listPrice));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const status = priceListItemStatus(item);
  const draftStatus = priceListItemStatus(draft);
  const isSold = status === "vendido";
  const mainPrice = item.cashPrice ?? item.listPrice;
  const showList = item.listPrice !== null && item.listPrice !== item.cashPrice;

  const setField = (key: keyof PriceListItemInput, value: string | boolean | number | null) => {
    setDraft((current) => ({ ...current, [key]: value }) as PriceListItemInput);
  };

  const handlePriceChange = (key: "cashPrice" | "listPrice", raw: string) => {
    const parsed = parsePriceInput(raw);
    const formatted = formatPriceInput(parsed);
    if (key === "cashPrice") setCashText(formatted);
    else setListText(formatted);
    setField(key, parsed);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  /** Cambia el estado sin abrir la tarjeta: es lo que mas se hace en el dia a dia. */
  const quickStatus = async (next: PriceStatus) => {
    setSaving(true);
    try {
      await onSave({ ...priceListItemToInput(item), controlMark: priceStatusToSheetText(next) });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setSaving(true);
    try {
      await onDelete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-white shadow-sm transition",
        expanded ? "border-slate-400 shadow-md sm:col-span-2" : "border-slate-200",
        isSold && !expanded ? "opacity-75" : "",
      )}
    >
      <button type="button" onClick={onToggle} className="block w-full px-4 pb-3 pt-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <h4 className="min-w-0 text-[15px] font-semibold leading-snug text-slate-900">
            {priceListItemTitle(item)}
          </h4>
          <ChevronDown
            className={cn("mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition", expanded && "rotate-180")}
          />
        </div>

        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {[item.yearLabel, item.kmLabel, item.color].map((part) => part.trim()).filter(Boolean).join(" · ") || "Sin datos"}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className={cn("text-lg font-bold tabular-nums", isSold ? "text-slate-400 line-through" : "text-slate-900")}>
            {formatPrice(mainPrice, item.currency)}
          </span>
          {showList ? (
            <span className="text-xs text-slate-500">Lista {formatPrice(item.listPrice, item.currency)}</span>
          ) : null}
          <span className="ml-auto flex items-center gap-1.5">
            <StatusPill status={status} />
          </span>
        </div>
      </button>

      {!expanded ? (
        <div className="border-t border-slate-100 px-4 py-2">
          {isSold ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void quickStatus("disponible")}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Volver a disponible"}
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => void quickStatus("vendido")}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Marcar como vendido"}
            </button>
          )}
        </div>
      ) : null}

      {expanded ? (
        <div className="space-y-4 border-t border-slate-200 bg-slate-50/70 px-4 py-4">
          <div>
            <span className="text-xs font-semibold text-slate-600">Estado</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {PRICE_STATUSES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setField("controlMark", priceStatusToSheetText(option))}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                    draftStatus === option
                      ? cn(STATUS_STYLES[option], "ring-2 ring-slate-900/10")
                      : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50",
                  )}
                >
                  {PRICE_STATUS_LABELS[option]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 space-y-1 sm:col-span-1">
              <span className="text-xs font-semibold text-slate-600">Precio contado</span>
              <Input
                inputMode="numeric"
                value={cashText}
                placeholder="0"
                onChange={(event) => handlePriceChange("cashPrice", event.target.value)}
              />
            </label>
            <label className="col-span-2 space-y-1 sm:col-span-1">
              <span className="text-xs font-semibold text-slate-600">Precio lista</span>
              <Input
                inputMode="numeric"
                value={listText}
                placeholder="0"
                onChange={(event) => handlePriceChange("listPrice", event.target.value)}
              />
            </label>
            <label className="col-span-2 space-y-1 sm:col-span-1">
              <span className="text-xs font-semibold text-slate-600">Moneda</span>
              <Select
                value={draft.currency}
                onChange={(event) => setField("currency", event.target.value as PriceCurrency)}
              >
                {PRICE_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency === "USD" ? "USD (dolares)" : "ARS (pesos)"}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {TEXT_FIELDS.map((field) => (
              <label key={field.key} className="space-y-1">
                <span className="text-xs font-semibold text-slate-600">{field.label}</span>
                <Input
                  value={String(draft[field.key] ?? "")}
                  placeholder={field.placeholder}
                  onChange={(event) => setField(field.key, event.target.value)}
                />
              </label>
            ))}
            <label className="col-span-2 space-y-1">
              <span className="text-xs font-semibold text-slate-600">Foto (URL)</span>
              <Input
                value={draft.photoUrl}
                placeholder="https://..."
                onChange={(event) => setField("photoUrl", event.target.value)}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar
            </Button>
            <Button variant="outline" onClick={onToggle} disabled={saving}>
              Cerrar
            </Button>
            <Button
              variant={confirmDelete ? "destructive" : "ghost"}
              onClick={handleDelete}
              disabled={saving}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {confirmDelete ? "Confirmar" : "Borrar"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
