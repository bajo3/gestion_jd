import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/vehicles/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Vehicle } from "@/types/vehicles";

export function VehicleDetail({ vehicle }: { vehicle: Vehicle }) {
  const items = [
    ["Marca", vehicle.brand],
    ["Modelo", vehicle.model],
    ["Patente", vehicle.licensePlate],
    ["Año", vehicle.year?.toString() || "Sin dato"],
    ["VIN / Chasis", vehicle.vin || "Sin dato"],
    ["Motor", vehicle.engine || "Sin dato"],
    ["Color", vehicle.color || "Sin dato"],
    ["Kilometros", vehicle.kilometers?.toLocaleString("es-AR") || "Sin dato"],
    ["Ingreso", formatDate(vehicle.entryDate)],
    ["Egreso", formatDate(vehicle.exitDate)],
    ["Compra", vehicle.purchasePrice ? formatCurrency(vehicle.purchasePrice) : "Sin dato"],
    ["Venta", vehicle.salePrice ? formatCurrency(vehicle.salePrice) : "Sin dato"],
  ];

  return (
    <Card>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              Historial interno
            </p>
            <h2 className="text-2xl font-bold text-slate-950">
              {vehicle.brand} {vehicle.model}
            </h2>
            <p className="text-sm text-slate-500">{vehicle.licensePlate || "Patente sin cargar"}</p>
          </div>
          <StatusBadge status={vehicle.status} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {items.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Cliente / comprador</p>
          <div className="mt-2 grid gap-4 rounded-2xl bg-slate-50 p-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Comprador</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{vehicle.buyerName || "Sin dato"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Telefono</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{vehicle.buyerPhone || "Sin dato"}</p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Observaciones</p>
          <p className="mt-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
            {vehicle.observations || "Sin observaciones."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
