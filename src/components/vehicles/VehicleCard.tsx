import { Link } from "react-router-dom";
import { AlertTriangle, CalendarDays, CarFront, ChevronRight, Paperclip, UserRound } from "lucide-react";
import { PlateChip } from "@/components/vehicles/PlateChip";
import { StatusBadge } from "@/components/vehicles/StatusBadge";
import { StockAgeBadge } from "@/components/vehicles/StockAgeBadge";
import { getMissingSaleData } from "@/lib/saleMissingData";
import { formatCurrency, formatDate } from "@/lib/utils";
import { vehicleTitle } from "@/lib/vehicleLabels";
import { getStockAge, getVehiclePhotos } from "@/lib/vehicleStock";
import type { Vehicle } from "@/types/vehicles";

type VehicleCardProps = {
  vehicle: Vehicle;
  /** Reserva el espacio de la foto aunque el auto no tenga, para que la grilla quede pareja. */
  showCover?: boolean;
};

export function VehicleCard({ vehicle, showCover = false }: VehicleCardProps) {
  const meta = [
    vehicle.year?.toString(),
    vehicle.kilometers != null ? `${vehicle.kilometers.toLocaleString("es-AR")} km` : "",
    vehicle.color,
  ].filter(Boolean);

  const dates = [
    vehicle.entryDate ? `Ingreso ${formatDate(vehicle.entryDate)}` : "",
    vehicle.exitDate ? `Egreso ${formatDate(vehicle.exitDate)}` : "",
  ].filter(Boolean);

  const price = vehicle.salePrice
    ? { label: "Venta", value: vehicle.salePrice }
    : vehicle.purchasePrice
      ? { label: "Compra", value: vehicle.purchasePrice }
      : null;

  const hasMissingSaleData = getMissingSaleData(vehicle).length > 0;
  const cover = getVehiclePhotos(vehicle)[0];
  const stockAge = getStockAge(vehicle);

  return (
    <Link
      to={`/autos/${vehicle.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
    >
      {cover ? (
        <img
          src={cover.fileUrl}
          alt={vehicleTitle(vehicle)}
          loading="lazy"
          className="aspect-[16/10] w-full border-b border-slate-100 bg-slate-100 object-cover"
        />
      ) : showCover ? (
        <div className="flex aspect-[16/10] w-full items-center justify-center border-b border-slate-100 bg-slate-50 text-slate-300">
          <CarFront className="h-8 w-8" />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 text-[15px] font-semibold leading-snug text-slate-950">{vehicleTitle(vehicle)}</h3>
          <StatusBadge status={vehicle.status} />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
          <PlateChip plate={vehicle.licensePlate} />
          {meta.map((item) => (
            <span key={item} className="before:mr-2 before:text-slate-300 before:content-['·']">
              {item}
            </span>
          ))}
        </div>

        <div className="mt-4 space-y-1.5 text-sm text-slate-600">
          {dates.length ? (
            <p className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
              {dates.join(" · ")}
            </p>
          ) : null}
          {vehicle.buyerName ? (
            <p className="flex items-center gap-2">
              <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate">{vehicle.buyerName}</span>
            </p>
          ) : null}
          {hasMissingSaleData ? (
            <p className="flex items-center gap-2 font-medium text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Faltan datos de la venta
            </p>
          ) : null}
          {stockAge && stockAge.level !== "ok" ? <StockAgeBadge age={stockAge} /> : null}
        </div>

        <div className="mt-auto pt-4">
          <div className="flex items-end justify-between gap-4 border-t border-slate-100 pt-3">
            <div className="min-w-0">
              {price ? (
                <>
                  <p className="text-xs text-slate-500">{price.label}</p>
                  <p className="text-base font-semibold tabular-nums text-slate-950">{formatCurrency(price.value)}</p>
                </>
              ) : (
                <p className="text-sm text-slate-400">Sin precio cargado</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3 pb-0.5 text-sm text-slate-500">
              {vehicle.files.length ? (
                <span className="flex items-center gap-1" title={`${vehicle.files.length} adjuntos`}>
                  <Paperclip className="h-4 w-4" />
                  {vehicle.files.length}
                </span>
              ) : null}
              <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-600" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
