import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/FormField";
import { useObjectState } from "@/hooks/useObjectState";
import { useDocumentWorkflow } from "@/hooks/useDocumentWorkflow";
import { generateAutorizacionPdf } from "@/pdf/autorizacionPdf";
import { GenerateDocumentButton } from "@/components/documents/GenerateDocumentButton";
import { consumeDocumentDraft } from "@/services/documentDraftService";
import type { AutorizacionFormValues } from "@/types/forms";
import { DocumentContextBar, DocumentPage, DocumentPersistenceStatus, FormGrid, FormSection } from "./documentUtils";

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

function resolveCurrentOwner(workflow: ReturnType<typeof useDocumentWorkflow>) {
  const data = workflow.operation?.data as Record<string, unknown> | undefined;
  const text = (...values: unknown[]) => values.find((value) => typeof value === "string" && value.trim()) as string | undefined;
  return {
    nombre: text(workflow.client?.nombre, data?.propietarioNombre, data?.titular, data?.nombre, workflow.vehicle?.buyerName) ?? "",
    dni: text(workflow.client?.dni, data?.propietarioDni, data?.titularDni, data?.dni) ?? "",
    domicilio: text(workflow.client?.domicilio, data?.propietarioDomicilio, data?.domicilio) ?? "",
    localidad: text(
      [workflow.client?.localidad, workflow.client?.provincia].filter(Boolean).join(" / "),
      data?.propietarioLocalidad,
      data?.localidad,
    ) ?? "",
  };
}

export function AutorizacionPage() {
  const [values, form] = useObjectState(initialState);
  const workflow = useDocumentWorkflow("autorizacion");
  useEffect(() => {
    const data = workflow.operation?.data as Record<string, string> | undefined;
    const owner = resolveCurrentOwner(workflow);
    if ((data || workflow.client || workflow.vehicle) && !values.autorizado) form.replace({ ...values, fecha: data?.fechaOperacion ?? values.fecha, autorizado: workflow.client?.nombre ?? data?.nombre ?? "", titular: owner.nombre, propietarioNombre: owner.nombre, propietarioDni: owner.dni, propietarioDomicilio: owner.domicilio, propietarioLocalidad: owner.localidad, dominio: workflow.prefill.dominio || data?.dominio || "", marca: workflow.prefill.vehiculoMarca, modelo: workflow.prefill.vehiculoModelo, anio: workflow.prefill.vehiculoAnio, domicilioAuto: workflow.prefill.domicilio });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.client, workflow.operation, workflow.vehicle, workflow.prefill]);
  useEffect(() => {
    if (workflow.saved?.data) {
      const savedData = workflow.saved.data as Partial<AutorizacionFormValues>;
      const owner = resolveCurrentOwner(workflow);
      form.replace({ ...initialState, ...savedData, titular: savedData.titular || owner.nombre, propietarioNombre: savedData.propietarioNombre || owner.nombre, propietarioDni: savedData.propietarioDni || owner.dni, propietarioDomicilio: savedData.propietarioDomicilio || owner.domicilio, propietarioLocalidad: savedData.propietarioLocalidad || owner.localidad });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, workflow.client, workflow.operation, workflow.saved, workflow.vehicle]);

  useEffect(() => {
    const draft = consumeDocumentDraft<AutorizacionFormValues>("autorizacion");
    if (draft) {
      form.replace({ ...initialState, ...draft });
    }
  }, [form]);

  return (
    <DocumentPage title="Autorizacion de Conduccion" description="Permiso de autorizacion para circular y constancia asociada.">
      <DocumentContextBar client={workflow.client} operation={workflow.operation} />
      <DocumentPersistenceStatus loading={workflow.loading} mode={workflow.mode} error={workflow.error} />
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

      <FormSection title="Propietario actual" description="Se completa automáticamente con el titular disponible en la operación o en la ficha del auto.">
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
        <GenerateDocumentButton
          documentType="autorizacion"
          values={values}
          onGenerate={async () => {
            await workflow.save(values as unknown as Record<string, unknown>, "generado");
            return generateAutorizacionPdf(values);
          }}
        />
      </div>
    </DocumentPage>
  );
}
