import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { VehicleDetail, VehicleHeader } from "@/components/vehicles/VehicleDetail";
import { FileUploader } from "@/components/vehicles/FileUploader";
import { VehicleFiles } from "@/components/vehicles/VehicleFiles";
import { VehicleMissingSaleData } from "@/components/vehicles/MissingSaleDataAlert";
import { VehicleSalePanel } from "@/components/vehicles/VehicleSalePanel";
import { VehicleTimeline } from "@/components/vehicles/VehicleTimeline";
import { Button } from "@/components/ui/button";
import { listCommercialAlerts } from "@/services/commercialAlertsService";
import { uploadVehicleFile } from "@/services/filesService";
import { attachFilesToVehicle, deleteVehicleFile, getVehicleById } from "@/services/vehiclesService";
import { isPostSaleAlertType } from "@/types/commercialAlerts";
import type { Vehicle, VehicleFile } from "@/types/vehicles";

function BackToList() {
  return (
    <Link
      to="/autos"
      className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
    >
      <ArrowLeft className="h-4 w-4" />
      Historial de Autos
    </Link>
  );
}

export function VehicleDetailPage() {
  const { id = "" } = useParams();
  /** undefined = todavia cargando; null = el auto no existe. */
  const [vehicle, setVehicle] = useState<Vehicle | null | undefined>(undefined);
  const [hasPostSaleAlert, setHasPostSaleAlert] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const filesRef = useRef<HTMLDivElement>(null);

  const refreshVehicle = useCallback(() => {
    Promise.all([getVehicleById(id), listCommercialAlerts()]).then(([nextVehicle, alerts]) => {
      setVehicle(nextVehicle);
      setHasPostSaleAlert(
        alerts.some((alert) => alert.vehicleId === id && isPostSaleAlertType(alert.alertType)),
      );
    });
  }, [id]);

  useEffect(() => {
    refreshVehicle();
  }, [refreshVehicle]);

  if (vehicle === undefined) {
    return (
      <div className="space-y-6">
        <BackToList />
        <div className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white/70" />
        <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white/70" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="space-y-6">
        <BackToList />
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          No encontramos el auto solicitado.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackToList />
      <VehicleHeader
        vehicle={vehicle}
        onAddPhotos={() => {
          setShowUploader(true);
          filesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <div className="space-y-6">
          <VehicleMissingSaleData vehicle={vehicle} />
          <VehicleDetail vehicle={vehicle} />
          <VehicleSalePanel vehicle={vehicle} hasPostSaleAlert={hasPostSaleAlert} />
          <div ref={filesRef} className="scroll-mt-24">
          <VehicleFiles
            files={vehicle.files}
            headerAction={
              <Button variant="outline" className="shrink-0" onClick={() => setShowUploader((open) => !open)}>
                <Plus className="mr-2 h-4 w-4" />
                Adjuntar
              </Button>
            }
            onDelete={async (file: VehicleFile) => {
              const confirmed = window.confirm(`¿Querés borrar el archivo "${file.fileName}"?`);
              if (!confirmed) return;
              await deleteVehicleFile(vehicle.id, file.id);
              refreshVehicle();
            }}
          >
            {showUploader ? (
              <FileUploader
                onAdd={async (pending) => {
                  const uploadedFiles = await Promise.all(
                    pending.files.map((file) =>
                      uploadVehicleFile({
                        vehicleId: vehicle.id,
                        file,
                        fileName: file.name,
                        fileType: file.type || "application/octet-stream",
                        category: pending.category,
                        notes: pending.notes,
                      }),
                    ),
                  );
                  await attachFilesToVehicle(vehicle.id, uploadedFiles);
                  setShowUploader(false);
                  refreshVehicle();
                }}
              />
            ) : null}
          </VehicleFiles>
          </div>
        </div>
        <VehicleTimeline vehicle={vehicle} />
      </div>
    </div>
  );
}
