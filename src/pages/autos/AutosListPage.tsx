import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { VehicleList } from "@/components/vehicles/VehicleList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { VEHICLE_STATUS_LABELS } from "@/lib/vehicleLabels";
import { getVehiclePhotos } from "@/lib/vehicleStock";
import { listVehicles } from "@/services/vehiclesService";
import { VEHICLE_STATUSES, type Vehicle, type VehicleStatus } from "@/types/vehicles";

type StatusFilter = VehicleStatus | "todos";

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition",
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900",
      )}
    >
      {label}
      <span className={cn("text-xs tabular-nums", active ? "text-slate-300" : "text-slate-400")}>{count}</span>
    </button>
  );
}

export function AutosListPage() {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");

  useEffect(() => {
    listVehicles().then(setVehicles);
  }, []);

  const counts = useMemo(() => {
    const result: Partial<Record<VehicleStatus, number>> = {};
    for (const vehicle of vehicles ?? []) {
      result[vehicle.status] = (result[vehicle.status] ?? 0) + 1;
    }
    return result;
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (vehicles ?? []).filter((vehicle) => {
      const matchesStatus = status === "todos" || vehicle.status === status;
      const haystack = [
        vehicle.brand,
        vehicle.model,
        vehicle.licensePlate,
        vehicle.vin,
        vehicle.engine,
        vehicle.buyerName,
        vehicle.observations,
      ]
        .join(" ")
        .toLowerCase();

      return matchesStatus && haystack.includes(query);
    });
  }, [search, status, vehicles]);

  const showCovers = useMemo(() => (vehicles ?? []).some((vehicle) => getVehiclePhotos(vehicle).length > 0), [vehicles]);
  const total = vehicles?.length ?? 0;
  const filtered = Boolean(search.trim()) || status !== "todos";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Historial de Autos"
        title="Stock e historial de la agencia"
        description="Buscá un auto y entrá a su ficha para ver datos, adjuntos y todo lo que pasó con la unidad."
        actions={
          <Link to="/autos/nuevo">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo auto
            </Button>
          </Link>
        }
      />

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-10"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por marca, modelo, patente, comprador u observaciones"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip label="Todos" count={total} active={status === "todos"} onClick={() => setStatus("todos")} />
          {VEHICLE_STATUSES.filter((item) => counts[item]).map((item) => (
            <FilterChip
              key={item}
              label={VEHICLE_STATUS_LABELS[item]}
              count={counts[item] ?? 0}
              active={status === item}
              onClick={() => setStatus(item)}
            />
          ))}
          {vehicles && filtered ? (
            <span className="ml-auto text-sm text-slate-500">
              {filteredVehicles.length} de {total} autos
            </span>
          ) : null}
        </div>
      </div>

      {vehicles ? (
        <VehicleList
          vehicles={filteredVehicles}
          filtered={filtered}
          showCovers={showCovers}
          onClearFilters={() => {
            setSearch("");
            setStatus("todos");
          }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white/70" />
          ))}
        </div>
      )}
    </div>
  );
}
