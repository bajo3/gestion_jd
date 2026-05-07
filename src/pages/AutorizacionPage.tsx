import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/FormField";
import { useObjectState } from "@/hooks/useObjectState";
import { generateAutorizacionPdf } from "@/pdf/autorizacionPdf";
import type { AutorizacionFormValues } from "@/types/forms";
import { DocumentPage, FormGrid, FormSection } from "./documentUtils";

const initialState: AutorizacionFormValues = {
  diasValidos: "",
  lugar: "",
  fecha: "",
  autorizado: "",
  titular: "",
  marca: "",
  modelo: "",
  tipo: "",
  anio: "",
  motor: "",
  chasis: "",
  dominio: "",
  domicilioAuto: "",
  otrasCaracteristicas: "",
  propietarioNombre: "",
  propietarioDni: "",
  propietarioDomicilio: "",
  propietarioLocalidad: "",
};

export function AutorizacionPage() {
  const [values, form] = useObjectState(initialState);

  return (
    <DocumentPage title="Autorizacion de Conduccion" description="Permiso de autorizacion para circular y constancia asociada.">
      <FormSection title="Informacion general">
        <FormGrid>
          <FormField label="Dias validos">
            <Input value={values.diasValidos} onChange={(event) => form.set("diasValidos", event.target.value)} />
          </FormField>
          <FormField label="Lugar">
            <Input value={values.lugar} onChange={(event) => form.set("lugar", event.target.value)} />
          </FormField>
          <FormField label="Fecha">
            <Input type="date" value={values.fecha} onChange={(event) => form.set("fecha", event.target.value)} />
          </FormField>
          <FormField label="Autorizado/a">
            <Input value={values.autorizado} onChange={(event) => form.set("autorizado", event.target.value)} />
          </FormField>
          <FormField label="Titular">
            <Input value={values.titular} onChange={(event) => form.set("titular", event.target.value)} />
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection title="Datos del vehiculo">
        <FormGrid>
          {([
            ["marca", "Marca"],
            ["modelo", "Modelo"],
            ["tipo", "Tipo"],
            ["anio", "Año"],
            ["motor", "Motor N°"],
            ["chasis", "Chasis N°"],
            ["dominio", "Dominio N°"],
            ["domicilioAuto", "Ubicacion / Domicilio"],
            ["otrasCaracteristicas", "Otras caracteristicas"],
          ] as const).map(([key, label]) => (
            <FormField key={key} label={label}>
              <Input value={values[key]} onChange={(event) => form.set(key, event.target.value)} />
            </FormField>
          ))}
        </FormGrid>
      </FormSection>

      <FormSection title="Propietario actual">
        <FormGrid>
          <FormField label="Nombre y apellido">
            <Input value={values.propietarioNombre} onChange={(event) => form.set("propietarioNombre", event.target.value)} />
          </FormField>
          <FormField label="DNI">
            <Input value={values.propietarioDni} onChange={(event) => form.set("propietarioDni", event.target.value)} />
          </FormField>
          <FormField label="Domicilio">
            <Input value={values.propietarioDomicilio} onChange={(event) => form.set("propietarioDomicilio", event.target.value)} />
          </FormField>
          <FormField label="Localidad">
            <Input value={values.propietarioLocalidad} onChange={(event) => form.set("propietarioLocalidad", event.target.value)} />
          </FormField>
        </FormGrid>
      </FormSection>

      <div className="flex justify-end">
        <Button onClick={() => generateAutorizacionPdf(values)}>Generar Resumen</Button>
      </div>
    </DocumentPage>
  );
}
