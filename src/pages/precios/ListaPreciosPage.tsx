import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, ExternalLink, Loader2, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PriceListItemCard } from "@/components/precios/PriceListItemCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  groupByBrand,
  normalizeSearchTerm,
  priceListItemSearchText,
} from "@/lib/priceList";
import {
  createPriceListItem,
  deletePriceListItem,
  listPriceListItems,
  sortPriceListItems,
  updatePriceListItem,
} from "@/services/priceListService";
import {
  emptyPriceListItem,
  type PriceListItem,
  type PriceListItemInput,
} from "@/types/priceList";

const NEW_ITEM_ID = "nuevo";

function buildNewItem(brand: string): PriceListItem {
  return { ...emptyPriceListItem(brand), id: NEW_ITEM_ID, createdAt: "", updatedAt: "" };
}

export function ListaPreciosPage() {
  const [items, setItems] = useState<PriceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [onlyHidden, setOnlyHidden] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    listPriceListItems()
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
    () => [...new Set(items.map((item) => item.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    [items],
  );

  const filtered = useMemo(() => {
    const search = normalizeSearchTerm(term);

    return items.filter((item) => {
      if (brandFilter && item.brand !== brandFilter) return false;
      if (onlyHidden && item.isPublic) return false;
      if (!search) return true;
      return priceListItemSearchText(item).includes(search);
    });
  }, [items, term, brandFilter, onlyHidden]);

  const groups = useMemo(() => groupByBrand(filtered), [filtered]);
  const publicCount = useMemo(() => items.filter((item) => item.isPublic).length, [items]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const handleSave = async (id: string, input: PriceListItemInput) => {
    const { item, persisted } = await updatePriceListItem(id, input);
    setItems((current) => sortPriceListItems(current.map((entry) => (entry.id === id ? item : entry))));
    setExpandedId(null);
    flash(persisted ? "Cambios guardados." : "Guardado solo en este telefono: no hubo conexion.");
  };

  const handleCreate = async (input: PriceListItemInput) => {
    if (!input.unit.trim() && !input.brand.trim()) {
      flash("Cargá al menos la marca y la unidad.");
      return;
    }

    const brandItems = items.filter((entry) => entry.brand === input.brand.trim());
    const nextOrder = brandItems.reduce((max, entry) => Math.max(max, entry.sortOrder), 0) + 10;

    const { item, persisted } = await createPriceListItem({ ...input, sortOrder: nextOrder });
    setItems((current) => sortPriceListItems([...current, item]));
    setCreating(false);
    flash(persisted ? "Vehiculo agregado." : "Agregado solo en este telefono: no hubo conexion.");
  };

  const handleDelete = async (id: string) => {
    const { persisted } = await deletePriceListItem(id);
    setItems((current) => current.filter((entry) => entry.id !== id));
    setExpandedId(null);
    flash(persisted ? "Vehiculo borrado." : "Borrado solo en este telefono: no hubo conexion.");
  };

  const copyCatalogLink = async () => {
    const url = `${window.location.origin}/catalogo`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      flash(url);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalogo"
        title="Lista de precios"
        description="La misma planilla, pero editable desde el celular. Lo que marques como visible aparece en el catalogo publico."
        actions={
          <>
            <Button variant="outline" onClick={copyCatalogLink}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Link copiado" : "Copiar link"}
            </Button>
            <Link to="/catalogo" target="_blank" rel="noreferrer">
              <Button variant="secondary">
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver catalogo
              </Button>
            </Link>
          </>
        }
      />

      <div className="sticky top-[73px] z-10 -mx-4 space-y-3 bg-[#f7f7f8]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            value={term}
            placeholder="Buscar por marca, modelo, color..."
            onChange={(event) => setTerm(event.target.value)}
          />
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <FilterChip active={!brandFilter && !onlyHidden} onClick={() => {
            setBrandFilter("");
            setOnlyHidden(false);
          }}>
            Todas ({items.length})
          </FilterChip>
          <FilterChip active={onlyHidden} onClick={() => {
            setOnlyHidden((current) => !current);
            setBrandFilter("");
          }}>
            Ocultas ({items.length - publicCount})
          </FilterChip>
          {brands.map((brand) => (
            <FilterChip
              key={brand}
              active={brandFilter === brand}
              onClick={() => {
                setBrandFilter((current) => (current === brand ? "" : brand));
                setOnlyHidden(false);
              }}
            >
              {brand}
            </FilterChip>
          ))}
        </div>
      </div>

      {notice ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          {notice}
        </p>
      ) : null}

      {creating ? (
        <PriceListItemCard
          item={buildNewItem(brandFilter)}
          expanded
          onToggle={() => setCreating(false)}
          onSave={handleCreate}
          onDelete={async () => setCreating(false)}
        />
      ) : (
        <Button className="w-full sm:w-auto" onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar vehiculo
        </Button>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex items-center gap-3 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando lista...
          </CardContent>
        </Card>
      ) : null}

      {!loading && filtered.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-slate-600">
            No hay vehiculos que coincidan con la busqueda.
          </CardContent>
        </Card>
      ) : null}

      {groups.map(([brand, brandItems]) => (
        <section key={brand} className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">{brand}</h3>
            <span className="text-xs text-slate-400">{brandItems.length}</span>
          </div>
          <div className="space-y-3">
            {brandItems.map((item) => (
              <PriceListItemCard
                key={`${item.id}-${item.updatedAt}`}
                item={item}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId((current) => (current === item.id ? null : item.id))}
                onSave={(input) => handleSave(item.id, input)}
                onDelete={() => handleDelete(item.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

type FilterChipProps = {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function FilterChip({ active, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition",
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}
