import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PencilLine } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { VehicleDetail } from "@/components/vehicles/VehicleDetail";
import { FileUploader } from "@/components/vehicles/FileUploader";
import { VehicleFiles } from "@/components/vehicles/VehicleFiles";
import { VehicleSalePanel } from "@/components/vehicles/VehicleSalePanel";
import { VehicleTimeline } from "@/components/vehicles/VehicleTimeline";
import { Button } from "@/components/ui/button";
import { listCommercialAlerts } from "@/services/commercialAlertsService";
import { uploadVehicleFile } from "@/services/filesService";
import { attachFilesToVehicle, deleteVehicleFile, getVehicleById } from "@/services/vehiclesService";
import type { Vehicle, VehicleFile } from "@/types/vehicles";

export function VehicleDetailPage() {
  const { id = "" } = useParams();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [hasPostSaleAlert, setHasPostSaleAlert] = useState(false);

  const refreshVehicle = useCallback(() => {
    Promise.all([getVehicleById(id), listCommercialAlerts()]).then(([nextVehicle, alerts]) => {
      setVehicle(nextVehicle);
      setHasPostSaleAlert(
        alerts.some((alert) => alert.vehicleId === id && alert.alertType === "post_sale_12_months"),
      );
    });
  }, [id]);

  useEffect(() => {
    refreshVehicle();
  }, [refreshVehicle]);

  if (!vehicle) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">No encontramos el auto solicitado.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Historial de Autos"
        title={`${vehicle.brand} ${vehicle.model}`}
        description="Vista completa del historial, documentacion y estado comercial."
        actions={
          <Link to={`/autos/${vehicle.id}/editar`}>
            <Button>
              <PencilLine className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <VehicleDetail vehicle={vehicle} />
          <VehicleSalePanel vehicle={vehicle} hasPostSaleAlert={hasPostSaleAlert} />
          <FileUploader
            onAdd={async (pending) => {
              const uploadedFile = await uploadVehicleFile({
                vehicleId: vehicle.id,
                file: pending.file,
                fileName: pending.file.name,
                fileType: pending.file.type || "application/octet-stream",
                category: pending.category,
                notes: pending.notes,
              });
              await attachFilesToVehicle(vehicle.id, [uploadedFile]);
              refreshVehicle();
            }}
          />
          <VehicleFiles
            files={vehicle.files}
            onDelete={async (file: VehicleFile) => {
              const confirmed = window.confirm(`¿Querés borrar el archivo "${file.fileName}"?`);
              if (!confirmed) return;
              await deleteVehicleFile(vehicle.id, file.id);
              refreshVehicle();
            }}
          />
        </div>
        <VehicleTimeline vehicle={vehicle} />
      </div>
    </div>
  );
}
