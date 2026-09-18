import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMissingSaleData, listVehiclesWithMissingSaleData } from "@/lib/saleMissingData";
import type { Vehicle } from "@/types/vehicles";

function vehicleName(vehicle: Vehicle) {
  return [vehicle.brand, vehicle.model, vehicle.licensePlate && `· ${vehicle.licensePlate}`].filter(Boolean).join(" ") || "Auto";
}

/** Aviso en rojo dentro de la ficha de un auto vendido con datos incompletos. */
export function VehicleMissingSaleData({ vehicle }: { vehicle: Vehicle }) {
  const missing = getMissingSaleData(vehicle);
  if (!missing.length) return null;

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-semibold">Faltan datos de la venta</p>
            <ul className="mt-1 space-y-0.5">
              {missing.map((field) => (
                <li key={field.label}>
                  {field.label}
                  {field.impact ? <span className="text-red-700"> ({field.impact})</span> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Link to={`/autos/${vehicle.id}/editar`}>
          <Button variant="outline" className="border-red-300 bg-white text-red-700 hover:bg-red-100">
            Completar datos
          </Button>
        </Link>
      </div>
    </div>
  );
}

/** Lista en rojo de todas las ventas con datos faltantes (dashboard de Ventas). */
export function MissingSaleDataList({ vehicles }: { vehicles: Vehicle[] }) {
  const items = listVehiclesWithMissingSaleData(vehicles);
  if (!items.length) return null;

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-red-800">
        <AlertTriangle className="h-5 w-5 text-red-600" />
        <h2 className="text-lg font-semibold">
          {items.length === 1 ? "1 venta con datos faltantes" : `${items.length} ventas con datos faltantes`}
        </h2>
      </div>
      <p className="mt-1 text-sm text-red-700">Completalos para que la venta entre a postventa y a los seguimientos de credito.</p>
      <div className="mt-4 space-y-2">
        {items.map(({ vehicle, missing }) => (
          <Link
            key={vehicle.id}
            to={`/autos/${vehicle.id}/editar`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm transition hover:border-red-300 hover:bg-red-50"
          >
            <span className="font-semibold text-slate-900">
              {vehicleName(vehicle)}
              {vehicle.buyerName ? <span className="font-normal text-slate-500"> · {vehicle.buyerName}</span> : null}
            </span>
            <span className="text-red-700">Falta: {missing.map((field) => field.label.toLowerCase()).join(", ")}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
