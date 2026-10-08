import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Plus, Printer, Search, TriangleAlert, X } from "lucide-react";
import { PriceListItemCard } from "@/components/precios/PriceListItemCard";
import { SheetConflictPanel } from "@/components/precios/SheetConflictPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  groupByBrand,
  normalizeSearchTerm,
  priceListItemSearchText,
  priceListItemStatus,
} from "@/lib/priceList";
import {
  createPriceListItem,
  deletePriceListItem,
  listPriceListItems,
  pullSheetChanges,
  removeItemsFromApp,
  setItemHighlight,
  resolveConflictWithSheet,
  resolveConflictWithWeb,
  sortPriceListItems,
  updatePriceListItem,
  type SheetConflict,
} from "@/services/priceListService";
import { generateListaPreciosPdf } from "@/pdf/listaPreciosPdf";
import type { SheetSyncResult } from "@/services/sheetsSyncService";
import {
  emptyPriceListItem,
  type PriceListItem,
  type PriceListItemInput,
} from "@/types/priceList";

const NEW_ITEM_ID = "nuevo";

type StatusFilter = "disponibles" | "vendidos" | "todos";

function buildNewItem(brand: string): PriceListItem {
  return { ...emptyPriceListItem(brand), controlMark: "Disponible", id: NEW_ITEM_ID, sheetSnapshot: "", createdAt: "", updatedAt: "" };
}

function describePull(imported: number, created: number, rebranded: number) {
  const parts = [];
  if (rebranded) parts.push(`${rebranded} ${rebranded === 1 ? "marca corregida" : "marcas corregidas"}`);
  if (imported) parts.push(`${imported} ${imported === 1 ? "cambio" : "cambios"}`);
  if (created) parts.push(`${created} ${created === 1 ? "vehiculo nuevo" : "vehiculos nuevos"}`);
  return `Se importo de la planilla: ${parts.join(" y ")}.`;
}

/**
 * Un solo mensaje que cuenta las dos mitades del guardado: si quedo en Supabase
 * y si ademas se reflejo en la planilla de Google.
 */
function saveNotice(persisted: boolean, sheet: SheetSyncResult | null, done: string) {
  if (!persisted) return `${done} solo en este telefono: no hubo conexion.`;
  if (!sheet) return `${done}.`;
  if (sheet.ok) return `${done} y la planilla quedo actualizada.`;
  if (sheet.skipped) return `${done}. La planilla de Google todavia no esta conectada.`;
  return `${done}, pero la planilla no se actualizo: ${sheet.error ?? "error desconocido"}.`;
}

export function ListaPreciosPage() {
  const [allItems, setItems] = useState<PriceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("disponibles");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [conflicts, setConflicts] = useState<SheetConflict[]>([]);
  const [orphans, setOrphans] = useState<PriceListItem[]>([]);
  const [highlightedRows, setHighlightedRows] = useState<Set<number>>(new Set());
  const [sheetConnected, setSheetConnected] = useState(false);
  const [onlyHighlighted, setOnlyHighlighted] = useState(false);
  const [confirmOrphans, setConfirmOrphans] = useState<"copies" | "all" | null>(null);

  // Mientras no se resuelvan, los que ya no estan en la planilla no cuentan ni se imprimen.
  const items = useMemo(() => {
    if (!orphans.length) return allItems;
    const hidden = new Set(orphans.map((item) => item.id));
    return allItems.filter((item) => !hidden.has(item.id));
  }, [allItems, orphans]);

  const flash = (message: string, durationMs = 3000) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), durationMs);
  };

  useEffect(() => {
    let active = true;

    async function load() {
      const data = await listPriceListItems();
      if (!active) return;

      setItems(data);
      setLoading(false);

      // Trae lo que se haya editado a mano en la planilla. Lo que cambio de un
      // solo lado se aplica solo; lo que cambio en los dos queda como conflicto.
      const pull = await pullSheetChanges(data);
      if (!active || pull.skipped) return;

      if (pull.imported.length || pull.created.length || pull.rebranded.length) {
        const changed = new Map([...pull.rebranded, ...pull.imported, ...pull.created].map((item) => [item.id, item]));
        setItems((current) =>
          sortPriceListItems([
            ...current.map((item) => changed.get(item.id) ?? item),
            ...pull.created.filter((item) => !current.some((entry) => entry.id === item.id)),
          ]),
        );
        flash(describePull(pull.imported.length, pull.created.length, pull.rebranded.length), 6000);
      } else if (pull.error) {
        flash(`No se pudo leer la planilla: ${pull.error}`, 6000);
      }

      setConflicts(pull.conflicts);
      setOrphans(pull.orphans);
      setHighlightedRows(new Set(pull.highlightedRows));
      setSheetConnected(!pull.error);
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const brands = useMemo(
    () => [...new Set(items.map((item) => item.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    [items],
  );

  const soldCount = useMemo(() => items.filter((item) => priceListItemStatus(item) === "vendido").length, [items]);
  const availableCount = items.length - soldCount;

  const filtered = useMemo(() => {
    const search = normalizeSearchTerm(term);

    return items.filter((item) => {
      const sold = priceListItemStatus(item) === "vendido";
      if (statusFilter === "disponibles" && sold) return false;
      if (statusFilter === "vendidos" && !sold) return false;
      if (brandFilter && item.brand !== brandFilter) return false;
      if (onlyHighlighted && !(item.sheetRow && highlightedRows.has(item.sheetRow))) return false;
      if (!search) return true;
      return priceListItemSearchText(item).includes(search);
    });
  }, [items, term, brandFilter, statusFilter, onlyHighlighted, highlightedRows]);

  const groups = useMemo(() => groupByBrand(filtered), [filtered]);

  const handleSave = async (id: string, input: PriceListItemInput) => {
    const { item, persisted, sheet } = await updatePriceListItem(id, input);
    setItems((current) => sortPriceListItems(current.map((entry) => (entry.id === id ? item : entry))));
    setExpandedId(null);
    flash(saveNotice(persisted, sheet, "Cambios guardados"), 6000);
  };

  const handleCreate = async (input: PriceListItemInput) => {
    if (!input.unit.trim() && !input.brand.trim()) {
      flash("Cargá al menos la marca y la unidad.");
      return;
    }

    const brandItems = items.filter((entry) => entry.brand === input.brand.trim());
    const nextOrder = brandItems.reduce((max, entry) => Math.max(max, entry.sortOrder), 0) + 10;

    const { item, persisted, sheet } = await createPriceListItem({ ...input, sortOrder: nextOrder });
    setItems((current) => sortPriceListItems([...current, item]));
    setCreating(false);
    flash(saveNotice(persisted, sheet, "Vehiculo agregado"), 6000);
  };

  const handleDelete = async (id: string) => {
    const { persisted, sheet } = await deletePriceListItem(id);
    setItems((current) => current.filter((entry) => entry.id !== id));
    setExpandedId(null);
    flash(saveNotice(persisted, sheet, "Vehiculo borrado"), 6000);
  };

  const dropConflict = (conflict: SheetConflict, resolved: PriceListItem) => {
    setItems((current) =>
      sortPriceListItems(current.map((item) => (item.id === resolved.id ? resolved : item))),
    );
    setConflicts((current) => current.filter((entry) => entry.item.id !== conflict.item.id));
  };

  const handleKeepWeb = async (conflict: SheetConflict) => {
    dropConflict(conflict, await resolveConflictWithWeb(conflict));
    flash("Quedo el valor de la web y se reescribio la planilla.");
  };

  const handleKeepSheet = async (conflict: SheetConflict) => {
    dropConflict(conflict, await resolveConflictWithSheet(conflict));
    flash("Quedo el valor de la planilla.");
  };

  const printList = async (includeSold: boolean) => {
    setPrintMenuOpen(false);
    setPrinting(true);
    try {
      await generateListaPreciosPdf(items, { includeSold });
      flash("Lista de precios generada.");
    } catch {
      flash("No se pudo generar el PDF de la lista.");
    } finally {
      setPrinting(false);
    }
  };

  // Una "copia vieja" es un registro que apuntaba a una fila que se movio: el mismo auto ya figura
  // (con sus datos al dia) en otra fila. Los demas ya no estan en la planilla: vendidos o borrados alla.
  const { oldCopies, goneItems } = useMemo(() => {
    const norm = (value: string) => normalizeSearchTerm(value ?? "");
    // Mismo auto = misma marca, unidad y version (una version vacia vale para cualquiera).
    const hasTwin = (orphan: PriceListItem) =>
      items.some(
        (item) =>
          norm(item.brand) === norm(orphan.brand) &&
          norm(item.unit) === norm(orphan.unit) &&
          (!norm(item.version) || !norm(orphan.version) || norm(item.version) === norm(orphan.version)),
      );
    return {
      oldCopies: orphans.filter(hasTwin),
      goneItems: orphans.filter((orphan) => !hasTwin(orphan)),
    };
  }, [items, orphans]);

  const highlightedCount = useMemo(
    () => items.filter((item) => item.sheetRow && highlightedRows.has(item.sheetRow)).length,
    [items, highlightedRows],
  );

  const handleHighlight = async (item: PriceListItem, on: boolean) => {
    const result = await setItemHighlight(item, on);
    if (!result.ok) {
      flash(`No se pudo ${on ? "pintar" : "despintar"} la fila: ${result.error ?? "error desconocido"}.`, 6000);
      return;
    }
    setHighlightedRows((current) => {
      const next = new Set(current);
      if (item.sheetRow) {
        if (on) next.add(item.sheetRow);
        else next.delete(item.sheetRow);
      }
      return next;
    });
    flash(on ? "Fila pintada de amarillo en la planilla." : "Se quito el amarillo de la fila.");
  };

  const removeOrphans = async (scope: "copies" | "all") => {
    if (confirmOrphans !== scope) {
      setConfirmOrphans(scope);
      return;
    }

    const targets = scope === "copies" ? oldCopies : orphans;
    const ids = targets.map((item) => item.id);
    const { persisted } = await removeItemsFromApp(ids);
    setConfirmOrphans(null);
    if (!persisted) {
      flash("No se pudieron sacar: sin conexion con la base.", 6000);
      return;
    }
    setItems((current) => current.filter((item) => !ids.includes(item.id)));
    setOrphans((current) => current.filter((item) => !ids.includes(item.id)));
    flash(`Se sacaron ${ids.length} ${ids.length === 1 ? "registro viejo" : "registros viejos"}.`, 6000);
  };

  const describeItems = (list: PriceListItem[]) =>
    list
      .slice(0, 6)
      .map((item) => `${item.brand} ${[item.unit, item.version].filter(Boolean).join(" ")}`.trim())
      .join(" · ") + (list.length > 6 ? ` · y ${list.length - 6} mas` : "");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-700">Precios</span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Lista de precios</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="relative">
            <Button
              className="px-3"
              disabled={printing || loading || items.length === 0}
              onClick={() => setPrintMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={printMenuOpen}
            >
              {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              <span className="ml-2">Imprimir lista</span>
              <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
            </Button>
            {printMenuOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Cerrar menu"
                  className="fixed inset-0 z-20 cursor-default"
                  onClick={() => setPrintMenuOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void printList(false)}
                    className="block w-full px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <span className="block text-sm font-semibold text-slate-900">Solo disponibles</span>
                    <span className="block text-xs text-slate-500">Para mostrar o mandar a clientes</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void printList(true)}
                    className="block w-full border-t border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <span className="block text-sm font-semibold text-slate-900">Con vendidos tachados</span>
                    <span className="block text-xs text-slate-500">Como en la planilla, para uso interno</span>
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="sticky top-[73px] z-10 -mx-4 space-y-2.5 border-b border-slate-200/70 bg-[#f7f7f8]/95 px-4 pb-3 pt-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9 pr-9"
              value={term}
              placeholder="Buscar modelo, color, marca..."
              onChange={(event) => setTerm(event.target.value)}
            />
            {term ? (
              <button
                type="button"
                aria-label="Borrar busqueda"
                onClick={() => setTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <Button className="shrink-0 px-3.5" onClick={() => setCreating(true)} aria-label="Agregar vehiculo">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Agregar</span>
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-200/70 p-1">
          <StatusTab active={statusFilter === "disponibles"} onClick={() => setStatusFilter("disponibles")}>
            Disponibles <span className="opacity-60">{availableCount}</span>
          </StatusTab>
          <StatusTab active={statusFilter === "vendidos"} onClick={() => setStatusFilter("vendidos")}>
            Vendidos <span className="opacity-60">{soldCount}</span>
          </StatusTab>
          <StatusTab active={statusFilter === "todos"} onClick={() => setStatusFilter("todos")}>
            Todos <span className="opacity-60">{items.length}</span>
          </StatusTab>
        </div>

        <div className="flex gap-2">
          <Select
            className="min-w-0 flex-1"
            value={brandFilter}
            aria-label="Filtrar por marca"
            onChange={(event) => setBrandFilter(event.target.value)}
          >
            <option value="">Todas las marcas</option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </Select>
          {highlightedCount || onlyHighlighted ? (
            <button
              type="button"
              onClick={() => setOnlyHighlighted((current) => !current)}
              className={cn(
                "shrink-0 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition",
                onlyHighlighted
                  ? "border-yellow-500 bg-yellow-300 text-yellow-950"
                  : "border-yellow-300 bg-yellow-50 text-yellow-900 hover:bg-yellow-100",
              )}
            >
              Amarillos ({highlightedCount})
            </button>
          ) : null}
        </div>
      </div>

      {conflicts.length ? (
        <SheetConflictPanel
          conflicts={conflicts}
          onKeepWeb={handleKeepWeb}
          onKeepSheet={handleKeepSheet}
        />
      ) : null}

      {orphans.length ? (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-2">
              <p className="font-semibold">
                {orphans.length} {orphans.length === 1 ? "registro viejo" : "registros viejos"} en la app
              </p>
              <p className="text-amber-900">
                Su fila en la planilla quedo vacia. Los escondi de la lista y de la impresion, pero siguen guardados hasta que los saques.
              </p>
              {oldCopies.length ? (
                <div>
                  <p className="font-medium">
                    {oldCopies.length} {oldCopies.length === 1 ? "es una copia" : "son copias"} de autos que siguen en la planilla
                  </p>
                  <p className="text-xs text-amber-800">
                    El auto sigue en la lista con sus datos al dia; solo se saca la copia vieja. {describeItems(oldCopies)}
                  </p>
                </div>
              ) : null}
              {goneItems.length ? (
                <div>
                  <p className="font-medium">
                    {goneItems.length} {goneItems.length === 1 ? "auto ya no esta" : "autos ya no estan"} en la planilla
                  </p>
                  <p className="text-xs text-amber-800">
                    Se vendieron o se borraron alla. {describeItems(goneItems)}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {oldCopies.length ? (
              <Button
                variant={confirmOrphans === "copies" ? "destructive" : "default"}
                onClick={() => void removeOrphans("copies")}
              >
                {confirmOrphans === "copies" ? `Confirmar: sacar ${oldCopies.length} copias` : `Sacar solo las copias (${oldCopies.length})`}
              </Button>
            ) : null}
            {goneItems.length ? (
              <Button
                variant={confirmOrphans === "all" ? "destructive" : "outline"}
                onClick={() => void removeOrphans("all")}
              >
                {confirmOrphans === "all" ? `Confirmar: sacar ${orphans.length}` : `Sacar todos (${orphans.length})`}
              </Button>
            ) : null}
            {confirmOrphans ? (
              <Button variant="ghost" onClick={() => setConfirmOrphans(null)}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

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
      ) : null}

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
        <section key={brand} className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{brand}</h3>
            <span className="text-xs text-slate-400">{brandItems.length}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {brandItems.map((item) => (
              <PriceListItemCard
                key={`${item.id}-${item.updatedAt}`}
                item={item}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId((current) => (current === item.id ? null : item.id))}
                onSave={(input) => handleSave(item.id, input)}
                onDelete={() => handleDelete(item.id)}
                highlighted={Boolean(item.sheetRow && highlightedRows.has(item.sheetRow))}
                onHighlight={sheetConnected && item.sheetRow ? (on) => handleHighlight(item, on) : undefined}
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

function StatusTab({ active, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg px-2 py-2 text-xs font-semibold transition",
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
      )}
    >
      {children}
    </button>
  );
}
