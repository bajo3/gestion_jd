import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { VehicleForm } from "@/components/vehicles/VehicleForm";
import { attachFilesToVehicle, createVehicle } from "@/services/vehiclesService";
import { uploadVehicleFile } from "@/services/filesService";

export function VehicleNewPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Historial de Autos"
        title="Nuevo auto"
        description="Carga un nuevo registro en el historial de la agencia."
      />

      <VehicleForm
        submitLabel="Guardar auto"
        onSubmit={async ({ values, pendingFiles }) => {
          const created = await createVehicle(values);
          const uploadedFiles = await Promise.all(
            pendingFiles.map((pending) =>
              uploadVehicleFile({
                vehicleId: created.id,
                file: pending.file,
                fileName: pending.fileName,
                fileType: pending.fileType,
                category: pending.category,
                notes: pending.notes,
              }),
            ),
          );
          await attachFilesToVehicle(created.id, uploadedFiles);
          navigate(`/autos/${created.id}`);
        }}
      />
    </div>
  );
}
