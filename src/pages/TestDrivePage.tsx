import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/FormField";
import { useObjectState } from "@/hooks/useObjectState";
import { generateTestDrivePdf } from "@/pdf/testDrivePdf";
import type { TestDriveFormValues } from "@/types/forms";
import { DocumentPage, FormGrid, FormSection } from "./documentUtils";

const initialState: TestDriveFormValues = {
  fecha: "",
  horaSalida: "",
  horaLlegada: "",
  concesionario: "",
  marca: "",
  modelo: "",
  version: "",
  dominio: "",
  color: "",
  recorrido: "",
  kmInicial: "",
  kmFinal: "",
  combustibleInicial: "",
  combustibleFinal: "",
  sinDanos: false,
  rayones: false,
  golpes: false,
  observaciones: "",
  docDni: false,
  docLicencia: false,
  docCedula: false,
  nombreConductor: "",
  dniConductor: "",
  lugar: "",
  aclaracionConductor: "",
  nombreAsesor: "",
  aclaracionAsesor: "",
  docLicenciaCopia: false,
};

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
      <Checkbox checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

export function TestDrivePage() {
  const [values, form] = useObjectState(initialState);

  return (
    <DocumentPage title="Test Drive" description="Formulario operativo y acuerdo de exoneracion de responsabilidad.">
      <FormSection title="Datos generales y del vehiculo">
        <FormGrid>
          {([
            ["fecha", "Fecha", "date"],
            ["horaSalida", "Hora de salida", "time"],
            ["horaLlegada", "Hora de llegada", "time"],
            ["concesionario", "Concesionario", "text"],
            ["marca", "Marca", "text"],
            ["modelo", "Modelo", "text"],
            ["version", "Version", "text"],
            ["dominio", "Dominio / Patente", "text"],
            ["color", "Color", "text"],
            ["recorrido", "Recorrido autorizado", "text"],
            ["kmInicial", "Kilometraje inicial", "number"],
            ["kmFinal", "Kilometraje final", "number"],
            ["combustibleInicial", "Combustible inicial", "text"],
            ["combustibleFinal", "Combustible final", "text"],
          ] as const).map(([key, label, type]) => (
            <FormField key={key} label={label}>
              <Input type={type} value={values[key]} onChange={(event) => form.set(key, event.target.value)} />
            </FormField>
          ))}
        </FormGrid>
      </FormSection>

      <FormSection title="Estado y documentacion">
        <div className="grid gap-4 md:grid-cols-3">
          <CheckField label="Sin daños visibles" checked={values.sinDanos} onChange={(checked) => form.set("sinDanos", checked)} />
          <CheckField label="Rayones" checked={values.rayones} onChange={(checked) => form.set("rayones", checked)} />
          <CheckField label="Golpes" checked={values.golpes} onChange={(checked) => form.set("golpes", checked)} />
          <CheckField label="DNI" checked={values.docDni} onChange={(checked) => form.set("docDni", checked)} />
          <CheckField label="Licencia vigente" checked={values.docLicencia} onChange={(checked) => form.set("docLicencia", checked)} />
          <CheckField label="Cedula / doc. vehiculo" checked={values.docCedula} onChange={(checked) => form.set("docCedula", checked)} />
          <CheckField label="Copia de licencia" checked={values.docLicenciaCopia} onChange={(checked) => form.set("docLicenciaCopia", checked)} />
        </div>
        <FormField label="Observaciones">
          <Textarea value={values.observaciones} onChange={(event) => form.set("observaciones", event.target.value)} />
        </FormField>
      </FormSection>

      <FormSection title="Conductor y asesor">
        <FormGrid>
          {([
            ["nombreConductor", "Nombre del conductor"],
            ["dniConductor", "DNI del conductor"],
            ["lugar", "Lugar"],
            ["aclaracionConductor", "Aclaracion del conductor"],
            ["nombreAsesor", "Nombre del asesor"],
            ["aclaracionAsesor", "Aclaracion del asesor"],
          ] as const).map(([key, label]) => (
            <FormField key={key} label={label}>
              <Input value={values[key]} onChange={(event) => form.set(key, event.target.value)} />
            </FormField>
          ))}
        </FormGrid>
      </FormSection>

      <div className="flex justify-end">
        <Button onClick={() => generateTestDrivePdf(values)}>Generar Resumen</Button>
      </div>
    </DocumentPage>
  );
}
