import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import type { Vehicle } from "@/types/vehicles";

type VehicleListProps = {
  vehicles: Vehicle[];
  /** Hay una busqueda o un filtro activo: la lista vacia no significa que no haya autos cargados. */
  filtered?: boolean;
  onClearFilters?: () => void;
  /** Algun auto del listado tiene foto: todas las cards reservan el espacio de la imagen. */
  showCovers?: boolean;
};

export function VehicleList({ vehicles, filtered = false, onClearFilters, showCovers = false }: VehicleListProps) {
  if (!vehicles.length && filtered) {
    return (
      <Card>
        <CardContent className="py-14 text-center">
          <p className="text-lg font-semibold text-slate-900">No hay autos que coincidan.</p>
          <p className="mt-2 text-sm text-slate-500">Probá con otra búsqueda o sacá el filtro de estado.</p>
          {onClearFilters ? (
            <Button variant="outline" className="mt-5" onClick={onClearFilters}>
              Ver todos los autos
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (!vehicles.length) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-lg font-semibold text-slate-900">Todavía no hay autos cargados.</p>
          <p className="mt-2 text-sm text-slate-500">
            Empezá creando el primer registro del historial de la agencia.
          </p>
          <Link
            to="/autos/nuevo"
            className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Cargar auto
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {vehicles.map((vehicle) => (
        <VehicleCard key={vehicle.id} vehicle={vehicle} showCover={showCovers} />
      ))}
    </div>
  );
}
