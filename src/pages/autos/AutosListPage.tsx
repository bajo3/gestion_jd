import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { VehicleList } from "@/components/vehicles/VehicleList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { listVehicles } from "@/services/vehiclesService";
import { VEHICLE_STATUSES, type Vehicle } from "@/types/vehicles";

export function AutosListPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");

  useEffect(() => {
    listVehicles().then(setVehicles);
  }, []);

  const filteredVehicles = useMemo(() => {
    const query = search.toLowerCase();
    return vehicles.filter((vehicle) => {
      const matchesStatus = status === "todos" || vehicle.status === status;
      const haystack = [
        vehicle.brand,
        vehicle.model,
        vehicle.licensePlate,
        vehicle.vin,
        vehicle.engine,
        vehicle.observations,
      ]
        .join(" ")
        .toLowerCase();

      return matchesStatus && haystack.includes(query);
    });
  }, [search, status, vehicles]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Historial de Autos"
        title="Stock e historial de la agencia"
        description="Carga, busca, edita y revisa autos con adjuntos y seguimiento interno."
        actions={
          <Link to="/autos/nuevo">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo auto
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-10"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por marca, modelo, patente, VIN u observaciones"
          />
        </div>
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="todos">Todos los estados</option>
          {VEHICLE_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </div>

      <VehicleList vehicles={filteredVehicles} />
    </div>
  );
}
