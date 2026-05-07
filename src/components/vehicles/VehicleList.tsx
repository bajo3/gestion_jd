import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/vehicles/StatusBadge";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Vehicle } from "@/types/vehicles";

export function VehicleList({ vehicles }: { vehicles: Vehicle[] }) {
  if (!vehicles.length) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-lg font-semibold text-slate-900">Todavia no hay autos cargados.</p>
          <p className="mt-2 text-sm text-slate-500">
            Empeza creando el primer registro del historial de la agencia.
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
    <div className="space-y-6">
      <div className="grid gap-4 xl:hidden">
        {vehicles.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} />
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                <th className="px-5 py-4">Auto</th>
                <th className="px-5 py-4">Estado</th>
                <th className="px-5 py-4">Ingreso</th>
                <th className="px-5 py-4">KM</th>
                <th className="px-5 py-4">Compra</th>
                <th className="px-5 py-4">Venta</th>
                <th className="px-5 py-4">Adjuntos</th>
                <th className="px-5 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id} className="text-sm text-slate-700">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-950">
                      {vehicle.brand} {vehicle.model}
                    </div>
                    <div className="text-slate-500">
                      {vehicle.licensePlate || "Sin patente"} {vehicle.year ? `• ${vehicle.year}` : ""}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={vehicle.status} />
                  </td>
                  <td className="px-5 py-4">{formatDate(vehicle.entryDate)}</td>
                  <td className="px-5 py-4">{vehicle.kilometers?.toLocaleString("es-AR") || "—"}</td>
                  <td className="px-5 py-4">
                    {vehicle.purchasePrice ? formatCurrency(vehicle.purchasePrice) : "—"}
                  </td>
                  <td className="px-5 py-4">{vehicle.salePrice ? formatCurrency(vehicle.salePrice) : "—"}</td>
                  <td className="px-5 py-4">{vehicle.files.length}</td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      to={`/autos/${vehicle.id}`}
                      className="rounded-lg border border-slate-300 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
