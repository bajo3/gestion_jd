import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { VehicleForm } from "@/components/vehicles/VehicleForm";
import { attachFilesToVehicle, getVehicleById, updateVehicle } from "@/services/vehiclesService";
import { uploadVehicleFile } from "@/services/filesService";
import type { Vehicle } from "@/types/vehicles";

export function VehicleEditPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    getVehicleById(id).then(setVehicle);
  }, [id]);

  if (!vehicle) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Cargando vehiculo...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Historial de Autos"
        title={`Editar ${vehicle.brand} ${vehicle.model}`}
        description="Actualiza datos internos, estado y documentacion asociada."
      />

      <VehicleForm
        initialValues={{
          brand: vehicle.brand,
          model: vehicle.model,
          licensePlate: vehicle.licensePlate,
          year: vehicle.year,
          vin: vehicle.vin,
          engine: vehicle.engine,
          color: vehicle.color,
          kilometers: vehicle.kilometers,
          entryDate: vehicle.entryDate,
          exitDate: vehicle.exitDate,
          status: vehicle.status,
          observations: vehicle.observations,
          purchasePrice: vehicle.purchasePrice,
          salePrice: vehicle.salePrice,
          buyerName: vehicle.buyerName,
          buyerPhone: vehicle.buyerPhone,
          hasCredit: vehicle.hasCredit,
          creditStartDate: vehicle.creditStartDate,
          creditTotalInstallments: vehicle.creditTotalInstallments,
          creditDueDay: vehicle.creditDueDay,
        }}
        initialFiles={vehicle.files}
        submitLabel="Guardar cambios"
        onSubmit={async ({ values, pendingFiles }) => {
          await updateVehicle(id, values);
          const uploadedFiles = await Promise.all(
            pendingFiles.map((pending) =>
              uploadVehicleFile({
                vehicleId: id,
                file: pending.file,
                fileName: pending.fileName,
                fileType: pending.fileType,
                category: pending.category,
                notes: pending.notes,
              }),
            ),
          );
          if (uploadedFiles.length) {
            await attachFilesToVehicle(id, uploadedFiles);
          }
          navigate(`/autos/${id}`);
        }}
      />
    </div>
  );
}
