import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { CatalogVehicleCard } from "@/components/catalogo/CatalogVehicleCard";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { normalizeSearchTerm, priceListItemSearchText } from "@/lib/priceList";
import { listPriceListItems } from "@/services/priceListService";
import type { PriceListItem } from "@/types/priceList";

const WHATSAPP_PHONE = import.meta.env.VITE_PUBLIC_WHATSAPP ?? "";

type SortKey = "marca" | "precio_asc" | "precio_desc";

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "marca", label: "Por marca" },
  { value: "precio_asc", label: "Menor precio" },
  { value: "precio_desc", label: "Mayor precio" },
];

/** Los precios en dolares se comparan a un valor alto para que no queden mezclados con los pesos. */
function comparablePrice(item: PriceListItem) {
  const value = item.listPrice ?? item.cashPrice;
  if (value === null) return Number.POSITIVE_INFINITY;
  return item.currency === "USD" ? value * 1000 : value;
}

export function CatalogoPage() {
  const [items, setItems] = useState<PriceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("marca");

  useEffect(() => {
    let active = true;

    listPriceListItems({ onlyPublic: true })
      .then((data) => {
        if (active) setItems(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const brands = useMemo(
    () =>
      [...new Set(items.map((item) => item.brand).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    [items],
  );

  const visibleItems = useMemo(() => {
    const search = normalizeSearchTerm(term);

    const filtered = items.filter((item) => {
      if (brandFilter && item.brand !== brandFilter) return false;
      if (!search) return true;
      return priceListItemSearchText(item).includes(search);
    });

    if (sortKey === "marca") return filtered;

    return [...filtered].sort((a, b) => {
      const diff = comparablePrice(a) - comparablePrice(b);
      return sortKey === "precio_asc" ? diff : -diff;
    });
  }, [items, term, brandFilter, sortKey]);

  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      <header className="bg-black">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <img
            src="/logo-jd-negro.png"
            alt="Jesus Diaz Automotores"
            className="h-auto w-[190px] rounded-md"
          />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Nuestros vehiculos
            </h1>
            <p className="mt-1 text-sm text-white/65">
              Precios actualizados. Consultanos por el que te interese.
            </p>
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-6xl space-y-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                value={term}
                placeholder="Buscar marca, modelo, color..."
                onChange={(event) => setTerm(event.target.value)}
              />
            </div>
            <Select
              className="sm:w-52"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button
              type="button"
              onClick={() => setBrandFilter("")}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition",
                brandFilter
                  ? "border-slate-300 bg-white text-slate-600"
                  : "border-slate-900 bg-slate-900 text-white",
              )}
            >
              Todas
            </button>
            {brands.map((brand) => (
              <button
                key={brand}
                type="button"
                onClick={() => setBrandFilter((current) => (current === brand ? "" : brand))}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition",
                  brandFilter === brand
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {brand}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando vehiculos...
          </p>
        ) : null}

        {!loading && visibleItems.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
            No encontramos vehiculos con esa busqueda.
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((item) => (
            <CatalogVehicleCard key={item.id} item={item} whatsappPhone={WHATSAPP_PHONE} />
          ))}
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-slate-500 sm:px-6 lg:px-8">
          Jesus Diaz Automotores - Los precios pueden variar sin previo aviso. Consultanos para
          confirmar disponibilidad.
        </div>
      </footer>
    </div>
  );
}
