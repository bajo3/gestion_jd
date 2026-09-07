import { useState } from "react";
import { ChevronDown, Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatPrice, formatPriceInput, parsePriceInput, priceListItemTitle } from "@/lib/priceList";
import {
  PRICE_CURRENCIES,
  type PriceCurrency,
  type PriceListItem,
  type PriceListItemInput,
} from "@/types/priceList";

type PriceListItemCardProps = {
  item: PriceListItem;
  expanded: boolean;
  onToggle: () => void;
  onSave: (input: PriceListItemInput) => Promise<void>;
  onDelete: () => Promise<void>;
};

function toInput(item: PriceListItem): PriceListItemInput {
  return {
    brand: item.brand,
    unit: item.unit,
    yearLabel: item.yearLabel,
    kmLabel: item.kmLabel,
    version: item.version,
    color: item.color,
    fuel: item.fuel,
    traction: item.traction,
    gearbox: item.gearbox,
    displacement: item.displacement,
    cashPrice: item.cashPrice,
    listPrice: item.listPrice,
    currency: item.currency,
    controlMark: item.controlMark,
    photoUrl: item.photoUrl,
    isPublic: item.isPublic,
    sortOrder: item.sortOrder,
  };
}

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
  { key: "controlMark", label: "Control", placeholder: "x / - / ?" },
];

export function PriceListItemCard({
  item,
  expanded,
  onToggle,
  onSave,
  onDelete,
}: PriceListItemCardProps) {
  const [draft, setDraft] = useState<PriceListItemInput>(() => toInput(item));
  const [cashText, setCashText] = useState(() => formatPriceInput(item.cashPrice));
  const [listText, setListText] = useState(() => formatPriceInput(item.listPrice));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
        expanded ? "border-slate-400 shadow-md" : "border-slate-200",
        item.isPublic ? "" : "opacity-70",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-4 text-left"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-semibold text-slate-900">
              {priceListItemTitle(item)}
            </span>
            {item.isPublic ? null : (
              <Badge className="border-slate-200 bg-slate-100 text-slate-500">Oculto</Badge>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {[item.yearLabel, item.kmLabel, item.color].filter(Boolean).join(" - ") || "Sin datos"}
          </p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-sm font-bold text-slate-900">
              {formatPrice(item.listPrice, item.currency)}
            </span>
            <span className="text-xs text-slate-500">
              Contado {formatPrice(item.cashPrice, item.currency)}
            </span>
          </div>
        </div>
        <ChevronDown
          className={cn("mt-1 h-5 w-5 shrink-0 text-slate-400 transition", expanded && "rotate-180")}
        />
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-slate-200 bg-slate-50/70 px-4 py-4">
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

          <button
            type="button"
            onClick={() => setField("isPublic", !draft.isPublic)}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition",
              draft.isPublic
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-300 bg-white text-slate-600",
            )}
          >
            <span className="flex items-center gap-2">
              {draft.isPublic ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {draft.isPublic ? "Visible en el catalogo" : "Oculto para el cliente"}
            </span>
            <span
              className={cn(
                "flex h-6 w-11 items-center rounded-full p-0.5 transition",
                draft.isPublic ? "bg-emerald-500" : "bg-slate-300",
              )}
            >
              <span
                className={cn(
                  "h-5 w-5 rounded-full bg-white shadow transition",
                  draft.isPublic ? "translate-x-5" : "translate-x-0",
                )}
              />
            </span>
          </button>

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
