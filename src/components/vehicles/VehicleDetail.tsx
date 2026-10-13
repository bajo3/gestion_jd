import { useState } from "react";
import { Link } from "react-router-dom";
import { Camera, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlateChip } from "@/components/vehicles/PlateChip";
import { StatusBadge } from "@/components/vehicles/StatusBadge";
import { StockAgeBadge } from "@/components/vehicles/StockAgeBadge";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { vehicleTitle } from "@/lib/vehicleLabels";
import { getStockAge, getVehiclePhotos } from "@/lib/vehicleStock";
import type { Vehicle } from "@/types/vehicles";

/** Foto principal del auto con miniaturas para pasar a las demas. */
function VehiclePhotos({ vehicle }: { vehicle: Vehicle }) {
  const photos = getVehiclePhotos(vehicle);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = photos.find((photo) => photo.id === selectedId) ?? photos[0];

  if (!selected) return null;

  return (
    <div className="w-full shrink-0 space-y-2 md:w-64">
      <a href={selected.fileUrl} target="_blank" rel="noreferrer" title="Abrir la foto en tamaño completo">
        <img
          src={selected.fileUrl}
          alt={vehicleTitle(vehicle)}
          className="aspect-[4/3] w-full rounded-xl border border-slate-200 bg-slate-100 object-cover"
        />
      </a>
      {photos.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelectedId(photo.id)}
              aria-label={`Ver ${photo.fileName}`}
              className={cn(
                "h-12 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition",
                photo.id === selected.id ? "border-slate-900" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <img src={photo.fileUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type VehicleHeaderProps = {
  vehicle: Vehicle;
  /** Abre el formulario de adjuntos para subir fotos. Si no viene, no se muestra el boton. */
  onAddPhotos?: () => void;
};

/** Encabezado de la ficha: que auto es, en que estado esta y los numeros que mas se consultan. */
export function VehicleHeader({ vehicle, onAddPhotos }: VehicleHeaderProps) {
  const stockAge = getStockAge(vehicle);
  const stats = [
    ["Kilómetros", vehicle.kilometers != null ? `${vehicle.kilometers.toLocaleString("es-AR")} km` : ""],
    ["Ingreso", vehicle.entryDate ? formatDate(vehicle.entryDate) : ""],
    ["Egreso", vehicle.exitDate ? formatDate(vehicle.exitDate) : ""],
    ["Compra", vehicle.purchasePrice ? formatCurrency(vehicle.purchasePrice) : ""],
    ["Venta", vehicle.salePrice ? formatCurrency(vehicle.salePrice) : ""],
  ];

  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <VehiclePhotos vehicle={vehicle} />
          <div className="flex min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">{vehicleTitle(vehicle)}</h1>
              <div className="flex flex-wrap items-center gap-2.5 text-sm text-slate-500">
                <PlateChip plate={vehicle.licensePlate} />
                {vehicle.year ? <span>{vehicle.year}</span> : null}
                <StatusBadge status={vehicle.status} />
                {stockAge ? <StockAgeBadge age={stockAge} /> : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {onAddPhotos ? (
                <Button variant="outline" onClick={onAddPhotos}>
                  <Camera className="mr-2 h-4 w-4" />
                  Agregar fotos
                </Button>
              ) : null}
              <Link to={`/autos/${vehicle.id}/editar`}>
                <Button>
                  <PencilLine className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-50 px-4 py-3">
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className={cn("mt-1 text-sm font-semibold tabular-nums", value ? "text-slate-900" : "text-slate-400")}>
                {value || "—"}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function FactGroup({ title, items }: { title: string; items: Array<[label: string, value: string]> }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</h4>
      <dl className="mt-2 grid gap-x-8 md:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2.5 text-sm">
            <dt className="shrink-0 text-slate-500">{label}</dt>
            <dd className={cn("min-w-0 break-words text-right font-medium", value ? "text-slate-900" : "text-slate-400")}>
              {value || "—"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function VehicleDetail({ vehicle }: { vehicle: Vehicle }) {
  const hasBuyer = Boolean(vehicle.buyerName || vehicle.buyerPhone);

  return (
    <Card>
      <CardContent className="space-y-6">
        <h3 className="text-lg font-semibold text-slate-950">Ficha</h3>

        <FactGroup
          title="Datos del auto"
          items={[
            ["Marca", vehicle.brand],
            ["Modelo", vehicle.model],
            ["Patente", vehicle.licensePlate],
            ["Año", vehicle.year?.toString() ?? ""],
            ["Color", vehicle.color],
            ["Chasis / VIN", vehicle.vin],
            ["Motor", vehicle.engine],
          ]}
        />

        {hasBuyer ? (
          <FactGroup
            title="Comprador"
            items={[
              ["Nombre", vehicle.buyerName],
              ["Teléfono", vehicle.buyerPhone],
            ]}
          />
        ) : null}

        {vehicle.hasCredit ? (
          <FactGroup
            title="Financiación"
            items={[
              ["Inicio", vehicle.creditStartDate ? formatDate(vehicle.creditStartDate) : ""],
              ["Cuotas", vehicle.creditInstallmentsText || vehicle.creditTotalInstallments?.toString() || ""],
              ["Día de vencimiento", vehicle.creditDueDay?.toString() ?? ""],
            ]}
          />
        ) : null}

        {vehicle.observations ? (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Observaciones</h4>
            <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              {vehicle.observations}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
