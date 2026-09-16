import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CarFront, CheckCircle2, FileText, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/shared/FormField";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { useObjectState } from "@/hooks/useObjectState";
import { useDocumentWorkflow } from "@/hooks/useDocumentWorkflow";
import { FileUploader } from "@/components/vehicles/FileUploader";
import { VehicleFiles } from "@/components/vehicles/VehicleFiles";
import { StatusBadge } from "@/components/vehicles/StatusBadge";
import { attachFilesToVehicle, deleteVehicleFile, updateVehicle } from "@/services/vehiclesService";
import { uploadVehicleFile } from "@/services/filesService";
import { generateCompraVentaPdf } from "@/pdf/compraVentaPdf";
import type { CompraVentaFormValues } from "@/types/forms";
import type { Vehicle, VehicleFile } from "@/types/vehicles";
import { DocumentContextBar, DocumentPage, DocumentPersistenceStatus, FormGrid, FormSection } from "./documentUtils";

const initialState: CompraVentaFormValues = {
  fecha: "",
  recibido: "",
  numeroDoc: "",
  telefono: "",
  domicilio: "",
  cantidadNum: "",
  dominio: "",
  marca: "",
  modelo: "",
  tipo: "",
  nMotor: "",
  nChasis: "",
  observaciones: "",
};

export function CompraVentaPage() {
  const [values, form] = useObjectState(initialState);
  const workflow = useDocumentWorkflow("compra_venta");
  const [addedVehicleFiles, setAddedVehicleFiles] = useState<VehicleFile[]>([]);
  const [deletedVehicleFileIds, setDeletedVehicleFileIds] = useState<string[]>([]);
  const [vehicleNotice, setVehicleNotice] = useState<string | null>(null);
  const [vehicleSaving, setVehicleSaving] = useState(false);

  const vehicle = workflow.vehicle;
  const vehicleQuery = (() => {
    if (!vehicle) return "";
    const query = new URLSearchParams({ vehicleId: vehicle.id });
    if (workflow.client?.id) query.set("clientId", workflow.client.id);
    if (workflow.operation?.id) query.set("operationId", workflow.operation.id);
    return `?${query.toString()}`;
  })();
  const vehicleFiles = [
    ...addedVehicleFiles,
    ...(vehicle?.files ?? []).filter((file) => !deletedVehicleFileIds.includes(file.id) && !addedVehicleFiles.some((added) => added.id === file.id)),
  ];

  useEffect(() => {
    const data = workflow.operation?.data as Record<string, string> | undefined;
    if (workflow.client && !values.recibido) form.replace({ ...values, recibido: workflow.client.nombre, numeroDoc: workflow.client.dni, telefono: workflow.client.telefono || workflow.client.celular, domicilio: workflow.client.domicilio, fecha: data?.fechaOperacion ?? values.fecha, dominio: workflow.prefill.dominio || data?.dominio || "", marca: workflow.prefill.vehiculoMarca, modelo: workflow.prefill.vehiculoModelo });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.client, workflow.operation, workflow.prefill]);

  useEffect(() => {
    if (!vehicle) return;
    const nextValues: Partial<CompraVentaFormValues> = {};
    if (!values.dominio) nextValues.dominio = vehicle.licensePlate;
    if (!values.marca) nextValues.marca = vehicle.brand;
    if (!values.modelo) nextValues.modelo = vehicle.model;
    if (!values.nMotor) nextValues.nMotor = vehicle.engine;
    if (!values.nChasis) nextValues.nChasis = vehicle.vin;
    if (Object.keys(nextValues).length) form.replace({ ...values, ...nextValues });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle]);

  useEffect(() => {
    if (workflow.saved?.data) form.replace({ ...initialState, ...(workflow.saved.data as Partial<CompraVentaFormValues>) });
  }, [form, workflow.saved]);

  async function saveVehicleTechnicalData() {
    if (!vehicle) return;
    setVehicleSaving(true);
    setVehicleNotice(null);
    try {
      const input: Vehicle = {
        ...vehicle,
        brand: values.marca || vehicle.brand,
        model: values.modelo || vehicle.model,
        licensePlate: values.dominio || vehicle.licensePlate,
        engine: values.nMotor || vehicle.engine,
        vin: values.nChasis || vehicle.vin,
      };
      await updateVehicle(vehicle.id, input);
      setVehicleNotice("Ficha técnica actualizada. El auto todavía no fue marcado como vendido.");
    } catch (reason: unknown) {
      setVehicleNotice(reason instanceof Error ? reason.message : "No se pudo actualizar la ficha del auto.");
    } finally {
      setVehicleSaving(false);
    }
  }

  return (
    <DocumentPage title="Compra y Venta" description="Boleto de compra venta migrado desde la version original.">
      <DocumentContextBar client={workflow.client} operation={workflow.operation} />
      <DocumentPersistenceStatus loading={workflow.loading} mode={workflow.mode} error={workflow.error} />
      {vehicle ? (
        <Card>
          <CardContent className="space-y-5">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-blue-50 p-3 text-blue-700"><CarFront className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Auto asociado al boleto</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">{vehicle.brand} {vehicle.model}</h2>
                  <p className="text-sm text-slate-500">{vehicle.licensePlate || "Patente sin cargar"} · Los datos quedan vinculados a este historial.</p>
                </div>
              </div>
              <StatusBadge status={vehicle.status} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Año", vehicle.year?.toString() || "Sin dato"],
                ["Motor", vehicle.engine || "Sin dato"],
                ["Chasis / VIN", vehicle.vin || "Sin dato"],
                ["Kilómetros", vehicle.kilometers?.toLocaleString("es-AR") || "Sin dato"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Link to={`/autos/${vehicle.id}`}><Button variant="outline"><FileText className="mr-2 h-4 w-4" />Abrir historial</Button></Link>
              <Link to={`/autos/${vehicle.id}/editar`}><Button variant="outline"><PencilLine className="mr-2 h-4 w-4" />Editar auto</Button></Link>
              <Link to={`/operacion-finalizada${vehicleQuery}`}><Button><CheckCircle2 className="mr-2 h-4 w-4" />Finalizar venta</Button></Link>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-950">
              <p><strong>Guardar ficha técnica</strong> actualiza marca, modelo, patente, motor y chasis con lo que figura en este boleto.</p>
              <p className="mt-1 text-blue-800">No cambia el estado comercial ni registra la venta.</p>
              {vehicleNotice ? <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 font-medium" role="status">{vehicleNotice}</p> : null}
              <Button className="mt-3" variant="secondary" disabled={vehicleSaving} onClick={() => void saveVehicleTechnicalData()}>
                {vehicleSaving ? "Guardando ficha…" : "Guardar ficha técnica"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <FormSection title="Datos del comprador">
        <FormGrid>
          <FormField label="Fecha">
            <Input type="date" value={values.fecha} onChange={(event) => form.set("fecha", event.target.value)} />
          </FormField>
          <FormField label="Nombre y apellido">
            <Input value={values.recibido} onChange={(event) => form.set("recibido", event.target.value)} />
          </FormField>
          <FormField label="DNI">
            <Input value={values.numeroDoc} onChange={(event) => form.set("numeroDoc", event.target.value)} />
          </FormField>
          <FormField label="Telefono">
            <Input value={values.telefono} onChange={(event) => form.set("telefono", event.target.value)} />
          </FormField>
          <FormField label="Domicilio" className="xl:col-span-2">
            <Input value={values.domicilio} onChange={(event) => form.set("domicilio", event.target.value)} />
          </FormField>
          <FormField label="Son $" className="xl:col-span-1">
            <CurrencyInput value={values.cantidadNum} onChange={(value) => form.set("cantidadNum", value)} />
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection title="Datos del automotor">
        <FormGrid>
          <FormField label="Dominio">
            <Input value={values.dominio} onChange={(event) => form.set("dominio", event.target.value.toUpperCase())} />
          </FormField>
          <FormField label="Marca">
            <Input value={values.marca} onChange={(event) => form.set("marca", event.target.value)} />
          </FormField>
          <FormField label="Modelo">
            <Input value={values.modelo} onChange={(event) => form.set("modelo", event.target.value)} />
          </FormField>
          <FormField label="Tipo">
            <Input value={values.tipo} onChange={(event) => form.set("tipo", event.target.value)} />
          </FormField>
          <FormField label="N° Motor">
            <Input value={values.nMotor} onChange={(event) => form.set("nMotor", event.target.value)} />
          </FormField>
          <FormField label="N° Chasis">
            <Input value={values.nChasis} onChange={(event) => form.set("nChasis", event.target.value)} />
          </FormField>
        </FormGrid>
        <FormField label="Observaciones">
          <Textarea value={values.observaciones} onChange={(event) => form.set("observaciones", event.target.value)} />
        </FormField>
      </FormSection>

      {vehicle ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Documentos del auto</h2>
            <p className="mt-1 text-sm text-slate-500">Adjuntá cédula, título, 08, informe, boleto u otro archivo directamente al historial de {vehicle.brand} {vehicle.model}.</p>
          </div>
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
              setAddedVehicleFiles((current) => [uploadedFile, ...current]);
            }}
          />
          <VehicleFiles
            files={vehicleFiles}
            onDelete={async (file) => {
              const confirmed = window.confirm(`¿Querés borrar el archivo "${file.fileName}"?`);
              if (!confirmed) return;
              await deleteVehicleFile(vehicle.id, file.id);
              setAddedVehicleFiles((current) => current.filter((item) => item.id !== file.id));
              setDeletedVehicleFileIds((current) => current.includes(file.id) ? current : [...current, file.id]);
            }}
          />
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button onClick={async () => { await workflow.save(values as unknown as Record<string, unknown>, "generado"); await generateCompraVentaPdf(values); }}>Generar Resumen</Button>
      </div>
    </DocumentPage>
  );
}
