import { Link } from "react-router-dom";
import { CarFront, Gauge, Palette, Paperclip } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/vehicles/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Vehicle } from "@/types/vehicles";

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {vehicle.brand || "Sin marca"}
            </p>
            <h3 className="text-lg font-semibold text-slate-950">
              {vehicle.model || "Vehiculo sin modelo"}
            </h3>
            <p className="text-sm text-slate-500">
              {vehicle.licensePlate || "Patente sin cargar"} {vehicle.year ? `• ${vehicle.year}` : ""}
            </p>
          </div>
          <StatusBadge status={vehicle.status} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="mb-1 flex items-center gap-2 text-slate-500">
              <Gauge className="h-4 w-4" /> Kilometros
            </div>
            <p className="font-semibold text-slate-900">
              {vehicle.kilometers?.toLocaleString("es-AR") || "Sin dato"}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="mb-1 flex items-center gap-2 text-slate-500">
              <Palette className="h-4 w-4" /> Color
            </div>
            <p className="font-semibold text-slate-900">{vehicle.color || "Sin dato"}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="mb-1 flex items-center gap-2 text-slate-500">
              <CarFront className="h-4 w-4" /> Ingreso
            </div>
            <p className="font-semibold text-slate-900">{formatDate(vehicle.entryDate)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="mb-1 flex items-center gap-2 text-slate-500">
              <Paperclip className="h-4 w-4" /> Adjuntos
            </div>
            <p className="font-semibold text-slate-900">{vehicle.files.length}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Venta estimada</p>
            <p className="text-base font-semibold text-slate-950">
              {vehicle.salePrice ? formatCurrency(vehicle.salePrice) : "Sin precio"}
            </p>
          </div>
          <Link
            to={`/autos/${vehicle.id}`}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Ver detalle
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
