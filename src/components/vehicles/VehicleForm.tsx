import { useMemo, useState } from "react";
import { FormField } from "@/components/shared/FormField";
import { FormSection } from "@/components/shared/FormSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { VEHICLE_STATUSES, type VehicleFile, type VehicleInput } from "@/types/vehicles";

type PendingFile = {
  fileName: string;
  fileType: string;
  category: VehicleFile["category"];
  notes?: string;
  file?: File;
};

type VehicleFormProps = {
  initialValues?: VehicleInput;
  initialFiles?: VehicleFile[];
  submitLabel: string;
  onSubmit: (payload: { values: VehicleInput; pendingFiles: PendingFile[] }) => Promise<void>;
};

const defaultValues: VehicleInput = {
  brand: "",
  model: "",
  licensePlate: "",
  year: null,
  vin: "",
  engine: "",
  color: "",
  kilometers: null,
  entryDate: "",
  exitDate: "",
  status: "ingresado",
  observations: "",
  purchasePrice: null,
  salePrice: null,
  buyerName: "",
  buyerPhone: "",
  hasCredit: false,
  creditStartDate: "",
  creditTotalInstallments: null,
  creditDueDay: null,
};

export function VehicleForm({
  initialValues,
  submitLabel,
  onSubmit,
}: VehicleFormProps) {
  const [values, setValues] = useState<VehicleInput>(initialValues ?? defaultValues);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileCategory, setFileCategory] = useState<VehicleFile["category"]>("foto");
  const [fileNotes, setFileNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fields = useMemo(
    () => ({
      set<K extends keyof VehicleInput>(key: K, value: VehicleInput[K]) {
        setValues((current) => ({ ...current, [key]: value }));
      },
    }),
    [],
  );

  return (
    <form
      className="space-y-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setSubmitting(true);
        try {
          await onSubmit({ values, pendingFiles });
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <FormSection title="Datos principales" description="Informacion operativa del auto.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField label="Marca">
            <Input value={values.brand} onChange={(event) => fields.set("brand", event.target.value)} />
          </FormField>
          <FormField label="Modelo">
            <Input value={values.model} onChange={(event) => fields.set("model", event.target.value)} />
          </FormField>
          <FormField label="Patente">
            <Input value={values.licensePlate} onChange={(event) => fields.set("licensePlate", event.target.value.toUpperCase())} />
          </FormField>
          <FormField label="Año">
            <Input
              type="number"
              value={values.year ?? ""}
              onChange={(event) => fields.set("year", event.target.value ? Number(event.target.value) : null)}
            />
          </FormField>
          <FormField label="Estado">
            <Select value={values.status} onChange={(event) => fields.set("status", event.target.value as VehicleInput["status"])}>
              {VEHICLE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Color">
            <Input value={values.color} onChange={(event) => fields.set("color", event.target.value)} />
          </FormField>
          <FormField label="Kilometros">
            <Input
              type="number"
              value={values.kilometers ?? ""}
              onChange={(event) => fields.set("kilometers", event.target.value ? Number(event.target.value) : null)}
            />
          </FormField>
          <FormField label="VIN / Chasis">
            <Input value={values.vin} onChange={(event) => fields.set("vin", event.target.value)} />
          </FormField>
          <FormField label="Motor">
            <Input value={values.engine} onChange={(event) => fields.set("engine", event.target.value)} />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Fechas y valores" description="Seguimiento comercial del vehiculo.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField label="Fecha de ingreso">
            <Input type="date" value={values.entryDate} onChange={(event) => fields.set("entryDate", event.target.value)} />
          </FormField>
          <FormField label="Fecha de egreso">
            <Input type="date" value={values.exitDate} onChange={(event) => fields.set("exitDate", event.target.value)} />
          </FormField>
          <FormField label="Precio de compra">
            <Input
              type="number"
              value={values.purchasePrice ?? ""}
              onChange={(event) => fields.set("purchasePrice", event.target.value ? Number(event.target.value) : null)}
            />
          </FormField>
          <FormField label="Precio de venta">
            <Input
              type="number"
              value={values.salePrice ?? ""}
              onChange={(event) => fields.set("salePrice", event.target.value ? Number(event.target.value) : null)}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Datos de venta" description="Cliente comprador, si ya esta definido.">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Comprador / cliente final">
            <Input value={values.buyerName} onChange={(event) => fields.set("buyerName", event.target.value)} />
          </FormField>
          <FormField label="Telefono del cliente">
            <Input value={values.buyerPhone} onChange={(event) => fields.set("buyerPhone", event.target.value)} />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Financiacion / Credito" description="Seguimiento simple para alertas comerciales.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <Checkbox checked={values.hasCredit} onChange={(event) => fields.set("hasCredit", event.target.checked)} />
            Tiene credito
          </label>
          <FormField label="Fecha de inicio">
            <Input type="date" value={values.creditStartDate} onChange={(event) => fields.set("creditStartDate", event.target.value)} />
          </FormField>
          <FormField label="Cantidad de cuotas">
            <Input
              type="number"
              value={values.creditTotalInstallments ?? ""}
              onChange={(event) => fields.set("creditTotalInstallments", event.target.value ? Number(event.target.value) : null)}
            />
          </FormField>
          <FormField label="Dia de vencimiento">
            <Input
              type="number"
              min={1}
              max={31}
              value={values.creditDueDay ?? ""}
              onChange={(event) => fields.set("creditDueDay", event.target.value ? Number(event.target.value) : null)}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Observaciones">
        <FormField label="Notas internas">
          <Textarea value={values.observations} onChange={(event) => fields.set("observations", event.target.value)} />
        </FormField>
      </FormSection>

      <FormSection title="Adjuntos preparados" description="Se guardan como metadata local hasta conectar storage real.">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_1fr_auto]">
          <FormField label="Archivo">
            <Input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </FormField>
          <FormField label="Categoria">
            <Select value={fileCategory} onChange={(event) => setFileCategory(event.target.value as VehicleFile["category"])}>
              <option value="foto">Foto</option>
              <option value="cedula">Cedula</option>
              <option value="titulo">Titulo</option>
              <option value="dni">DNI</option>
              <option value="08">08</option>
              <option value="informe_de_dominio">Informe de dominio</option>
              <option value="verificacion_policial">Verificacion policial</option>
              <option value="boleto">Boleto</option>
              <option value="recibo">Recibo</option>
              <option value="pdf_generado">PDF generado</option>
              <option value="otro">Otro</option>
            </Select>
          </FormField>
          <FormField label="Notas">
            <Input value={fileNotes} onChange={(event) => setFileNotes(event.target.value)} />
          </FormField>
          <div className="flex items-end">
            <Button
              className="w-full"
              onClick={() => {
                if (!file) return;
                setPendingFiles((current) => [
                  ...current,
                  {
                    file,
                    fileName: file.name,
                    fileType: file.type || "application/octet-stream",
                    category: fileCategory,
                    notes: fileNotes,
                  },
                ]);
                setFile(null);
                setFileNotes("");
              }}
            >
              Agregar
            </Button>
          </div>
        </div>

        {pendingFiles.length ? (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {pendingFiles.map((pending) => (
              <div key={`${pending.fileName}-${pending.category}`} className="flex items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{pending.fileName}</p>
                  <p className="text-slate-500">
                    {pending.category.replaceAll("_", " ")} • {pending.notes || "Sin notas"}
                  </p>
                </div>
                <span className="text-xs font-medium text-slate-400">Pendiente de guardar</span>
              </div>
            ))}
          </div>
        ) : null}
      </FormSection>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
